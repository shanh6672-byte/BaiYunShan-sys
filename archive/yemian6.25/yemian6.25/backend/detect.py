"""
火焰/烟雾检测模型使用示例
模型: best(1)_corrected.pt (YOLOv8s, 检测 Fire 和 Smoke)
"""
from ultralytics import YOLO

# 1. 加载模型
model = YOLO(r"F:\qoderwork\best(1)_corrected.pt")

# 2. 对单张图片进行检测
results = model.predict(
    source=r"你的图片路径.jpg",   # ← 改成你要检测的图片路径
    conf=0.25,                    # 置信度阈值（低于此值的目标会被过滤）
    iou=0.7,                      # NMS 的 IoU 阈值
    save=True,                    # 自动保存标注后的图片
    project="fire_detection",     # 保存目录
    name="result",                # 保存子目录名
)

# 3. 打印检测结果
for result in results:
    for box in result.boxes:
        cls_id = int(box.cls[0])        # 类别编号 (0=Smoke, 1=Fire)
        cls_name = result.names[cls_id]  # 类别名称
        conf = float(box.conf[0])        # 置信度
        x1, y1, x2, y2 = box.xyxy[0].tolist()  # 检测框坐标
        print(f"检测到: {cls_name}, 置信度: {conf:.2f}, 位置: ({x1:.0f},{y1:.0f})-({x2:.0f},{y2:.0f})")
