/**
 * 遥感影像分析引擎 - 重构版
 *
 * 架构特点：
 * 1. 组件化设计 - AnalysisEngine统一管理所有分析模块
 * 2. 配置驱动 - 每个分析类型通过配置对象定义
 * 3. 统一流程 - 上传→处理→展示的标准化流程
 * 4. 易于扩展 - 添加新分析类型只需添加配置
 */

// ==================== 配置定义 ====================

const ANALYSIS_CONFIGS = {
    fire: {
        id: 'fire',
        name: '火情检测分析',
        icon: '🔥',
        description: '基于热红外波段的火点检测与风险等级评估',

        // 文件上传配置
        upload: {
            acceptFormats: '.tif,.tiff,.img',
            hint: '支持 .tif, .tiff, .img 格式（需包含热红外波段）'
        },

        // 参数配置
        params: [
            { id: 'thermalBand', label: '热红外波段', type: 'number', default: 1, min: 1, max: 10, help: '热红外波段编号（通常为第1波段）' },
            { id: 'nirBandFire', label: '近红外波段', type: 'number', default: 2, min: 1, max: 10 },
            { id: 'redBandFire', label: '红光波段', type: 'number', default: 3, min: 1, max: 10 },
            { id: 'tempThreshold', label: '温度阈值 (K)', type: 'number', default: 320, min: 273, max: 500, step: 0.1, help: '高于此温度视为异常（开尔文）' },
            { id: 'ndviThresholdFire', label: 'NDVI阈值', type: 'number', default: 0.1, min: -1, max: 1, step: 0.01, help: '低于此值可能是火烧区域' }
        ],

        // API端点
        apiEndpoint: '/api/analyze/fire',

        // 按钮文字
        buttonText: '🔥 开始火情检测',

        // 结果渲染器
        resultRenderer: renderFireResult,

        // 模拟数据生成器
        mockDataGenerator: generateMockFireResult
    },

    ndvi: {
        id: 'ndvi',
        name: 'NDVI植被指数分析',
        icon: '🌿',
        description: '计算归一化植被指数，评估植被生长状况和覆盖度',

        upload: {
            acceptFormats: '.tif,.tiff',
            hint: '支持 .tif, .tiff 格式（需包含近红外和红光波段）'
        },

        params: [
            { id: 'nirBandNdvi', label: '近红外波段 (NIR)', type: 'number', default: 4, min: 1, max: 10, help: '通常Landsat 8为波段5，Sentinel-2为波段8' },
            { id: 'redBandNdvi', label: '红光波段 (RED)', type: 'number', default: 3, min: 1, max: 10, help: '通常Landsat 8为波段4，Sentinel-2为波段4' }
        ],

        infoBox: {
            title: 'NDVI计算公式',
            content: '<p style="margin:8px 0 0 0;font-size:11px;color:#b0bec5;font-family:monospace;">NDVI = (NIR - RED) / (NIR + RED)</p><p style="margin:6px 0 0 0;font-size:10px;color:#78909c;">范围: -1 到 1 | 值越大表示植被越茂盛</p>',
            color: '#00bcd4'
        },

        apiEndpoint: '/api/analyze/ndvi',
        buttonText: '🌿 计算NDVI',
        resultRenderer: renderNdviResult,
        mockDataGenerator: generateMockNdviResult
    },

    fvc: {
        id: 'fvc',
        name: 'FVC植被覆盖度分析',
        icon: '🌲',
        description: '基于像元二分模型计算植被覆盖度百分比',

        upload: {
            acceptFormats: '.tif,.tiff',
            hint: '支持 .tif, .tiff 格式（需包含近红外和红光波段）'
        },

        params: [
            { id: 'nirBandFvc', label: '近红外波段 (NIR)', type: 'number', default: 4, min: 1, max: 10 },
            { id: 'redBandFvc', label: '红光波段 (RED)', type: 'number', default: 3, min: 1, max: 10 },
            { id: 'ndviSoil', label: '裸土NDVI值 (NDVI<sub>soil</sub>)', type: 'number', default: 0.05, min: -0.5, max: 0.5, step: 0.01, help: '完全无植被覆盖区域的NDVI值' },
            { id: 'ndviVeg', label: '全植被NDVI值 (NDVI<sub>veg</sub>)', type: 'number', default: 0.85, min: 0.5, max: 1.0, step: 0.01, help: '完全植被覆盖区域的NDVI值' }
        ],

        infoBox: {
            title: 'FVC计算公式',
            content: '<p style="margin:8px 0 0 0;font-size:11px;color:#b0bec5;font-family:monospace;">FVC = [(NDVI - NDVI<sub>soil</sub>) / (NDVI<sub>veg</sub> - NDVI<sub>soil</sub>)]²</p><p style="margin:6px 0 0 0;font-size:10px;color:#78909c;">范围: 0% 到 100% | 表示植被覆盖程度</p>',
            color: '#4caf50'
        },

        apiEndpoint: '/api/analyze/fvc',
        buttonText: '🌲 计算FVC',
        resultRenderer: renderFvcResult,
        mockDataGenerator: generateMockFvcResult
    }
};

