"""火情模型"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, func
from geoalchemy2 import Geography
from .database import Base


class Fire(Base):
    __tablename__ = "fires"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(20), nullable=False)  # F001
    location = Column(Geography("POINT", srid=4326), nullable=False)
    level = Column(String(10), nullable=False)  # 一般 / 较大 / 重大
    area_name = Column(String(50))
    report_time = Column(String(20))  # 上报时间字符串
    status = Column(String(20), default="待处置")  # 处置中 / 已派发 / 已控制
    wind_direction = Column(String(20))
    spread_direction = Column(String(50))
    spread_speed = Column(String(20))
    affected_area = Column(String(20))
    response_plan = Column(Text)
    commander = Column(String(20))
    forces = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class FirePoint(Base):
    """火情详情（逐点）"""
    __tablename__ = "fire_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fire_name = Column(String(20), nullable=False)
    level = Column(String(10), nullable=False)
    area_name = Column(String(50))
    report_time = Column(String(20))
    status = Column(String(20))
    lng = Column(Float, nullable=False)
    lat = Column(Float, nullable=False)
    wind_direction = Column(String(20))
    spread_direction = Column(String(50))
    spread_speed = Column(String(20))
    affected_area = Column(String(20))
    response_plan = Column(Text)
    commander = Column(String(20))
    forces = Column(Text)
