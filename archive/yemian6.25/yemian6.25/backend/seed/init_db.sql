-- ============================================================
-- 云山智巡 数据库初始化脚本
-- 使用方法：psql -U postgres -d forest_patrol -f init_db.sql
-- ============================================================

-- 1. 扩展
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 2. 建表
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'ranger' CHECK (role IN ('admin','ranger','guest')),
    status VARCHAR(10) DEFAULT '离线',
    phone VARCHAR(20) DEFAULT '',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 林区表
CREATE TABLE IF NOT EXISTS forest_areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    boundary GEOGRAPHY(POLYGON, 4326) NOT NULL
);

-- 林班表
CREATE TABLE IF NOT EXISTS compartments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    area_name VARCHAR(50) NOT NULL DEFAULT '',
    color VARCHAR(10) NOT NULL DEFAULT '',
    geom GEOGRAPHY(POLYGON, 4326) NOT NULL
);

-- 护林员表
CREATE TABLE IF NOT EXISTS rangers (
    id SERIAL PRIMARY KEY,
    staff_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) DEFAULT '',
    area_name VARCHAR(50) NOT NULL,
    status VARCHAR(10) DEFAULT '离线',
    speed VARCHAR(10) DEFAULT '-',
    battery VARCHAR(10) DEFAULT '100%',
    location GEOGRAPHY(POINT, 4326),
    last_online TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 无人机表
CREATE TABLE IF NOT EXISTS drones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL,
    model VARCHAR(50) NOT NULL,
    alt VARCHAR(10) DEFAULT '0m',
    heading VARCHAR(10) DEFAULT 'N',
    battery VARCHAR(10) DEFAULT '100%',
    status VARCHAR(20) DEFAULT '待命',
    flight_hours DOUBLE PRECISION DEFAULT 0,
    location GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 火情表
