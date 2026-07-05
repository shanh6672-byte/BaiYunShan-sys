"""Flask 后端配置"""
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'baiyunshan-patrol-secret-key-2026')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'baiyunshan-jwt-secret-2026')
    JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24小时

    # PostgreSQL + PostGIS 数据库
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'postgresql://postgres:root@localhost:5432/baiyunshan'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # GeoServer 配置
    GEOSERVER_URL = os.environ.get('GEOSERVER_URL', 'http://39.97.254.191:8080/geoserver')
    GEOSERVER_USER = os.environ.get('GEOSERVER_USER', 'admin')
    GEOSERVER_PASSWORD = os.environ.get('GEOSERVER_PASSWORD', 'geoserver')
    GEOSERVER_WORKSPACE = 'baiyunshan'

    # 白云山林场中心坐标 (EPSG:4326)
    FOREST_CENTER = [28.467, 119.922]
    FOREST_BBOX = [119.854, 28.480, 119.966, 28.581]
