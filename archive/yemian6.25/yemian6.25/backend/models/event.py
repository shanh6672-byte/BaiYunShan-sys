"""异常事件模型"""
from sqlalchemy import Column, Integer, String, Float, DateTime, func
from geoalchemy2 import Geography
from .database import Base


class AbnormalEvent(Base):
    __tablename__ = "abnormal_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_code = Column(String(20), unique=True, nullable=False)  # AE001
    event_type = Column(String(20), nullable=False)  # fire / pest / geo / theft
    area_name = Column(String(50))
    description = Column(String(255))
    level = Column(String(10), default="low")  # high / mid / low
    report_time = Column(String(30))
    status = Column(String(20), default="待处置")  # 处置中 / 监控中 / 已处置 / 已派发
    handler = Column(String(50))
    location = Column(Geography("POINT", srid=4326))
    created_at = Column(DateTime, server_default=func.now())