CREATE TABLE IF NOT EXISTS fires (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    level VARCHAR(10) NOT NULL CHECK (level IN ('一般','较大','重大')),
    area_name VARCHAR(50),
    report_time VARCHAR(20),
    status VARCHAR(20) DEFAULT '待处置',
    wind_direction VARCHAR(20),
    spread_direction VARCHAR(50),
    spread_speed VARCHAR(20),
    affected_area VARCHAR(20),
    response_plan TEXT,
    commander VARCHAR(20),
    forces TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 火情详情点表
CREATE TABLE IF NOT EXISTS fire_points (
    id SERIAL PRIMARY KEY,
    fire_name VARCHAR(20) NOT NULL,
    level VARCHAR(10) NOT NULL,
    area_name VARCHAR(50),
    report_time VARCHAR(20),
    status VARCHAR(20),
    lng DOUBLE PRECISION NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    wind_direction VARCHAR(20),
    spread_direction VARCHAR(50),
    spread_speed VARCHAR(20),
    affected_area VARCHAR(20),
    response_plan TEXT,
    commander VARCHAR(20),
    forces TEXT
);

-- 虫害表
CREATE TABLE IF NOT EXISTS pests (
    id SERIAL PRIMARY KEY,
    area_name VARCHAR(50) NOT NULL,
    area_size VARCHAR(10),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 巡护路线表
CREATE TABLE IF NOT EXISTS patrol_routes (
    id SERIAL PRIMARY KEY,
    route_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    route_type VARCHAR(20) NOT NULL,
    length_km DOUBLE PRECISION DEFAULT 0,
    status VARCHAR(10) DEFAULT '启用',
    person VARCHAR(50),
    path GEOGRAPHY(LINESTRING, 4326),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 巡护任务表
CREATE TABLE IF NOT EXISTS patrol_tasks (
    id SERIAL PRIMARY KEY,
    task_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    task_type VARCHAR(20) DEFAULT '日常巡护',
    assigned_ranger VARCHAR(50),
    assigned_drone VARCHAR(50),
    area_name VARCHAR(50) NOT NULL,
    description TEXT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    progress INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT '待执行',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 巡护日志表
CREATE TABLE IF NOT EXISTS patrol_logs (
    id SERIAL PRIMARY KEY,
    patrol_date VARCHAR(10) NOT NULL,
    person VARCHAR(50) NOT NULL,
    area_name VARCHAR(50) NOT NULL,
    duration_h DOUBLE PRECISION DEFAULT 0,
    distance_km DOUBLE PRECISION DEFAULT 0,
    findings TEXT DEFAULT '无异常',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 异常事件表
CREATE TABLE IF NOT EXISTS abnormal_events (
    id SERIAL PRIMARY KEY,
    event_code VARCHAR(20) UNIQUE NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    area_name VARCHAR(50),
    description VARCHAR(255),
    level VARCHAR(10) DEFAULT 'low',
    report_time VARCHAR(30),
    status VARCHAR(20) DEFAULT '待处置',
    handler VARCHAR(50),
    location GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 风险预警表
CREATE TABLE IF NOT EXISTS risk_assessments (
    id SERIAL PRIMARY KEY,
    risk_code VARCHAR(20) UNIQUE NOT NULL,
    area_name VARCHAR(50) NOT NULL,
    risk_type VARCHAR(50) NOT NULL,
    level VARCHAR(10) NOT NULL,
    score DOUBLE PRECISION DEFAULT 0,
    description VARCHAR(255),
    report_time VARCHAR(30),
    status VARCHAR(20) DEFAULT '监控中',
    created_at TIMESTAMP DEFAULT NOW()
);

-- FVC植被覆盖度表
CREATE TABLE IF NOT EXISTS fvc_analysis (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    fvc DOUBLE PRECISION DEFAULT 0,
    level VARCHAR(20),
    area_high DOUBLE PRECISION DEFAULT 0,
    area_mid DOUBLE PRECISION DEFAULT 0,
    area_low DOUBLE PRECISION DEFAULT 0,
    area_bare DOUBLE PRECISION DEFAULT 0,
    trend VARCHAR(10)
);

-- FVC退化区域表
CREATE TABLE IF NOT EXISTS fvc_degraded (
    id SERIAL PRIMARY KEY,
    area_name VARCHAR(100),
    fvc DOUBLE PRECISION DEFAULT 0,
    level VARCHAR(20),
    lat DOUBLE PRECISION DEFAULT 0,
    lng DOUBLE PRECISION DEFAULT 0
);

-- 图像识别记录表
CREATE TABLE IF NOT EXISTS image_recognition (
    id SERIAL PRIMARY KEY,
    recognition_type VARCHAR(10) NOT NULL,  -- 'fire' or 'pest'
    area_name VARCHAR(50),
    label VARCHAR(100),
    source VARCHAR(50),
    time VARCHAR(10),
    result VARCHAR(50),
    level VARCHAR(10),
    lat VARCHAR(20),
    lng VARCHAR(20),
    svg_type VARCHAR(20) DEFAULT 'normal'
);

-- 系统日志表
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    log_time VARCHAR(30) NOT NULL,
    username VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50),
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 数据备份表
CREATE TABLE IF NOT EXISTS data_backups (
    id SERIAL PRIMARY KEY,
    backup_time VARCHAR(30) NOT NULL,
    backup_type VARCHAR(20) NOT NULL,
    status VARCHAR(10) DEFAULT '成功',
    size VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 3. 空间索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rangers_location ON rangers USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_drones_location ON drones USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_fires_location ON fires USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_pests_location ON pests USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_events_location ON abnormal_events USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_patrol_routes_path ON patrol_routes USING GIST(path);
CREATE INDEX IF NOT EXISTS idx_forest_areas_boundary ON forest_areas USING GIST(boundary);
CREATE INDEX IF NOT EXISTS idx_compartments_geom ON compartments USING GIST(geom);

-- ============================================================
-- 4. 种子数据
-- ============================================================

-- 用户（密码均为明文对应的 bcrypt hash，以下使用 passlib 生成）
-- admin/admin, guest/guest, 护林员密码均为 123456
-- 这些 hash 由 Python 种子脚本负责插入，此处省略
-- 如果需要在纯 SQL 中插入用户，请先通过 Python 生成 bcrypt hash
