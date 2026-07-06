# -*- coding: utf-8 -*-
"""
云山智巡 - 遥感影像分析API服务
支持火情检测、NDVI分析、FVC植被覆盖度计算
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import rasterio
import numpy as np
from rasterio.warp import transform_bounds
import os
import json
from datetime import datetime
import tempfile
import base64
from PIL import Image
import cv2

app = Flask(__name__)
CORS(app)

# 配置
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
ALLOWED_EXTENSIONS = {'tif', 'tiff', 'img', 'dat'}

# 确保目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# ========== YOLO 火情/烟雾检测模型 ==========
yolo_model = None
try:
    from ultralytics import YOLO
    MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'best(1)_corrected.pt')
    yolo_model = YOLO(MODEL_PATH)
    print(f"[OK] YOLO 火情检测模型加载成功: {MODEL_PATH}")
except Exception as e:
    print(f"[警告] YOLO 火情模型加载失败: {e}")

# ========== YOLO 病虫害检测模型 ==========
pest_model = None
PEST_CLASS_NAMES = {
    0: '针叶褐斑',
    1: '健康',
    2: '早期枯死',
    3: '严重枯死',
    4: '健康',
    5: '树脂流溢',
    6: '针叶黄化',
    7: '枯死木',
    8: '叶部霉变',
    9: '针叶斑点',
    10: '虫害痕迹',
    11: '靶斑病变',
    12: '黄化卷叶',
    13: '花叶病变',
    14: '健康'
}
try:
    PEST_MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'yolov8small-best.pt')
    pest_model = YOLO(PEST_MODEL_PATH)
    print(f"[OK] YOLO 病虫害检测模型加载成功: {PEST_MODEL_PATH}")
except Exception as e:
    print(f"[警告] YOLO 病虫害模型加载失败: {e}")


def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


class RemoteSensingAnalyzer:
    """遥感影像分析器"""

    def __init__(self, image_path):
        self.image_path = image_path
        self.dataset = None
        self.metadata = {}

    def open_image(self):
        """打开遥感影像"""
        try:
            self.dataset = rasterio.open(self.image_path)
            self.metadata = {
                'width': self.dataset.width,
                'height': self.dataset.height,
                'count': self.dataset.count,
                'crs': str(self.dataset.crs),
                'bounds': list(self.dataset.bounds),
                'transform': [list(self.dataset.transform)[:3],
                             list(self.dataset.transform)[3:6]],
                'dtype': str(self.dataset.dtypes[0])
            }
            return True
        except Exception as e:
            raise Exception(f"无法打开影像文件: {str(e)}")

    def get_band_data(self, band_number):
        """获取指定波段数据"""
        if self.dataset is None:
            raise Exception("影像未打开")
        return self.dataset.read(band_number)

    def detect_fire(self, thermal_band=1, nir_band=2, red_band=3,
                    temp_threshold=320, ndvi_threshold=0.1):
        """
        火情检测算法
        基于热红外波段温度异常和NDVI阈值综合判断

        参数:
            thermal_band: 热红外波段号
            nir_band: 近红外波段号
            red_band: 红光波段号
            temp_threshold: 温度阈值（开尔文）
            ndvi_threshold: NDVI阈值（低于此值可能是火点）
        """
        try:
            # 读取波段数据
            thermal = self.get_band_data(thermal_band).astype(np.float32)
            nir = self.get_band_data(nir_band).astype(np.float32)
            red = self.get_band_data(red_band).astype(np.float32)

            # 计算NDVI
            ndvi = self._calculate_ndvi(nir, red)

            # 温度异常检测（热红外波段亮温）
            # 假设热红外数据已经转换为亮度温度
            temp_anomaly = thermal > temp_threshold

            # 综合判断：温度高且NDVI低（植被被烧毁）
            fire_mask = temp_anomaly & (ndvi < ndvi_threshold)

            # 火点强度分级
            fire_intensity = self._classify_fire_intensity(thermal, fire_mask)

            # 统计火情信息
            fire_stats = self._calculate_fire_statistics(fire_mask, fire_intensity, thermal)

            # 生成火情检测结果图
            result_image = self._generate_fire_result_image(fire_mask, fire_intensity, thermal)

            # 保存结果
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = os.path.join(OUTPUT_FOLDER, f'fire_detection_{timestamp}.png')
            cv2.imwrite(output_path, result_image)

            return {
                'success': True,
                'metadata': self.metadata,
                'statistics': fire_stats,
                'result_image': output_path,
                'detection_params': {
                    'thermal_band': thermal_band,
                    'temp_threshold': temp_threshold,
                    'ndvi_threshold': ndvi_threshold
                },
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _calculate_ndvi(self, nir, red):
        """计算NDVI（归一化植被指数）"""
        # 避免除零
        denominator = nir + red
        denominator[denominator == 0] = 0.001
        ndvi = (nir - red) / denominator
        return np.clip(ndvi, -1, 1)

    def _classify_fire_intensity(self, thermal, fire_mask):
        """火情强度分级"""
        intensity = np.zeros_like(thermal, dtype=np.int8)
        intensity[fire_mask & (thermal < 340)] = 1  # 低强度
        intensity[fire_mask & (thermal >= 340) & (thermal < 360)] = 2  # 中强度
        intensity[fire_mask & (thermal >= 360)] = 3  # 高强度
        return intensity

    def _calculate_fire_statistics(self, fire_mask, fire_intensity, thermal):
        """计算火情统计信息"""
        total_pixels = np.sum(fire_mask)

        # 转换像素数量为实际面积（需要根据分辨率计算，这里简化处理）
        pixel_area = 900  # 假设每个像素30m×30m
        total_area = total_pixels * pixel_area / 10000  # 转换为公顷

        # 火点分布统计
        low_fire = np.sum(fire_intensity == 1)
        mid_fire = np.sum(fire_intensity == 2)
        high_fire = np.sum(fire_intensity == 3)

        # 温度统计
        fire_temps = thermal[fire_mask]
        avg_temp = np.mean(fire_temps) if len(fire_temps) > 0 else 0
        max_temp = np.max(fire_temps) if len(fire_temps) > 0 else 0

        # 火场中心坐标（简化计算）
        if total_pixels > 0:
            fire_coords = np.where(fire_mask)
            center_row = int(np.mean(fire_coords[0]))
            center_col = int(np.mean(fire_coords[1]))

            # 转换为地理坐标
            if self.dataset:
                lon, lat = self.dataset.xy(center_row, center_col)
                center_coords = [lat, lon]
            else:
                center_coords = [center_row, center_col]
        else:
            center_coords = None

        return {
            'total_fire_points': int(total_pixels),
            'estimated_area_hectares': round(total_area, 2),
            'fire_intensity_distribution': {
                'low_intensity': int(low_fire),      # 低强度火点数
                'mid_intensity': int(mid_fire),      # 中强度火点数
                'high_intensity': int(high_fire)     # 高强度火点数
            },
            'temperature_stats': {
                'average_temp_k': round(float(avg_temp), 2),
                'max_temp_k': round(float(max_temp), 2),
                'average_temp_c': round(float(avg_temp) - 273.15, 2),
                'max_temp_c': round(float(max_temp) - 273.15, 2)
            },
            'fire_center': center_coords,
            'fire_risk_level': self._assess_fire_risk(total_pixels, high_fire)
        }

    def _assess_fire_risk(self, total_pixels, high_fire):
        """评估火灾风险等级"""
        if total_pixels == 0:
            return '无火情'
        elif high_fire > 100:
            return '极高危'
        elif high_fire > 50 or total_pixels > 500:
            return '高危'
        elif high_fire > 10 or total_pixels > 200:
            return '中危'
        else:
            return '低危'

    def _generate_fire_result_image(self, fire_mask, fire_intensity, thermal):
        """生成火情检测结果可视化图像"""
        # 创建RGB图像
        height, width = fire_mask.shape
        result = np.zeros((height, width, 3), dtype=np.uint8)

        # 显示热红外背景（灰度）
        thermal_normalized = ((thermal - thermal.min()) / (thermal.max() - thermal.min()) * 255).astype(np.uint8)
        result[:, :, 0] = thermal_normalized
        result[:, :, 1] = thermal_normalized
        result[:, :, 2] = thermal_normalized

        # 叠加火情检测结果
        # 高强度：红色
        result[fire_intensity == 3] = [255, 0, 0]
        # 中强度：橙色
        result[fire_intensity == 2] = [255, 165, 0]
        # 低强度：黄色
        result[fire_intensity == 1] = [255, 255, 0]

        return result

    def calculate_ndvi(self, nir_band=4, red_band=3):
        """
        NDVI（归一化植被指数）分析

        NDVI = (NIR - RED) / (NIR + RED)

        范围: -1 到 1
        - < 0: 水体、云、雪
        - 0-0.2: 裸土、建筑物
        - 0.2-0.4: 稀疏植被
        - 0.4-0.6: 中等植被覆盖
        - 0.6-0.8: 密集植被
        - > 0.8: 非常密集的植被
        """
        try:
            # 读取近红外和红光波段
            nir = self.get_band_data(nir_band).astype(np.float64)
            red = self.get_band_data(red_band).astype(np.float64)

            # 计算NDVI
            ndvi = self._calculate_ndvi(nir, red)

            # NDVI统计分析
            ndvi_stats = self._calculate_ndvi_statistics(ndvi)

            # 植被覆盖分类
            vegetation_classification = self._classify_vegetation_coverage(ndvi)

            # 生成NDVI可视化图像
            ndvi_image = self._generate_ndvi_visualization(ndvi)

            # 保存结果
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = os.path.join(OUTPUT_FOLDER, f'ndvi_analysis_{timestamp}.png')
            cv2.imwrite(output_path, ndvi_image)

            # 保存NDVI数据为GeoTIFF（可选）
            ndvi_tiff_path = os.path.join(OUTPUT_FOLDER, f'ndvi_data_{timestamp}.tif')
            self._save_geotiff(ndvi, ndvi_tiff_path)

            return {
                'success': True,
                'metadata': self.metadata,
                'statistics': ndvi_stats,
                'vegetation_classification': vegetation_classification,
                'result_image': output_path,
                'data_file': ndvi_tiff_path,
                'calculation_params': {
                    'nir_band': nir_band,
                    'red_band': red_band,
                    'formula': '(NIR - RED) / (NIR + RED)'
                },
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _calculate_ndvi_statistics(self, ndvi):
        """计算NDVI统计信息"""
        valid_ndvi = ndvi[~np.isnan(ndvi) & np.isfinite(ndvi)]

        return {
            'mean': round(float(np.mean(valid_ndvi)), 4),
            'std': round(float(np.std(valid_ndvi)), 4),
            'min': round(float(np.min(valid_ndvi)), 4),
            'max': round(float(np.max(valid_ndvi)), 4),
            'median': round(float(np.median(valid_ndvi)), 4),
            'valid_pixel_count': int(len(valid_ndvi)),
            'total_pixel_count': int(ndvi.size)
        }

    def _classify_vegetation_coverage(self, ndvi):
        """植被覆盖等级分类"""
        classifications = {
            'water_snow_cloud': {'range': '< 0', 'count': int(np.sum(ndvi < 0)),
                               'description': '水体、云、雪'},
            'bare_soil_building': {'range': '0 - 0.2', 'count': int(np.sum((ndvi >= 0) & (ndvi < 0.2))),
                                  'description': '裸土、建筑物'},
            'sparse_vegetation': {'range': '0.2 - 0.4', 'count': int(np.sum((ndvi >= 0.2) & (ndvi < 0.4))),
                                 'description': '稀疏植被'},
            'moderate_vegetation': {'range': '0.4 - 0.6', 'count': int(np.sum((ndvi >= 0.4) & (ndvi < 0.6))),
                                   'description': '中等植被'},
            'dense_vegetation': {'range': '0.6 - 0.8', 'count': int(np.sum((ndvi >= 0.6) & (ndvi < 0.8))),
                                'description': '密集植被'},
            'very_dense_vegetation': {'range': '> 0.8', 'count': int(np.sum(ndvi >= 0.8)),
                                     'description': '非常密集植被'}
        }

        total_valid = sum(cls['count'] for cls in classifications.values())

        # 计算百分比
        for cls in classifications.values():
            cls['percentage'] = round(cls['count'] / total_valid * 100, 2) if total_valid > 0 else 0

        return classifications

    def _generate_ndvi_visualization(self, ndvi):
        """生成NDVI可视化图像（伪彩色）"""
        # 将NDVI归一化到0-255
        ndvi_normalized = ((ndvi + 1) / 2 * 255).astype(np.uint8)

        # 应用伪彩色映射（使用PARULA，效果接近RdYlGn的红-黄-绿渐变）
        ndvi_color = cv2.applyColorMap(ndvi_normalized, cv2.COLORMAP_PARULA)

        return ndvi_color

    def calculate_fvc(self, ndvi=None, nir_band=4, red_band=3):
        """
        FVC（植被覆盖度）计算

        使用像元二分模型：
        FVC = (NDVI - NDVI_soil) / (NDVI_veg - NDVI_soil)

        其中：
        - NDVI_soil: 完全裸土或无植被覆盖区域的NDVI值（通常取0.05-0.2）
        - NDVI_veg: 完全植被覆盖区域的NDVI值（通常取0.8-0.95）

        FVC范围: 0 到 1
        - 0-0.1: 裸地
        - 0.1-0.3: 低覆盖
        - 0.3-0.5: 中低覆盖
        - 0.5-0.7: 中等覆盖
        - 0.7-0.9: 高覆盖
        - 0.9-1.0: 全覆盖
        """
        try:
            # 如果没有提供NDVI，则先计算
            if ndvi is None:
                nir = self.get_band_data(nir_band).astype(np.float64)
                red = self.get_band_data(red_band).astype(np.float64)
                ndvi = self._calculate_ndvi(nir, red)

            # 设置NDVI阈值（可根据实际研究区域调整）
            ndvi_soil = 0.05   # 裸土NDVI值
            ndvi_veg = 0.85   # 完全覆盖植被NDVI值

            # 计算FVC
            fvc = (ndvi - ndvi_soil) / (ndvi_veg - ndvi_soil)
            fvc = np.clip(fvc, 0, 1)  # 限制在0-1范围
            fvc[np.isnan(ndvi)] = np.nan  # 保持无效值为NaN

            # FVC统计分析
            fvc_stats = self._calculate_fvc_statistics(fvc)

            # 植被覆盖度分级
            fvc_classification = self._classify_fvc_coverage(fvc)

            # 生成FVC可视化图像
            fvc_image = self._generate_fvc_visualization(fvc)

            # 保存结果
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = os.path.join(OUTPUT_FOLDER, f'fvc_analysis_{timestamp}.png')
            cv2.imwrite(output_path, fvc_image)

            # 保存FVC数据
            fvc_tiff_path = os.path.join(OUTPUT_FOLDER, f'fvc_data_{timestamp}.tif')
            self._save_geotiff(fvc, fvc_tiff_path)

            return {
                'success': True,
                'metadata': self.metadata,
                'statistics': fvc_stats,
                'coverage_classification': fvc_classification,
                'result_image': output_path,
                'data_file': fvc_tiff_path,
                'calculation_params': {
                    'ndvi_soil': ndvi_soil,
                    'ndvi_veg': ndvi_veg,
                    'formula': '(NDVI - NDVI_soil) / (NDVI_veg - NDVI_soil)',
                    'model': '像元二分模型'
                },
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _calculate_fvc_statistics(self, fvc):
        """计算FVC统计信息"""
        valid_fvc = fvc[~np.isnan(fvc)]

        # 计算平均植被覆盖度（面积加权平均）
        mean_fvc = float(np.mean(valid_fvc))

        # 总体植被覆盖率（FVC > 0.5的像素比例）
        vegetation_ratio = float(np.sum(valid_fvc > 0.5) / len(valid_fvc)) * 100 if len(valid_fvc) > 0 else 0

        return {
            'mean_fvc': round(mean_fvc, 4),
            'mean_percentage': round(mean_fvc * 100, 2),  # 转换为百分比
            'vegetation_coverage_rate': round(vegetation_ratio, 2),  # 总体植被覆盖率(%)
            'std': round(float(np.std(valid_fvc)), 4),
            'min': round(float(np.min(valid_fvc)), 4),
            'max': round(float(np.max(valid_fvc)), 4),
            'median': round(float(np.median(valid_fvc)), 4),
            'valid_pixel_count': int(len(valid_fvc))
        }

    def _classify_fvc_coverage(self, fvc):
        """FVC植被覆盖度分级"""
        classifications = {
            'bare_land': {'range': '0 - 0.1', 'count': int(np.sum((fvc >= 0) & (fvc < 0.1))),
                         'percentage': 0, 'description': '裸地'},
            'low_coverage': {'range': '0.1 - 0.3', 'count': int(np.sum((fvc >= 0.1) & (fvc < 0.3))),
                            'percentage': 0, 'description': '低覆盖'},
            'medium_low_coverage': {'range': '0.3 - 0.5', 'count': int(np.sum((fvc >= 0.3) & (fvc < 0.5))),
                                   'percentage': 0, 'description': '中低覆盖'},
            'medium_coverage': {'range': '0.5 - 0.7', 'count': int(np.sum((fvc >= 0.5) & (fvc < 0.7))),
                               'percentage': 0, 'description': '中等覆盖'},
            'high_coverage': {'range': '0.7 - 0.9', 'count': int(np.sum((fvc >= 0.7) & (fvc < 0.9))),
                             'percentage': 0, 'description': '高覆盖'},
            'full_coverage': {'range': '0.9 - 1.0', 'count': int(np.sum(fvc >= 0.9)),
                             'percentage': 0, 'description': '全覆盖'}
        }

        total_valid = sum(cls['count'] for cls in classifications.values())

        # 计算百分比
        for cls in classifications.values():
            cls['percentage'] = round(cls['count'] / total_valid * 100, 2) if total_valid > 0 else 0

        return classifications

    def _generate_fvc_visualization(self, fvc):
        """生成FVC可视化图像"""
        # 将FVC归一化到0-255
        fvc_normalized = (fvc * 255).astype(np.uint8)

        # 应用颜色映射
        fvc_color = cv2.applyColorMap(fvc_normalized, cv2.COLORMAP_JET)

        return fvc_color

    def _save_geotiff(self, data, output_path):
        """保存GeoTIFF文件"""
        if self.dataset is None:
            return False

        try:
            # 写入新的GeoTIFF文件
            with rasterio.open(
                output_path,
                'w',
                driver='GTiff',
                height=data.shape[0],
                width=data.shape[1],
                count=1,
                dtype=data.dtype,
                crs=self.dataset.crs,
                transform=self.dataset.transform
            ) as dst:
                dst.write(data, 1)
            return True
        except Exception as e:
            print(f"保存GeoTIFF失败: {e}")
            return False


# ==================== API路由 ====================

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """上传遥感影像文件"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '没有文件部分'})

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': '未选择文件'})

    if file and allowed_file(file.filename):
        filename = file.filename
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        # 获取影像基本信息
        try:
            analyzer = RemoteSensingAnalyzer(filepath)
            analyzer.open_image()

            return jsonify({
                'success': True,
                'filename': filename,
                'filepath': filepath,
                'metadata': analyzer.metadata
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})
    else:
        return jsonify({'success': False, 'error': '不支持的文件格式'})


