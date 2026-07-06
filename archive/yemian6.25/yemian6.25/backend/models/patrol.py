"""巡护路线、任务、日志模型"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, func
from geoalchemy2 import Geography
from .database import Base


class PatrolRoute(Base):
    __tablename__ = "patrol_routes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    route_code = Column(String(20), unique=True, nullable=False)  # RT001
    name = Column(String(100), nullable=False)
    route_type = Column(String(20), nullable=False)  # 巡林员 / 无人机
    length_km = Column(Float, default=0)
    status = Column(String(10), default="启用")  # 启用 / 停用
    person = Column(String(50))
    path = Column(Geography("LINESTRING", srid=4326))
    created_at = Column(DateTime, server_default=func.now())


class PatrolTask(Base):
    __tablename__ = "patrol_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_code = Column(String(20), unique=True, nullable=False)  # T001
    name = Column(String(100), nullable=False)
    task_type = Column(String(20), default="日常巡护")  # 日常巡护 / 专项巡护 / 应急巡护
    assigned_ranger = Column(String(50))
    assigned_drone = Column(String(50))
    area_name = Column(String(50), nullable=False)
    description = Column(Text)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    progress = Column(Integer, default=0)  # 0-100
    status = Column(String(20), default="待执行")  # 待执行 / 执行中 / 已完成
    created_at = Column(DateTime, server_default=func.now())


class PatrolLog(Base):
    __tablename__ = "patrol_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patrol_date = Column(String(10), nullable=False)  # MM-DD
    person = Column(String(50), nullable=False)
    area_name = Column(String(50), nullable=False)
    duration_h = Column(Float, default=0)
    distance_km = Column(Float, default=0)
    findings = Column(Text, default="无异常")
    created_at = Column(DateTime, server_default=func.now())
