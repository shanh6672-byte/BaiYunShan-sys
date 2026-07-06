"""风险预警路由"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db

router = APIRouter()


@router.get("/assessment")
async def get_risk_assessment(db: AsyncSession = Depends(get_db)):
    """获取风险预警评估"""
    result = await db.execute(
        text("""
            SELECT risk_code, area_name, risk_type, level, score, description, report_time, status
            FROM risk_assessments ORDER BY score DESC
        """)
    )
    rows = result.fetchall()

    items = [
        {
            "id": row[0],
            "area": row[1] or "",
            "type": row[2] or "",
            "level": row[3] or "",
            "score": float(row[4]) if row[4] else 0,
            "desc": row[5] or "",
            "time": row[6] or "",
            "status": row[7] or "",
        }
        for row in rows
    ]

    high = sum(1 for i in items if i["level"] == "high")
    mid = sum(1 for i in items if i["level"] == "mid")
    low = sum(1 for i in items if i["level"] == "low")

    return {
        "summary": {"total": len(items), "high": high, "mid": mid, "low": low},
        "items": items,
    }