@app.route('/api/preview', methods=['POST'])
def preview_image():
    """生成遥感影像预览PNG（用于地图叠加显示）"""
    data = request.json

    if not data or 'filepath' not in data:
        return jsonify({'success': False, 'error': '缺少文件路径参数'})

    filepath = data['filepath']
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'error': '文件不存在'})

    try:
        with rasterio.open(filepath) as src:
            # 获取影像边界并转换为 Leaflet 使用的 WGS84 经纬度
            if src.crs and str(src.crs).upper() not in ('EPSG:4326', 'OGC:CRS84'):
                west, south, east, north = transform_bounds(src.crs, 'EPSG:4326', *src.bounds, densify_pts=21)
            else:
                bounds = src.bounds
                west, south, east, north = bounds.left, bounds.bottom, bounds.right, bounds.top

            # 读取前3个波段作为RGB（如果波段数不足3，则重复使用）
            band_count = src.count
            if band_count >= 3:
                rgb = src.read([1, 2, 3]).astype(np.float32)  # R, G, B
            elif band_count == 1:
                band = src.read(1).astype(np.float32)
                rgb = np.stack([band, band, band])  # 灰度转RGB
            else:
                band1 = src.read(1).astype(np.float32)
                band2 = src.read(2).astype(np.float32)
                rgb = np.stack([band1, band2, band1])  # 2波段转RGB

            # 归一化到0-255。必须写入新的 uint8 数组，否则 PIL 无法保存 float32 RGB。
            rgb_uint8 = np.zeros((3, src.height, src.width), dtype=np.uint8)
            for i in range(3):
                band = rgb[i]
                valid = np.isfinite(band)
                if valid.any():
                    band_min = np.nanpercentile(band[valid], 2)
                    band_max = np.nanpercentile(band[valid], 98)
                    if band_max > band_min:
                        normalized = (band - band_min) / (band_max - band_min) * 255
                        rgb_uint8[i] = np.clip(normalized, 0, 255).astype(np.uint8)

            # 转为RGB图像 (H, W, 3)
            image = np.transpose(rgb_uint8, (1, 2, 0))
            # 保存为PNG
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'preview_{timestamp}.png'
            output_path = os.path.join(OUTPUT_FOLDER, filename)
            Image.fromarray(image).save(output_path)

            return jsonify({
                'success': True,
                'preview_url': f'/api/result/{filename}',  # 返回HTTP路径
                'bounds': {
                    'south': south,
                    'north': north,
                    'west': west,
                    'east': east
                },
                'metadata': {
                    'width': src.width,
                    'height': src.height,
                    'crs': str(src.crs)
                }
            })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/analyze/fire', methods=['POST'])
