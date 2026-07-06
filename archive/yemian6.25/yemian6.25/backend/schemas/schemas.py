"""Pydantic 请求/响应模型"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ==================== 认证 ====================
class LoginRequest(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    username: str
    role: str
    name: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    success: bool
    data: Optional[UserInfo] = None
    token: Optional[str] = None


# ==================== 林区配置 ====================
class ForestConfigOut(BaseModel):
    center: list[float]
    boundary: list[list[float]]


class CompartmentOut(BaseModel):
    name: str
    area_name: str = ""
    color: str = ""
    coords: list[list[float]]


# ==================== 护林员 ====================
class RangerOut(BaseModel):
    lat: float
    lng: float
    name: str
    id: str
    area: str = ""
    status: str = "离线"
    speed: str = "-"
    battery: str = "100%"


# ==================== 无人机 ====================
class DroneOut(BaseModel):
    lat: float
    lng: float
    name: str
    model: str = ""
    alt: str = "0m"
    heading: str = "N"
    battery: str = "100%"
    status: str = "待命"


# ==================== 火情 ====================
class FireOut(BaseModel):
    lat: float
    lng: float
    name: str
    level: str = "一般"
    area: str = ""
    time: str = ""
    status: str = ""


class FirePointOut(BaseModel):
    id: str
    level: str
    area: str = ""
    time: str = ""
    status: str = ""
    lng: float
    lat: float
    wind: str = ""
    spread: str = ""
    speed: str = ""
    affected: str = ""
    response: str = ""
    commander: str = ""
    forces: str = ""


# ==================== 虫害 ====================
class PestOut(BaseModel):
    lat: float
    lng: float
    area: str = ""
    areaSize: str = ""


# ==================== 巡护 ====================
class PatrolRouteOut(BaseModel):
    coords: list[list[float]]
    person: str = ""
    date: str = ""
    distance: str = ""


class PatrolTaskOut(BaseModel):
    task_code: str = ""
    name: str = ""
    executor: str = ""
    progress: int = 0
    status: str = ""


# ==================== 图像识别 ====================
class ImageRecognitionItem(BaseModel):
    id: str
    area: str = ""
    label: str = ""
    source: str = ""
    time: str = ""
    result: str = ""
    level: str = ""
    lat: str = ""
    lng: str = ""
    svgType: str = "normal"


class AnalyzeRequest(BaseModel):
    image: str  # base64


class AnalyzeResponse(BaseModel):
    success: bool
    result: str = ""
    confidence: float = 0
    level: str = ""


# ==================== 风险预警 ====================
class RiskItemOut(BaseModel):
    id: str
    area: str = ""
    type: str = ""
    level: str = ""
    score: float = 0
    desc: str = ""
    time: str = ""
    status: str = ""


class RiskSummary(BaseModel):
    total: int = 0
    high: int = 0
    mid: int = 0
    low: int = 0


class RiskAssessmentOut(BaseModel):
    summary: RiskSummary
    items: list[RiskItemOut]


# ==================== FVC空间分析 ====================
class FvcAreaItem(BaseModel):
    name: str
    fvc: float
    level: str
    areaHigh: float = 0
    areaMid: float = 0
    areaLow: float = 0
    areaBare: float = 0
    trend: str = ""


class FvcDegradedItem(BaseModel):
    area: str
    fvc: float
    level: str
    lat: float
    lng: float


class FvcAnalysisOut(BaseModel):
    areas: list[FvcAreaItem]
    degradedAreas: list[FvcDegradedItem]


class FvcResultData(BaseModel):
    avgFvc: float
    totalArea: float
    highCoverArea: float
    midCoverArea: float
    lowCoverArea: float
    bareArea: float
    degradedCount: int
    areas: list[FvcAreaItem]
    degradedAreas: list[FvcDegradedItem]


class FvcResultOut(BaseModel):
    success: bool
    data: FvcResultData


# ==================== 异常事件 ====================
class AbnormalEventItem(BaseModel):
    id: str
    type: str = ""
    area: str = ""
    desc: str = ""
    level: str = ""
    time: str = ""
    status: str = ""
    handler: str = ""


class CreateEventRequest(BaseModel):
    event_type: str
    area_name: str = ""
    description: str = ""
    level: str = "low"
    handler: str = ""
    lat: float = 0
    lng: float = 0


class CreateEventResponse(BaseModel):
    success: bool
    id: str = ""


# ==================== 统计报表 ====================
class StatsOverviewOut(BaseModel):
    patrolCount: int = 0
    onlineRangers: int = 0
    onlineDrones: int = 0
    patrolDistance: float = 0
    patrolDuration: float = 0
    taskCount: int = 0
    fireCount: int = 0
    pestCount: int = 0
    abnormalCount: int = 0
    unhandledCount: int = 0


class PatrolStatsOut(BaseModel):
    totalPatrols: int = 0
    totalDistance: float = 0
    totalDuration: float = 0
    dailyTrend: list[int] = []
    weeklyTrend: list[int] = []
    areaDistribution: list[dict] = []


class PerformanceItem(BaseModel):
    rank: int
    name: str
    id: str
    patrols: int
    distance: float
    duration: float
    score: float
    area: str = ""


class DroneStatsOut(BaseModel):
    totalFlights: int = 0
    totalDuration: float = 0
    totalDistance: float = 0
    fleet: list[dict] = []


class DisasterStatsOut(BaseModel):
    fireCount: int = 0
    pestCount: int = 0
    geoCount: int = 0
    totalAffected: float = 0
    monthlyTrend: list[int] = []
    typeDistribution: list[dict] = []


class ExportRequest(BaseModel):
    type: str
    format: str


class ExportResponse(BaseModel):
    success: bool
    url: str = ""


# ==================== 用户管理 ====================
class UserItemOut(BaseModel):
    id: str
    username: str
    name: str
    role: str
    status: str
    lastLogin: str = ""


class CreateUserRequest(BaseModel):
    username: str
    password: str
    name: str
    role: str = "ranger"


class UpdateUserRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None


class SuccessResponse(BaseModel):
    success: bool
    id: Optional[str] = None


# ==================== 角色管理 ====================
class RoleItemOut(BaseModel):
    id: str
    name: str
    label: str
    desc: str
    userCount: int = 0


class CreateRoleRequest(BaseModel):
    name: str
    label: str = ""
    desc: str = ""


class UpdateRoleRequest(BaseModel):
    name: Optional[str] = None
    label: Optional[str] = None
    desc: Optional[str] = None


# ==================== 权限管理 ====================
class PermissionItemOut(BaseModel):
    module: str
    admin: bool = False
    ranger: bool = False
    guest: bool = False


class UpdatePermissionRequest(BaseModel):
    admin: bool = False
    ranger: bool = False
    guest: bool = False


# ==================== 数据运维 ====================
class DataOpsOut(BaseModel):
    lastBackup: str = ""
    backupSize: str = ""
    dbStatus: str = ""
    storageUsed: str = ""
    recentOps: list[dict] = []


class BackupRequest(BaseModel):
    type: str = "full"


# ==================== 日志 ====================
class LogItemOut(BaseModel):
    time: str
    user: str
    action: str
    module: str
    ip: str


# ==================== 系统监控 ====================
class ServiceItem(BaseModel):
    name: str
    status: str
    port: int
    cpu: float
    memory: float


class SystemMonitorOut(BaseModel):
    cpu: float = 0
    memory: float = 0
    disk: float = 0
    network: float = 0
    uptime: str = ""
    services: list[ServiceItem] = []
