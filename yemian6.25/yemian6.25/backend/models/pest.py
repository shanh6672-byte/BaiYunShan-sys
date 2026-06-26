"""虫害模型"""
from sqlalchemy import Column, Integer, String, Float, DateTime, func
from geoalchemy2 import Geography
from .database import Base


class Pest(Base):
    __tablename__ = "pests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    area_name = Column(String(50), nullable=False)
    area_size = Column(String(10))  # 受影响面积描述
    location = Column(Geography("POINT", srid=4326), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