def analyze_fire():
    """火情检测分析接口"""
    data = request.json

    if not data or 'filepath' not in data:
        return jsonify({'success': False, 'error': '缺少文件路径参数'})

    filepath = data['filepath']
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'error': '文件不存在'})

    try:
        # 获取参数（可选）
        params = {
            'thermal_band': data.get('thermal_band', 1),
            'nir_band': data.get('nir_band', 2),
            'red_band': data.get('red_band', 3),
            'temp_threshold': data.get('temp_threshold', 320),
            'ndvi_threshold': data.get('ndvi_threshold', 0.1)
        }

        analyzer = RemoteSensingAnalyzer(filepath)
        analyzer.open_image()
        result = analyzer.detect_fire(**params)

        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/analyze/ndvi', methods=['POST'])
def analyze_ndvi():
    """NDVI分析接口"""
    data = request.json

    if not data or 'filepath' not in data:
        return jsonify({'success': False, 'error': '缺少文件路径参数'})

    filepath = data['filepath']
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'error': '文件不存在'})

    try:
        # 获取参数（可选）
        params = {
            'nir_band': data.get('nir_band', 4),
            'red_band': data.get('red_band', 3)
        }

        analyzer = RemoteSensingAnalyzer(filepath)
        analyzer.open_image()
        result = analyzer.calculate_ndvi(**params)

        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/analyze/fvc', methods=['POST'])
