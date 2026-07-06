"""林区配置路由"""
import json
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.shape import to_shape

from models.database import get_db
from models.forest import ForestArea, Compartment
from schemas.schemas import ForestConfigOut, CompartmentOut

router = APIRouter()


@router.get("/config", response_model=ForestConfigOut)
async def get_forest_config(db: AsyncSession = Depends(get_db)):
    """获取林场中心点和边界"""
    result = await db.execute(
        text("SELECT center_lat, center_lng, ST_AsGeoJSON(boundary) as boundary FROM forest_areas LIMIT 1")
    )
    row = result.fetchone()
    if row is None:
        return ForestConfigOut(center=[26.65, 106.73], boundary=[])

    boundary_geojson = json.loads(row[2])
    coords = boundary_geojson["coordinates"][0]  # Polygon 外环
    boundary_list = [[c[1], c[0]] for c in coords]  # [lng, lat] -> [lat, lng]

    return ForestConfigOut(
        center=[row[0], row[1]],
        boundary=boundary_list,
    )


@router.get("/compartments")
async def get_compartments(db: AsyncSession = Depends(get_db)):
    """获取林班小班列表"""
    result = await db.execute(
        text("SELECT name, area_name, color, ST_AsGeoJSON(geom) as geom FROM compartments ORDER BY id")
    )
    rows = result.fetchall()
    compartments = []
    for row in rows:
        geojson = json.loads(row[3])
        coords = [[c[1], c[0]] for c in geojson["coordinates"][0]]
        compartments.append({
            "name": row[0],
            "area_name": row[1] or "",
            "color": row[2] or "",
            "coords": coords,
        })
    return compartments


@router.get("/compartments/colors")
async def get_compartment_colors(db: AsyncSession = Depends(get_db)):
    """获取林班颜色配置"""
    result = await db.execute(
        text("SELECT color FROM compartments GROUP BY color, id ORDER BY id")
    )
    return [row[0] for row in result.fetchall()]
