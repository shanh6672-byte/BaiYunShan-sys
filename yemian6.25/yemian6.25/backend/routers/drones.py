"""无人机路由"""
import json
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db

router = APIRouter()


@router.get("")
async def get_drones(db: AsyncSession = Depends(get_db)):
    """获取所有无人机位置和状态"""
    result = await db.execute(
        text("""
            SELECT name, model, alt, heading, battery, status, flight_hours,
                   ST_AsGeoJSON(location) as loc
            FROM drones ORDER BY id
        """)
    )
    rows = result.fetchall()
    drones = []
    for row in rows:
        loc = json.loads(row[7]) if row[7] else {"coordinates": [106.73, 26.65]}
        drones.append({
            "name": row[0],
            "model": row[1],
            "alt": row[2],
            "heading": row[3],
            "battery": row[4],
            "status": row[5],
            "flight_hours": row[6] or 0,
            "lat": loc["coordinates"][1],
            "lng": loc["coordinates"][0],
        })
    return drones
