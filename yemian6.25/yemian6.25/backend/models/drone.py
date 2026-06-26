"""无人机模型"""
from sqlalchemy import Column, Integer, String, Float, DateTime, func
from geoalchemy2 import Geography
from .database import Base


class Drone(Base):
    __tablename__ = "drones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(20), unique=True, nullable=False)  # UAV-01
    model = Column(String(50), nullable=False)  # 大疆M300
    alt = Column(String(10), default="0m")
    heading = Column(String(10), default="N")
    battery = Column(String(10), default="100%")
    status = Column(String(20), default="待命")  # 巡航中 / 待命 / 维护中
    flight_hours = Column(Float, default=0)  # 飞行时长
    location = Column(Geography("POINT", srid=4326))
    created_at = Column(DateTime, server_default=func.now())