// ==================== API配置 ====================

const RemoteSensingAPI = {
    BASE_URL: 'http://localhost:5000',
    ENDPOINTS: {
        UPLOAD: '/api/upload',
        HEALTH: '/api/health',
        RESULT_IMAGE: '/api/result/'
    }
};

// ==================== 核心引擎类 ====================

class AnalysisEngine {
    constructor() {
        this.modules = {};
        this.debugMode = true;
        this.initialized = false;
    }

    /**
     * 初始化引擎
     */
    async init() {
        if (this.initialized) {
            this.log('引擎已初始化，跳过');
            return;
        }

        this.log('开始初始化遥感影像分析引擎...');

        // 初始化每个分析模块
        for (const [type, config] of Object.entries(ANALYSIS_CONFIGS)) {
            this.initModule(type, config);
        }

        this.initialized = true;
        this.log(`✅ 引擎初始化完成，共加载 ${Object.keys(this.modules).length} 个分析模块`);
    }

    /**
     * 初始化单个分析模块
     */
    initModule(type, config) {
        this.log(`初始化模块: ${config.name} (${type})`);

        const module = {
            config,
            state: {
                uploadedFile: null,
                fileObject: null,   // 保存真实File对象，用于后端上线后重新上传
                isAnalyzing: false,
                result: null
            }
        };

        // 绑定DOM元素事件
        this.bindModuleEvents(module);

        // 存储模块实例
        this.modules[type] = module;

        this.log(`✅ 模块 ${type} 初始化成功`);
    }

