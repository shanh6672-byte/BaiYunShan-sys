"""火情路由"""
import json
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db

router = APIRouter()


@router.get("")
async def get_fires(db: AsyncSession = Depends(get_db)):
    """获取火情列表"""
    result = await db.execute(
        text("""
            SELECT name, level, area_name, report_time, status,
                   ST_AsGeoJSON(location) as loc
            FROM fires ORDER BY id
        """)
    )
    rows = result.fetchall()
    fires = []
    for row in rows:
        loc = json.loads(row[5]) if row[5] else {"coordinates": [106.73, 26.65]}
        fires.append({
            "name": row[0],
            "level": row[1],
            "area": row[2] or "",
            "time": row[3] or "",
            "status": row[4] or "",
            "lat": loc["coordinates"][1],
            "lng": loc["coordinates"][0],
        })
    return fires


@router.get("/points")
async def get_fire_points(db: AsyncSession = Depends(get_db)):
    """获取火情详情点"""
    result = await db.execute(
        text("""
            SELECT fire_name, level, area_name, report_time, status,
                   lng, lat, wind_direction, spread_direction, spread_speed,
                   affected_area, response_plan, commander, forces
            FROM fire_points ORDER BY id
        """)
    )
    rows = result.fetchall()
    points = {}
    for row in rows:
        points[row[0]] = {
            "id": row[0],
            "level": row[1],
            "area": row[2] or "",
            "time": row[3] or "",
            "status": row[4] or "",
            "lng": row[5],
            "lat": row[6],
            "wind": row[7] or "",
            "spread": row[8] or "",
            "speed": row[9] or "",
            "affected": row[10] or "",
            "response": row[11] or "",
            "commander": row[12] or "",
            "forces": row[13] or "",
        }
    return points


@router.get("/{fire_id}")
async def get_fire_point(fire_id: str, db: AsyncSession = Depends(get_db)):
    """获取单个火情详情"""
    result = await db.execute(
        text("""
            SELECT fire_name, level, area_name, report_time, status,
                   lng, lat, wind_direction, spread_direction, spread_speed,
                   affected_area, response_plan, commander, forces
            FROM fire_points WHERE fire_name = :fid
        """),
        {"fid": fire_id}
    )
    row = result.fetchone()
    if row is None:
        return None
    return {
        "id": row[0],
        "level": row[1],
        "area": row[2] or "",
        "time": row[3] or "",
        "status": row[4] or "",
        "lng": row[5],
        "lat": row[6],
        "wind": row[7] or "",
        "spread": row[8] or "",
        "speed": row[9] or "",
        "affected": row[10] or "",
        "response": row[11] or "",
        "commander": row[12] or "",
        "forces": row[13] or "",
    }
