"""系统日志、备份记录模型"""
from sqlalchemy import Column, Integer, String, DateTime, func
from .database import Base


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    log_time = Column(String(30), nullable=False)
    username = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)
    module = Column(String(50))
    ip_address = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())


class DataBackup(Base):
    __tablename__ = "data_backups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    backup_time = Column(String(30), nullable=False)
    backup_type = Column(String(20), nullable=False)  # 自动备份 / 数据导入
    status = Column(String(10), default="成功")
    size = Column(String(20))
    created_at = Column(DateTime, server_default=func.now())
