"""用户模型"""
from sqlalchemy import Column, Integer, String, DateTime, func
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(50), nullable=False)
    role = Column(String(20), nullable=False, default="ranger")  # admin / ranger / guest
    status = Column(String(10), default="离线")  # 在线 / 离线
    phone = Column(String(20), default="")
    last_login = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
