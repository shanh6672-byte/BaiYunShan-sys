"""护林员模型"""
from sqlalchemy import Column, Integer, String, Float, DateTime, func
from geoalchemy2 import Geography
from .database import Base


class Ranger(Base):
    __tablename__ = "rangers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    staff_id = Column(String(20), unique=True, nullable=False)  # 工号 HL001
    name = Column(String(50), nullable=False)
    phone = Column(String(20), default="")
    area_name = Column(String(50), nullable=False)  # 负责林区
    status = Column(String(10), default="离线")  # 在线 / 离线
    speed = Column(String(10), default="-")
    battery = Column(String(10), default="100%")
    location = Column(Geography("POINT", srid=4326))
    last_online = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
