"""空间分析（FVC植被覆盖度）路由"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db

router = APIRouter()


@router.get("/fvc")
async def get_fvc_analysis(db: AsyncSession = Depends(get_db)):
    """获取FVC植被覆盖度分析"""
    # FVC数据通常是分析结果，存储在表中
    result = await db.execute(
        text("""
            SELECT name, fvc, level, area_high, area_mid, area_low, area_bare, trend
            FROM fvc_analysis ORDER BY id
        """)
    )
    rows = result.fetchall()

    areas = [
        {
            "name": row[0],
            "fvc": float(row[1]) if row[1] else 0,
            "level": row[2] or "",
            "areaHigh": float(row[3]) if row[3] else 0,
            "areaMid": float(row[4]) if row[4] else 0,
            "areaLow": float(row[5]) if row[5] else 0,
            "areaBare": float(row[6]) if row[6] else 0,
            "trend": row[7] or "",
        }
        for row in rows
    ]

    deg_result = await db.execute(
        text("""
            SELECT area_name, fvc, level, lat, lng FROM fvc_degraded ORDER BY fvc ASC
        """)
    )
    degraded = [
        {
            "area": row[0],
            "fvc": float(row[1]) if row[1] else 0,
            "level": row[2] or "",
            "lat": float(row[3]) if row[3] else 0,
            "lng": float(row[4]) if row[4] else 0,
        }
        for row in deg_result.fetchall()
    ]

    # 默认mock数据回退
    if not areas:
        areas = [
            {"name": "一号林区", "fvc": 0.72, "level": "中高覆盖", "areaHigh": 1850, "areaMid": 920, "areaLow": 380, "areaBare": 150, "trend": "稳定"},
            {"name": "二号林区", "fvc": 0.58, "level": "中覆盖", "areaHigh": 1120, "areaMid": 860, "areaLow": 520, "areaBare": 200, "trend": "下降"},
            {"name": "三号林区", "fvc": 0.81, "level": "高覆盖", "areaHigh": 2100, "areaMid": 680, "areaLow": 180, "areaBare": 40, "trend": "上升"},
            {"name": "四号林区", "fvc": 0.43, "level": "低覆盖", "areaHigh": 680, "areaMid": 540, "areaLow": 860, "areaBare": 120, "trend": "下降"},
            {"name": "五号林区", "fvc": 0.65, "level": "中高覆盖", "areaHigh": 1070, "areaMid": 450, "areaLow": 290, "areaBare": 50, "trend": "稳定"},
        ]
    if not degraded:
        degraded = [
            {"area": "二号林区西南部", "fvc": 0.22, "level": "严重退化", "lat": 26.648, "lng": 106.738},
            {"area": "四号林区北部", "fvc": 0.18, "level": "严重退化", "lat": 26.656, "lng": 106.746},
            {"area": "二号林区东部", "fvc": 0.35, "level": "中度退化", "lat": 26.655, "lng": 106.742},
        ]

    return {"areas": areas, "degradedAreas": degraded}


@router.post("/fvc/analyze")
async def run_fvc_analysis(db: AsyncSession = Depends(get_db)):
    """执行FVC分析（占位，预留实际遥感分析算法接入）"""
    import asyncio
    await asyncio.sleep(1.5)  # 模拟分析延迟

    return {
        "success": True,
        "data": {
            "avgFvc": 0.68,
            "totalArea": 12060,
            "highCoverArea": 6820,
            "midCoverArea": 3450,
            "lowCoverArea": 1230,
            "bareArea": 560,
            "degradedCount": 3,
            "areas": [
                {"name": "一号林区", "fvc": 0.72, "level": "中高覆盖", "areaHigh": 1850, "areaMid": 920, "areaLow": 380, "areaBare": 150},
                {"name": "二号林区", "fvc": 0.58, "level": "中覆盖", "areaHigh": 1120, "areaMid": 860, "areaLow": 520, "areaBare": 200},
                {"name": "三号林区", "fvc": 0.81, "level": "高覆盖", "areaHigh": 2100, "areaMid": 680, "areaLow": 180, "areaBare": 40},
                {"name": "四号林区", "fvc": 0.43, "level": "低覆盖", "areaHigh": 680, "areaMid": 540, "areaLow": 860, "areaBare": 120},
                {"name": "五号林区", "fvc": 0.65, "level": "中高覆盖", "areaHigh": 1070, "areaMid": 450, "areaLow": 290, "areaBare": 50},
            ],
            "degradedAreas": [
                {"area": "二号林区西南部", "fvc": 0.22, "level": "严重退化", "lat": 26.648, "lng": 106.738},
                {"area": "四号林区北部", "fvc": 0.18, "level": "严重退化", "lat": 26.656, "lng": 106.746},
                {"area": "二号林区东部", "fvc": 0.35, "level": "中度退化", "lat": 26.655, "lng": 106.742},
            ],
        },
    }
