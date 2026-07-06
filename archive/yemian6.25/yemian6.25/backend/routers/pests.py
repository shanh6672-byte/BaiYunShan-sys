"""虫害路由"""
import json
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db

router = APIRouter()


@router.get("")
async def get_pests(db: AsyncSession = Depends(get_db)):
    """获取虫害区列表"""
    result = await db.execute(
        text("""
            SELECT area_name, area_size, ST_AsGeoJSON(location) as loc
            FROM pests ORDER BY id
        """)
    )
    rows = result.fetchall()
    pests = []
    for row in rows:
        loc = json.loads(row[2]) if row[2] else {"coordinates": [106.72, 26.65]}
        pests.append({
            "area": row[0],
            "areaSize": row[1] or "",
            "lat": loc["coordinates"][1],
            "lng": loc["coordinates"][0],
        })
    return pests