    /**
     * 绑定模块的事件监听器
     */
    bindModuleEvents(module) {
        const { id } = module.config;

        // 文件输入元素
        const fileInput = document.getElementById(`${id}FileInput`);
        if (!fileInput) {
            console.error(`❌ 找不到文件输入元素: ${id}FileInput`);
            return;
        }

        // 上传区域元素
        const uploadArea = document.getElementById(`${id}ImageUpload`);
        if (!uploadArea) {
            console.error(`❌ 找不到上传区域元素: ${id}ImageUpload`);
            return;
        }

        // 文件选择事件
        fileInput.addEventListener('change', (e) => {
            this.log(`${id} 文件选择事件触发`);
            this.handleFileSelect(e, id);
        });

        // 点击上传区域打开文件选择器
        uploadArea.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                this.log(`点击上传区域 (${id})`);
                fileInput.click();
            }
        });

        // 拖拽事件
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('drag-over');
            this.log(`${id} 文件拖放事件`);

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processFile(files[0], id);
            }
        });
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(event, type) {
        const files = event.target.files;
        if (files && files.length > 0) {
            this.processFile(files[0], type);
        } else {
            Notification.show('未选择任何文件', 'warning');
        }
    }

    /**
     * 处理文件上传和处理
     */
    async processFile(file, type) {
        const module = this.modules[type];
        if (!module) return;

        this.log(`处理文件: ${file.name} (${type})`);

        // 验证文件格式
        const allowedExtensions = module.config.upload.acceptFormats.split(',').map(ext => ext.trim());
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedExtensions.includes(fileExt)) {
            Notification.show(`不支持的文件格式: ${fileExt}`, 'error');
            return;
        }

        // 清除地图上的演示数据（林场边界、火点标记等）
        const mapId = `${type}AnalysisMap`;
        const map = window.maps?.[mapId];
        if (map && typeof window.clearDemoLayers === 'function') {
            window.clearDemoLayers(map);
            this.log(`已清除 ${type} 地图上的演示图层`);
        }

        // 更新UI显示文件信息
        this.updateUploadStatus(type, file);

        try {
            // 检查后端服务可用性
            const isBackendAvailable = await this.checkBackendAvailability();

            if (isBackendAvailable) {
                await this.uploadToServer(file, type);
            } else {
                this.simulateUploadSuccess(file, type);
            }
        } catch (error) {
            this.log(`处理错误: ${error.message}`);
            Notification.show(`处理失败: ${error.message}`, 'error');
            this.simulateUploadSuccess(file, type); // 即使出错也允许演示模式
        }
    }

    /**
     * 上传到服务器
     */
    async uploadToServer(file, type) {
        const formData = new FormData();
        formData.append('file', file);

        Notification.show(`正在上传 ${file.name}...`, 'info');
        this.log('开始上传到服务器...');

        const response = await fetch(RemoteSensingAPI.BASE_URL + RemoteSensingAPI.ENDPOINTS.UPLOAD, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP错误! 状态码: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            const module = this.modules[type];
            module.state.uploadedFile = result.filepath;
            Notification.show(`${file.name} 上传成功！`, 'success');
            this.displayMetadata(type, result.metadata);

            // 上传成功后，请求预览并在地图上显示
            await this.showImageOnMap(type, result.filepath);
        } else {
            throw new Error(result.error || '服务器返回错误');
        }
    }

    /**
     * 请求影像预览并在地图上叠加显示
     */
    async showImageOnMap(type, filepath) {
        try {
            this.log(`请求影像预览: ${filepath}`);

            const response = await fetch(RemoteSensingAPI.BASE_URL + '/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filepath })
            });

            if (!response.ok) {
                throw new Error(`预览请求失败: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // preview_url 是相对路径如 /api/result/preview_xxx.png，需要加上BASE_URL
                const fullPreviewUrl = RemoteSensingAPI.BASE_URL + result.preview_url;
                this.displayImageOverlay(type, fullPreviewUrl, result.bounds);
            } else {
                this.log(`预览失败: ${result.error}`);
            }
        } catch (error) {
            this.log(`显示影像失败: ${error.message}`);
            // 预览失败不影响主流程
        }
    }

    /**
     * 在Leaflet地图上叠加显示影像
     */
    async displayImageOverlay(type, previewUrl, bounds) {
        const mapId = `${type}AnalysisMap`;
        let map = window.maps?.[mapId];

        // 如果地图未初始化，尝试自动初始化
        if (!map) {
            const mapEl = document.getElementById(mapId);
            if (mapEl && typeof createMap === 'function') {
                this.log(`自动初始化地图: ${mapId}`);
                map = createMap(mapId);
                if (typeof addForestLayers === 'function') addForestLayers(map);
                // 延迟确保地图渲染完成
                await new Promise(r => setTimeout(r, 300));
            }
        }

        if (!map) {
            this.log(`地图 ${mapId} 无法初始化，跳过影像叠加`);
            return;
        }

        // 移除旧的影像图层
        if (!this.imageLayers) this.imageLayers = {};
        if (this.imageLayers[type]) {
            map.removeLayer(this.imageLayers[type]);
        }

        // 创建影像边界 [南西, 北东]
        const imageBounds = [
            [bounds.south, bounds.west],
            [bounds.north, bounds.east]
        ];

        // 添加影像叠加层
        this.imageLayers[type] = L.imageOverlay(previewUrl, imageBounds, {
            opacity: 0.75,
            interactive: true
        }).addTo(map);

        // 缩放到影像范围
        map.fitBounds(imageBounds, { padding: [20, 20] });

        this.log(`影像已叠加到地图 ${mapId}`);
        Notification.show('影像已显示在地图上', 'success');
    }

    /**
     * 模拟上传成功（演示模式）
     */
    simulateUploadSuccess(file, type) {
        const module = this.modules[type];
        module.state.uploadedFile = `mock_${file.name}`;
        module.state.fileObject = file;  // 保存真实File对象，后端可用时重新上传
        Notification.show(`演示模式：${file.name} 已就绪`, 'warning');

        // 显示模拟元数据
        const mockMetadata = {
            width: 1024,
            height: 1024,
            count: 7,
            crs: 'EPSG:4326',
            bounds: [106.705, 26.628, 106.755, 26.668],
            dtype: 'float32'
        };

        this.displayMetadata(type, mockMetadata);
    }

    /**
     * 更新上传状态UI
     */
    updateUploadStatus(type, file) {
        const statusDiv = document.getElementById(`${type}FileInfo`);
        const fileNameSpan = document.getElementById(`${type}FileName`);
        const fileSizeSpan = document.getElementById(`${type}FileSize`);
        const uploadContent = document.querySelector(`#${type}ImageUpload .upload-content`);

        if (statusDiv && fileNameSpan && fileSizeSpan) {
            statusDiv.style.display = 'flex';
            fileNameSpan.textContent = file.name;
            fileSizeSpan.textContent = this.formatFileSize(file.size);
            if (uploadContent) uploadContent.style.display = "none";
        }
    }

    /**
     * 显示元数据
     */
    displayMetadata(type, metadata) {
        if (!metadata) return;

        this.log(`${type} 元数据显示:`, metadata);
        // 可以在这里添加元数据的UI展示逻辑
    }

    /**
     * 执行分析
     */
    async executeAnalysis(type) {
        const module = this.modules[type];
        if (!module) return;

        if (!module.state.uploadedFile) {
            Notification.show('请先上传遥感影像', 'warning');
            return;
        }

        if (module.state.isAnalyzing) {
            Notification.show('分析进行中，请稍候...', 'info');
            return;
        }

        module.state.isAnalyzing = true;
        const btn = document.getElementById(`${type}AnalysisBtn`);
        if (btn) {
            btn.disabled = true;
            btn.textContent = `⏳ 分析中...`;
        }

        try {
            const params = this.collectParams(type);

            Notification.show(`正在执行${module.config.name}...`, 'info');
            this.log(`开始执行 ${type} 分析...`);

            // 尝试调用真实API
            const isBackendAvailable = await this.checkBackendAvailability();
            let result;

            if (isBackendAvailable) {
                // 如果是演示模式上传的(mock_前缀)，后端现在可用，重新上传真实文件
                if (module.state.uploadedFile && module.state.uploadedFile.startsWith('mock_') && module.state.fileObject) {
                    this.log('后端已就绪，重新上传真实文件...');
                    Notification.show('检测到后端服务，正在上传真实文件...', 'info');
                    try {
                        await this.uploadToServer(module.state.fileObject, type);
                    } catch (uploadErr) {
                        this.log(`重新上传失败: ${uploadErr.message}，继续使用演示模式`);
                    }
                }
                // 若上传成功后filepath已更新为真实路径
                if (module.state.uploadedFile && !module.state.uploadedFile.startsWith('mock_')) {
                    const realParams = this.collectParams(type);
                    result = await this.callAnalysisAPI(type, realParams);
                } else {
                    // 重新上传仍失败，降级到演示模式
                    result = module.config.mockDataGenerator();
                    this.log('后端模式下文件路径无效，降级到演示数据');
                }
            } else {
                // 使用模拟数据
                result = module.config.mockDataGenerator();
                this.log('使用模拟数据进行演示');
            }

            // 渲染结果
            module.config.resultRenderer(result);
            module.state.result = result;

            Notification.show(`${module.config.name}完成！`, 'success');

        } catch (error) {
            this.log(`分析错误: ${error.message}`);
            Notification.show(`分析失败: ${error.message}`, 'error');

            // 出错时也显示模拟结果
            const mockResult = module.config.mockDataGenerator();
            module.config.resultRenderer(mockResult);
            module.state.result = mockResult;

        } finally {
            module.state.isAnalyzing = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = module.config.buttonText;
            }
        }
    }

    /**
     * 收集参数
     */
    collectParams(type) {
        const module = this.modules[type];
        const params = {
            filepath: module.state.uploadedFile
        };

        for (const param of module.config.params) {
            const element = document.getElementById(param.id);
            if (element) {
                let value = element.value;
                if (param.type === 'number') {
                    value = parseFloat(value);
                }
                params[param.id] = value;
            }
        }

        this.log(`收集参数 (${type}):`, params);
        return params;
    }

    /**
     * 调用分析API（自动映射前端参数名到后端参数名）
     */
    async callAnalysisAPI(type, params) {
        // 前端参数名(HTML元素ID) → 后端参数名的映射
        const paramMappings = {
            fire: {
                thermalBand: 'thermal_band',
                nirBandFire: 'nir_band',
                redBandFire: 'red_band',
                tempThreshold: 'temp_threshold',
                ndviThresholdFire: 'ndvi_threshold'
            },
            ndvi: {
                nirBandNdvi: 'nir_band',
                redBandNdvi: 'red_band'
            },
            fvc: {
                nirBandFvc: 'nir_band',
                redBandFvc: 'red_band',
                ndviSoil: 'ndvi_soil',
                ndviVeg: 'ndvi_veg'
            }
        };

        const mapping = paramMappings[type] || {};
        const backendParams = {};
        for (const [key, value] of Object.entries(params)) {
            backendParams[mapping[key] || key] = value;
        }

        this.log(`发送给后端的参数 (${type}):`, backendParams);

        const response = await fetch(RemoteSensingAPI.BASE_URL + this.modules[type].config.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backendParams)
        });

        if (!response.ok) {
            throw new Error(`HTTP错误! 状态码: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'API返回错误');
        }

        return result;
    }

    /**
     * 重置参数
     */
    resetParams(type) {
        const module = this.modules[type];
        if (!module) return;

        for (const param of module.config.params) {
            const element = document.getElementById(param.id);
            if (element) {
                element.value = param.default || '';
            }
        }

        Notification.show('参数已重置为默认值', 'info');
        this.log(`${type} 参数已重置`);
    }

    /**
     * 检查后端服务可用性
     */
    async checkBackendAvailability() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(RemoteSensingAPI.BASE_URL + RemoteSensingAPI.ENDPOINTS.HEALTH, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * 工具函数：格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 日志输出
     */
    log(message, ...args) {
        if (this.debugMode) {
            console.log(`[遥感分析引擎] ${message}`, ...args);
        }
    }
}

// ==================== 结果渲染器 ====================

/**
 * 渲染火情分析结果
 */
function renderFireResult(result) {
    const panel = document.getElementById('fireResultPanel');
    const content = document.getElementById('fireResultContent');
    const toggle = document.getElementById('fireResultToggle');

    if (!panel || !content) return;

    const stats = result.statistics;

    content.innerHTML = `
        <div class="result-summary" style="margin-bottom:16px;">
            <div class="result-item">
                <span class="result-label">风险等级</span>
                <span class="result-value ${getRiskLevelClass(stats.fire_risk_level)}">${stats.fire_risk_level}</span>
            </div>
            <div class="result-item">
                <span class="result-label">火点数量</span>
                <span class="result-value red">${stats.total_fire_points.toLocaleString()}</span>
            </div>
            <div class="result-item">
                <span class="result-label">估算面积</span>
                <span class="result-value orange">${stats.estimated_area_hectares} 公顷</span>
            </div>
        </div>

        <div style="margin-bottom:16px;">
            <h4 style="font-size:12px;color:#4fc3f7;margin-bottom:8px;">温度统计</h4>
            <div class="temp-stats" style="background:rgba(255,61,61,0.1);padding:10px;border-radius:4px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
                    <span style="color:#90a4ae;">平均温度:</span>
                    <span style="color:#ff5252;">${stats.temperature_stats.average_temp_c}°C (${stats.temperature_stats.average_temp_k}K)</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:11px;">
                    <span style="color:#90a4ae;">最高温度:</span>
                    <span style="color:#ff1744;">${stats.temperature_stats.max_temp_c}°C (${stats.temperature_stats.max_temp_k}K)</span>
                </div>
            </div>
        </div>

        <div style="margin-bottom:16px;">
            <h4 style="font-size:12px;color:#4fc3f7;margin-bottom:8px;">火情强度分布</h4>
            <div class="intensity-distribution">
                ${renderDistributionItem('#ffff00', '低强度', stats.fire_intensity_distribution.low_intensity)}
                ${renderDistributionItem('#ffa500', '中强度', stats.fire_intensity_distribution.mid_intensity)}
                ${renderDistributionItem('#ff0000', '高强度', stats.fire_intensity_distribution.high_intensity)}
            </div>
        </div>

        ${stats.fire_center ? `
        <div style="margin-bottom:16px;">
            <h4 style="font-size:12px;color:#4fc3f7;margin-bottom:8px;">火场中心坐标</h4>
            <div style="font-size:11px;font-family:monospace;background:rgba(79,195,247,0.1);padding:8px;border-radius:4px;">
                纬度: ${stats.fire_center[0].toFixed(6)}<br>
                经度: ${stats.fire_center[1].toFixed(6)}
            </div>
        </div>
        ` : ''}
    `;

    panel.style.display = 'block';
    toggle.style.display = 'block';
}

/**
 * 渲染NDVI分析结果
 */
function renderNdviResult(result) {
    const panel = document.getElementById('ndviResultPanel');
    const content = document.getElementById('ndviResultContent');
    const toggle = document.getElementById('ndviResultToggle');

    if (!panel || !content) return;

    const stats = result.statistics;
    const vegClass = result.vegetation_classification;

    content.innerHTML = `
        <div class="result-summary" style="margin-bottom:16px;">
            <div class="result-item">
                <span class="result-label">平均NDVI</span>
                <span class="result-value green">${stats.mean}</span>
            </div>
            <div class="result-item">
                <span class="result-label">标准差</span>
                <span class="result-value blue">${stats.std}</span>
            </div>
            <div class="result-item">
                <span class="result-label">有效像素</span>
                <span class="result-value">${stats.valid_pixel_count.toLocaleString()}</span>
            </div>
        </div>

        <div style="margin-bottom:16px;">
            <h4 style="font-size:12px;color:#4fc3f7;margin-bottom:8px;">植被覆盖分类统计</h4>
            <div class="veg-classification">
                ${Object.entries(vegClass).map(([key, value]) => `
                <div class="class-item" style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="flex:1;">
                        <span style="font-size:11px;display:block;">${value.description}</span>
                        <span style="font-size:9px;color:#78909c;">${value.range}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="color:#4fc3f7;font-size:11px;">${value.percentage}%</span>
                        <span style="color:#90a4ae;font-size:9px;display:block;">(${value.count.toLocaleString()} px)</span>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>

        <div style="margin-bottom:16px;">
            <h4 style="font-size:12px;color:#4fc3f7;margin-bottom:8px;">NDVI值范围</h4>
            <div style="display:flex;gap:8px;font-size:10px;">
                ${renderStatBox('rgba(255,0,0,0.2)', '#ef5350', stats.min, '最小值')}
                ${renderStatBox('rgba(255,255,0,0.2)', '#ffee58', stats.median, '中位数')}
                ${renderStatBox('rgba(0,200,83,0.2)', '#69f0ae', stats.max, '最大值')}
            </div>
        </div>
    `;

    panel.style.display = 'block';
    toggle.style.display = 'block';
}

/**
 * 渲染FVC分析结果
 */
function renderFvcResult(result) {
    const panel = document.getElementById('fvcResultPanel');
    const content = document.getElementById('fvcResultContent');
    const toggle = document.getElementById('fvcResultToggle');

    if (!panel || !content) return;

    const stats = result.statistics;
    const coverClass = result.coverage_classification;

    content.innerHTML = `
        <div class="result-summary" style="margin-bottom:16px;">
            <div class="result-item">
                <span class="result-label">平均覆盖度</span>
                <span class="result-value green">${stats.mean_percentage}%</span>
            </div>
            <div class="result-item">
                <span class="result-label">总体覆盖率</span>
                <span class="result-value blue">${stats.vegetation_coverage_rate}%</span>
            </div>
            <div class="result-item">
                <span class="result-label">有效像素</span>
                <span class="result-value">${stats.valid_pixel_count.toLocaleString()}</span>
            </div>
        </div>

        <!-- 覆盖度进度条 -->
        <div style="margin-bottom:16px;">
            <h4 style="font-size:12px;color:#4fc3f7;margin-bottom:8px;">植被覆盖度分布</h4>
            <div style="background:linear-gradient(to right, #d32f2f 0%, #f57c00 20%, #fbc02d 40%, #388e3c 60%, #1976d2 80%, #7b1fa2 100%);height:20px;border-radius:10px;position:relative;">
                <div style="position:absolute;top:-20px;left:${Math.min(stats.mean_fvc * 100, 98)}%;transform:translateX(-50%);">
                    <span style="background:#fff;color:#333;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:bold;white-space:nowrap;">
                        ${stats.mean_percentage}%
                    </span>
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:9px;color:#78909c;margin-top:4px;">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
        </div>

        <div style="margin-bottom:16px;">
            <h4 style="font-size:12px;color:#4fc3f7;margin-bottom:8px;">覆盖等级统计</h4>
            <div class="coverage-classification">
                ${Object.entries(coverClass).map(([key, value]) => `
                <div class="class-item" style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="flex:1;display:flex;align-items:center;">
                        <span style="display:inline-block;width:40px;height:8px;background:${getCoverageColor(key)};border-radius:2px;margin-right:8px;"></span>
                        <span style="font-size:11px;">${value.description}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="color:#66bb6a;font-size:11px;">${value.percentage}%</span>
                        <span style="color:#90a4ae;font-size:9px;display:block;">(${value.count.toLocaleString()} px)</span>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>

        <div style="margin-bottom:16px;">
            <h4 style="font-size:12px;color:#4fc3f7;margin-bottom:8px;">统计摘要</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">
                ${renderStatGridItem('rgba(76,175,80,0.1)', '#81c784', stats.min.toFixed(3), '最小值')}
                ${renderStatGridItem('rgba(33,150,243,0.1)', '#64b5f6', stats.max.toFixed(3), '最大值')}
                ${renderStatGridItem('rgba(255,152,0,0.1)', '#ffb74d', stats.median.toFixed(3), '中位数')}
                ${renderStatGridItem('rgba(156,39,176,0.1)', '#ba68c8', '±' + stats.std.toFixed(3), '标准差')}
            </div>
        </div>
    `;

    panel.style.display = 'block';
    toggle.style.display = 'block';
}

// ==================== 辅助渲染函数 ====================

function renderDistributionItem(color, label, value) {
    return `
    <div class="dist-item" style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="font-size:11px;"><span style="display:inline-block;width:12px;height:12px;background:${color};border-radius:2px;margin-right:6px;"></span>${label}</span>
        <span style="color:#ffd54f;font-size:11px;">${value.toLocaleString()} 个像素</span>
    </div>`;
}

function renderStatBox(bgColor, textColor, value, label) {
    return `
    <div style="flex:1;text-align:center;padding:6px;background:${bgColor};border-radius:4px;">
        <div style="color:${textColor};font-weight:bold;">${value}</div>
        <div style="color:#90a4ae;">${label}</div>
    </div>`;
}

function renderStatGridItem(bgColor, textColor, value, label) {
    return `
    <div style="background:${bgColor};padding:8px;border-radius:4px;text-align:center;">
        <div style="color:${textColor};font-weight:bold;">${value}</div>
        <div style="color:#90a4ae;">${label}</div>
    </div>`;
}

function getRiskLevelClass(level) {
    switch(level) {
        case '无火情': return 'green';
        case '低危': return 'blue';
        case '中危': return 'orange';
        case '高危':
        case '极高危': return 'red';
        default: return 'blue';
    }
}

function getCoverageColor(key) {
    const colors = {
        'bare_land': '#d32f2f',
        'low_coverage': '#f57c00',
        'medium_low_coverage': '#fbc02d',
        'medium_coverage': '#388e3c',
        'high_coverage': '#1976d2',
        'full_coverage': '#7b1fa2'
    };
    return colors[key] || '#90a4ae';
}

// ==================== 模拟数据生成器 ====================

function generateMockFireResult() {
    return {
        success: true,
        statistics: {
            total_fire_points: 1247,
            estimated_area_hectares: 112.23,
            fire_risk_level: '高危',
            fire_intensity_distribution: {
                low_intensity: 456,
                mid_intensity: 523,
                high_intensity: 268
            },
            temperature_stats: {
                average_temp_c: 67.8,
                average_temp_k: 340.95,
                max_temp_c: 89.5,
                max_temp_k: 362.65
            },
            fire_center: [26.643, 106.718]
        }
    };
}

function generateMockNdviResult() {
    return {
        success: true,
        statistics: {
            mean: 0.6834,
            std: 0.1823,
            min: -0.3421,
            max: 0.9234,
            median: 0.7156,
            valid_pixel_count: 1048576
        },
        vegetation_classification: {
            water_snow_cloud: { range: '< 0', count: 52341, percentage: 4.99, description: '水体、云、雪' },
            bare_soil_building: { range: '0 - 0.2', count: 78456, percentage: 7.48, description: '裸土、建筑物' },
            sparse_vegetation: { range: '0.2 - 0.4', count: 112345, percentage: 10.71, description: '稀疏植被' },
            moderate_vegetation: { range: '0.4 - 0.6', count: 198765, percentage: 18.95, description: '中等植被' },
            dense_vegetation: { range: '0.6 - 0.8', count: 456789, percentage: 43.56, description: '密集植被' },
            very_dense_vegetation: { range: '> 0.8', count: 149880, percentage: 14.29, description: '非常密集植被' }
        }
    };
}

function generateMockFvcResult() {
    return {
        success: true,
        statistics: {
            mean_fvc: 0.7234,
            mean_percentage: 72.34,
            vegetation_coverage_rate: 78.56,
            std: 0.2134,
            min: 0.0012,
            max: 0.9987,
            median: 0.7567,
            valid_pixel_count: 1048576
        },
        coverage_classification: {
            bare_land: { range: '0 - 0.1', count: 45678, percentage: 4.36, description: '裸地' },
            low_coverage: { range: '0.1 - 0.3', count: 89234, percentage: 8.51, description: '低覆盖' },
            medium_low_coverage: { range: '0.3 - 0.5', count: 134567, percentage: 12.83, description: '中低覆盖' },
            medium_coverage: { range: '0.5 - 0.7', count: 201890, percentage: 19.25, description: '中等覆盖' },
            high_coverage: { range: '0.7 - 0.9', count: 423456, percentage: 40.39, description: '高覆盖' },
            full_coverage: { range: '0.9 - 1.0', count: 153751, percentage: 14.66, description: '全覆盖' }
        }
    };
}

// ==================== 通知系统 ====================

const Notification = {
    show(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${this.getIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;padding:0 4px;">✕</button>
        `;

        Object.assign(notification.style, {
            position: 'fixed',
            top: '80px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: '10000',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            maxWidth: '400px',
            animation: 'slideInRight 0.3s ease-out'
        });

        const colors = {
            info: 'rgba(33, 150, 243, 0.95)',
            success: 'rgba(76, 175, 80, 0.95)',
            warning: 'rgba(255, 152, 0, 0.95)',
            error: 'rgba(244, 67, 54, 0.95)'
        };
        notification.style.background = colors[type] || colors.info;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
                setTimeout(() => notification.remove(), 300);
            }
        }, 4000);
    },

    getIcon(type) {
        const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
        return icons[type] || icons.info;
    }
};

