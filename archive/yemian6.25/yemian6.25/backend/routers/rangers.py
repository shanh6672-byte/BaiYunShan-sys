"""护林员路由"""
import json
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db

router = APIRouter()


@router.get("")
async def get_rangers(db: AsyncSession = Depends(get_db)):
    """获取所有护林员位置和状态"""
    result = await db.execute(
        text("""
            SELECT staff_id, name, area_name, status, speed, battery,
                   ST_AsGeoJSON(location) as loc
            FROM rangers ORDER BY id
        """)
    )
    rows = result.fetchall()
    rangers = []
    for row in rows:
        loc = json.loads(row[6]) if row[6] else {"coordinates": [106.72, 26.65]}
        rangers.append({
            "id": row[0],
            "name": row[1],
            "area": row[2],
            "status": row[3],
            "speed": row[4],
            "battery": row[5],
            "lat": loc["coordinates"][1],
            "lng": loc["coordinates"][0],
        })
    return rangers