def analyze_fvc():
    """FVC植被覆盖度分析接口"""
    data = request.json

    if not data or 'filepath' not in data:
        return jsonify({'success': False, 'error': '缺少文件路径参数'})

    filepath = data['filepath']
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'error': '文件不存在'})

    try:
        # 获取参数（可选）
        params = {
            'nir_band': data.get('nir_band', 4),
            'red_band': data.get('red_band', 3)
        }

        analyzer = RemoteSensingAnalyzer(filepath)
        analyzer.open_image()
        result = analyzer.calculate_fvc(**params)

        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/result/<filename>', methods=['GET'])
def get_result_image(filename):
    """获取分析结果图像"""
    filepath = os.path.join(OUTPUT_FOLDER, filename)
    if os.path.exists(filepath):
        return send_file(filepath, mimetype='image/png')
    else:
        return jsonify({'success': False, 'error': '文件不存在'}), 404


@app.route('/api/batch/analyze', methods=['POST'])
def batch_analyze():
    """批量分析接口（同时进行火情、NDVI、FVC分析）"""
    data = request.json

    if not data or 'filepath' not in data:
        return jsonify({'success': False, 'error': '缺少文件路径参数'})

    filepath = data['filepath']
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'error': '文件不存在'})

    try:
        analyzer = RemoteSensingAnalyzer(filepath)
        analyzer.open_image()

        # 执行三种分析
        fire_result = analyzer.detect_fire()
        ndvi_result = analyzer.calculate_ndvi()
        fvc_result = analyzer.calculate_fvc()

        return jsonify({
            'success': True,
            'fire_analysis': fire_result,
            'ndvi_analysis': ndvi_result,
            'fvc_analysis': fvc_result,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# ========== 火情AI识别接口（YOLO模型） ==========
IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png', 'bmp', 'webp'}

@app.route('/api/recognition/detect', methods=['POST'])
def fire_recognition_detect():
    """火情AI识别 - 使用YOLO模型检测火焰和烟雾"""
    # 检查模型是否可用
    if yolo_model is None:
        return jsonify({'success': False, 'error': 'YOLO模型未加载，请检查模型文件和ultralytics依赖'}), 503

    # 检查是否有文件上传
    if 'image' not in request.files:
        return jsonify({'success': False, 'error': '未上传图片，请选择文件后重试'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'success': False, 'error': '未选择文件'}), 400

    # 检查文件格式
    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    if ext not in IMAGE_EXTENSIONS:
        return jsonify({'success': False, 'error': f'不支持的图片格式: .{ext}，请上传 jpg/png/bmp 图片'}), 400

    try:
        # 保存上传的图片到临时文件
        temp_path = os.path.join(UPLOAD_FOLDER, f'temp_detect_{file.filename}')
        file.save(temp_path)

        # YOLO 推理
        results = yolo_model.predict(source=temp_path, conf=0.25, verbose=False)
        result = results[0]

        # 解析检测结果
        detections = []
        fire_count = 0
        smoke_count = 0
        max_fire_conf = 0.0

        if result.boxes is not None and len(result.boxes) > 0:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                cls_name = result.names[cls_id]
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                detections.append({
                    'class': cls_name,
                    'confidence': round(conf, 3),
                    'box': [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)]
                })

                if cls_name == 'Fire':
                    fire_count += 1
                    max_fire_conf = max(max_fire_conf, conf)
                elif cls_name == 'Smoke':
                    smoke_count += 1

        # 判定风险等级
        if fire_count > 0 and max_fire_conf > 0.5:
            level = 'high'
        elif fire_count > 0 or smoke_count > 0:
            level = 'mid'
        else:
            level = 'low'

        # 生成结果文本
        parts = []
        if fire_count > 0:
            parts.append(f'{fire_count}处明火')
        if smoke_count > 0:
            parts.append(f'{smoke_count}处烟雾')
        if parts:
            result_text = ('高危' if level == 'high' else '疑似') + ' - 检测到' + ','.join(parts)
        else:
            result_text = '正常 - 未检测到火情或烟雾'

        # 生成标注图片并转 base64
        annotated = result.plot()  # numpy array (BGR)
        _, buffer = cv2.imencode('.png', annotated)
        img_base64 = 'data:image/png;base64,' + base64.b64encode(buffer).decode('utf-8')

        # 清理临时文件
        if os.path.exists(temp_path):
            os.remove(temp_path)

        return jsonify({
            'success': True,
            'image_base64': img_base64,
            'filename': file.filename,
            'detections': detections,
            'fire_count': fire_count,
            'smoke_count': smoke_count,
            'level': level,
            'result_text': result_text,
            'timestamp': datetime.now().strftime('%H:%M')
        })

    except Exception as e:
        # 清理临时文件
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({'success': False, 'error': f'检测失败: {str(e)}'}), 500


# ========== 疫情识别接口（YOLO病虫害检测模型） ==========
@app.route('/api/recognition/pest-detect', methods=['POST'])
def pest_recognition_detect():
    """疫情AI识别 - 使用YOLO模型检测病虫害"""
    if pest_model is None:
        return jsonify({'success': False, 'error': '病虫害检测模型未加载，请检查 yolov8small-best.pt'}), 503

    if 'image' not in request.files:
        return jsonify({'success': False, 'error': '未上传图片'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'success': False, 'error': '未选择文件'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    if ext not in IMAGE_EXTENSIONS:
        return jsonify({'success': False, 'error': f'不支持的格式: .{ext}'}), 400

    try:
        temp_path = os.path.join(UPLOAD_FOLDER, f'temp_pest_{file.filename}')
        file.save(temp_path)

        # YOLO 推理
        results = pest_model.predict(source=temp_path, conf=0.25, verbose=False)
        result = results[0]

        # 解析检测结果
        detections = []
        class_counts = {}
        max_conf = 0.0

        if result.boxes is not None and len(result.boxes) > 0:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                cls_name = PEST_CLASS_NAMES.get(cls_id, result.names.get(cls_id, f'类别{cls_id}'))
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                detections.append({
                    'class': cls_name,
                    'confidence': round(conf, 3),
                    'box': [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)]
                })
                class_counts[cls_name] = class_counts.get(cls_name, 0) + 1
                max_conf = max(max_conf, conf)

        # 判定风险等级
        total_detections = sum(class_counts.values())
        if total_detections > 5 and max_conf > 0.5:
            level = 'high'
        elif total_detections > 2:
            level = 'mid'
        elif total_detections > 0:
            level = 'low'
        else:
            level = 'low'

        # 生成结果文本
        parts = [f'{v}处{c}' for c, v in class_counts.items()]
        if parts:
            prefix = '高危' if level == 'high' else '疑似' if level == 'mid' else '注意'
            result_text = f'{prefix} - 检测到{"，".join(parts)}'
        else:
            result_text = '正常 - 未检测到明显病虫害'

        # 生成标注图（先把原始类名替换为林业术语，再画框）
        original_names = dict(result.names)
        result.names = {k: PEST_CLASS_NAMES.get(k, v) for k, v in original_names.items()}
        annotated = result.plot()
        result.names = original_names  # 恢复
        _, buffer = cv2.imencode('.png', annotated)
        img_base64 = 'data:image/png;base64,' + base64.b64encode(buffer).decode('utf-8')

        if os.path.exists(temp_path):
            os.remove(temp_path)

        return jsonify({
            'success': True,
            'image_base64': img_base64,
            'filename': file.filename,
            'detections': detections,
            'class_counts': class_counts,
            'total_detections': total_detections,
            'max_confidence': round(max_conf, 3),
            'level': level,
            'result_text': result_text,
            'timestamp': datetime.now().strftime('%H:%M')
        })

    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({'success': False, 'error': f'检测失败: {str(e)}'}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'healthy',
        'service': '云山智巡遥感影像分析服务',
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat(),
        'supported_formats': list(ALLOWED_EXTENSIONS),
        'yolo_model': 'loaded' if yolo_model is not None else 'not_loaded',
        'endpoints': [
            '/api/upload - 上传影像',
            '/api/analyze/fire - 火情检测(遥感)',
            '/api/analyze/ndvi - NDVI分析',
            '/api/analyze/fvc - FVC分析',
            '/api/batch/analyze - 批量分析',
            '/api/recognition/detect - 火情AI识别(YOLO)'
        ]
    })


if __name__ == '__main__':
    print("=" * 60)
    print("云山智巡 - 遥感影像分析服务")
    print("=" * 60)
    print("启动服务...")
    print(f"上传目录: {UPLOAD_FOLDER}")
    print(f"输出目录: {OUTPUT_FOLDER}")
    print("访问地址: http://localhost:5000")
    print("API文档: http://localhost:5000/api/health")
    print("=" * 60)

    app.run(host='0.0.0.0', port=5000, debug=False)
