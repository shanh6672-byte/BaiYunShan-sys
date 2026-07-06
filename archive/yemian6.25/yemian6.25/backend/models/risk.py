"""风险预警模型"""
from sqlalchemy import Column, Integer, String, Float, DateTime, func
from .database import Base


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    risk_code = Column(String(20), unique=True, nullable=False)  # RA001
    area_name = Column(String(50), nullable=False)
    risk_type = Column(String(50), nullable=False)  # 森林火灾 / 松材线虫病 / 地质灾害 / 盗伐风险
    level = Column(String(10), nullable=False)  # high / mid / low
    score = Column(Float, default=0)
    description = Column(String(255))
    report_time = Column(String(30))
    status = Column(String(20), default="监控中")  # 预警中 / 监控中 / 已解除
    created_at = Column(DateTime, server_default=func.now())
