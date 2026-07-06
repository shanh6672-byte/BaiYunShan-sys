"""林区、林班模型"""
from sqlalchemy import Column, Integer, String, Float
from geoalchemy2 import Geography
from .database import Base


class ForestArea(Base):
    __tablename__ = "forest_areas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    center_lat = Column(Float, nullable=False)
    center_lng = Column(Float, nullable=False)
    boundary = Column(Geography("POLYGON", srid=4326), nullable=False)


class Compartment(Base):
    __tablename__ = "compartments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    area_name = Column(String(50), nullable=False)
    color = Column(String(10), nullable=False)
    geom = Column(Geography("POLYGON", srid=4326), nullable=False)
