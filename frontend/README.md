# 🌲 云山智巡 — 白云山森林巡护管理系统

> BaiYunShan Forest Patrol Situation Awareness System

基于 Flask + Leaflet + PostgreSQL/PostGIS + GeoServer 的森林巡护态势感知平台。

---

## 🚀 快速启动

### 环境要求
- Python 3.10+
- PostgreSQL 14+ with PostGIS
- GeoServer 2.24+

### 启动步骤
```bash
# 1. 数据库
CREATE DATABASE baiyunshan;

# 2. 后端
cd backend
pip install -r requirements.txt
python app.py
# 运行在 http://localhost:5051
```

### GeoServer 配置
- 服务地址：`http://39.97.254.191:8080/geoserver`
- 工作区：`baiyunshan`
- 关键图层：`baiyun_boundary`（林场边界）、`baiyunshan_compartments1`（林区小班）、`dem`（高程）

### 打开系统
浏览器访问 `http://localhost:5051` → 登录 `admin / admin`

---

## 📁 项目结构

```
├── index.html              # 主页面（综合驾驶舱 + 四大模块）
├── mobile.html             # 移动端巡护页面
│
├── app.js                  # 主前端逻辑（驾驶舱/分析/地图/图层管理）
├── patrol-module.js        # 巡护监控与管理模块
├── geoserver-layers.js     # GeoServer WFS/WMS 图层加载
├── realtime.js             # SSE 实时推送
├── track-playback.js       # 历史轨迹回放
├── sync-positions.js       # 位置同步
│
├── map-facade.js           # 地图门面（多实例管理）
├── map-engine-leaflet.js   # Leaflet 地图引擎适配
├── style.css               # 全局样式
│
├── forest-ranger.png       # 护林员图标
├── drone.png               # 无人机图标
├── fire.png                # 火情图标
├── disease.png             # 虫害图标
├── logo.png                # 系统 Logo
│
├── backend/                # Flask 后端
│   ├── app.py              # 主应用（路由/模拟器/数据库）
│   ├── models.py           # SQLAlchemy 数据模型
│   ├── config.py           # 配置文件
│   ├── track_engine.py     # 轨迹生成引擎
│   ├── compartment_bounds.py # 林区边界数据
│   ├── requirements.txt    # Python 依赖
│   └── routes/
│       └── patrol_routes.py # 巡护模块 Blueprint
│
├── src/
│   ├── js/
│   │   ├── mock/           # 模拟数据（SHP图层/点位工厂）
│   │   │   └── ExperimentalLayerManager.js
│   │   ├── map/            # 地图模块（BaiyunshanMap/坐标转换/底图Provider）
│   │   └── page/
│   │       └── layer-switcher.js  # 图层管理-底图切换
│   └── css/
│       └── baiyunshan-map.css
│
├── static/images/          # 上传图片资源
├── forest_compartments/    # 林区分析数据
├── archive/                # 历史版本归档
│   └── yemian6.25/         # v6.25 旧版代码
│
└── .gitignore
```

---

## 🗺️ 功能模块

### 综合驾驶舱
- 实时地图（高德影像 默认 / OpenStreetMap 可选）
- 护林员/无人机在线统计与人员列表（实时同步巡护模块）
- 灾害态势总览（火情/虫害/异常事件数量，SSE实时更新）
- 实时警告面板

### 巡护监控与管理
- **实时巡护监控** — 护林员/无人机模拟移动，速度/电量/位置实时刷新
- **巡护覆盖分析** — 基于真实轨迹 + 白云山林场边界做缓冲区分析，计算覆盖率、盲区面积
- **巡护任务管理** — 任务发布 → 护林员手机接受 → 执行跟踪 → 完成，全流程
- **路线规划** — 手动绘制 + 自动生成 20 条预设路线（边界/之字/主干道/鱼骨 × 5林区）
- **历史轨迹查询** — 按人员/时段查询，护林员正弦蜿蜒路径，无人机回字折返路径
- **巡护力量台账** — 护林员档案 / 无人机设备 / 巡护队伍管理

### 空间数据分析
- **火情分析** — 按林区筛选火点，风险等级评估，火点数量同步火情事件列表
- **NDVI 分析** — 按年份（2021/2022）/林区，GeoServer WMS 栅格加载 + WCS 统计
- **FVC 植被覆盖度分析** — 同上

### 灾害识别处置
- 火情识别与上报（含图片上传 FormData）
- 虫害识别与上报
- 异常事件派发/处置流程
- SSE 实时推送新事件到所有在线客户端

### 移动端巡护（mobile.html）
- 护林员登录，查看分配给自己的任务
- 任务路线显示（黄色虚线 = 规划路线，绿色实线 = 实际轨迹）
- 点击"接受任务"后状态变为"进行中"，模拟器自动切换路线
- 拍照上传灾害事件（与主系统共用上报接口）
- 模拟 GPS 巡护 + 真实 GPS 双模式

---

## 🔧 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | 原生 JavaScript + Leaflet.js 1.9 |
| 图表 | ECharts 5.5 |
| GIS 分析 | Turf.js |
| 后端 | Flask + Flask-JWT-Extended + Flask-CORS |
| ORM | SQLAlchemy |
| 数据库 | PostgreSQL + PostGIS |
| 地图服务 | GeoServer (WMS / WFS / WCS) |
| 实时推送 | Server-Sent Events (SSE) |
| 空间计算 | Shapely（缓冲区/交集/盲区） |
| 坐标转换 | GCJ-02 ↔ WGS-84（CoordTransform） |
| 底图 | OpenStreetMap / 高德影像 |

---

## 📊 核心数据流

```
GeoServer (WMS/WFS)
     ↑ Flask 代理 /api/geoserver/*
     ↓
前端 geoserver-layers.js → Leaflet 地图
     ↓
Flask REST API → app.js / patrol-module.js
     ↓                    ↓
PostgreSQL ← 轨迹模拟器   SSE → 实时推送 → 所有客户端更新
     ↓
PatrolTrackPoint（历史轨迹查询）
RangerTrack / DroneTrack（实时位置）
FireEvent / PestEvent（灾害事件）
```

---

## 🔑 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin |
| 护林员 HL001 | HL001 | 123456 |

---

## 📝 Git 分支

| 分支 | 说明 |
|------|------|
| `main` | 主分支（当前最新稳定代码） |
| `develop` | 开发分支 |
| `patrol-module` | 巡护模块分支 |
| `feature/ai-recognition` | AI识别功能 |
| `feature/frontend-ui` | 前端UI |
| `feature/patrol-monitor` | 巡护监控 |

---

## 📄 License

教育用途 · 北京林业大学实习项目