// ==================== 全局实例和接口 ====================

// 创建全局引擎实例
const analysisEngine = new AnalysisEngine();

// 页面加载完成后自动初始化
document.addEventListener('DOMContentLoaded', () => {
    analysisEngine.init().then(() => {
        console.log('%c[遥感分析]%c 引擎就绪 ✅', 'color:#4fc3f7;font-weight:bold', 'color:#69f0ae');
    });
});

// 导出全局函数供HTML调用
window.executeFireAnalysis = () => analysisEngine.executeAnalysis('fire');
window.executeNdviAnalysis = () => analysisEngine.executeAnalysis('ndvi');
window.executeFvcAnalysis = () => analysisEngine.executeAnalysis('fvc');
window.resetFireParams = () => analysisEngine.resetParams('fire');
window.resetNdviParams = () => analysisEngine.resetParams('ndvi');
window.resetFvcParams = () => analysisEngine.resetParams('fvc');

// 兼容旧的事件处理函数（已弃用）
window.handleDragOver = function(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
};
window.handleDragLeave = function(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
};
window.handleFileDrop = function(event, type) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
};
window.handleFileSelect = function(event, type) {
    // 已由引擎内部处理
};

// 注入样式
(function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        /* 简洁的上传区域样式 */
        .upload-area {
            border: 2px dashed rgba(79, 195, 247, 0.3);
            border-radius: 8px;
            padding: 16px;
            background: rgba(10, 22, 40, 0.4);
            cursor: pointer;
            transition: all 0.25s ease;
            position: relative;
        }
        .upload-area:hover {
            border-color: #4fc3f7;
            background: rgba(79, 195, 247, 0.08);
        }
        .upload-area input[type="file"] { display: none; }

        .upload-content {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .upload-icon {
            font-size: 28px;
            flex-shrink: 0;
        }

        .upload-info {
            flex: 1;
            text-align: left;
            min-width: 0;
        }

        .upload-text {
            font-size: 13px;
            color: #c8d6e5;
            margin-bottom: 2px;
        }

        .upload-hint {
            font-size: 11px;
            color: #78909c;
        }

        .upload-btn {
            flex-shrink: 0;
            padding: 6px 16px;
            font-size: 12px;
        }

        /* 文件信息显示 */
        .file-info {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            background: rgba(79, 195, 247, 0.1);
            border-radius: 6px;
            margin-top: 8px;
            animation: fadeIn 0.3s ease;
        }

        .file-name {
            flex: 1;
            font-size: 12px;
            color: #4fc3f7;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .file-size {
            font-size: 11px;
            color: #90a4ae;
            flex-shrink: 0;
        }

        .btn-remove {
            width: 20px;
            height: 20px;
            border: none;
            background: rgba(239, 83, 80, 0.2);
            color: #ef5350;
            border-radius: 50%;
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
        }

        .btn-remove:hover {
            background: #ef5350;
            color: white;
        }
        .result-summary { padding: 12px; background: rgba(13, 27, 44, 0.8); border-radius: 6px; border: 1px solid rgba(79, 195, 247, 0.2); }
        .result-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .result-item:last-child { border-bottom: none; }
        .result-label { font-size: 11px; color: #90a4ae; }
        .result-value { font-size: 14px; font-weight: bold; }
        .result-value.red { color: #ef5350; }
        .result-value.orange { color: #ffb74d; }
        .result-value.green { color: #66bb6a; }
        .result-value.blue { color: #42a5f5; }
    `;
    document.head.appendChild(style);
})();
