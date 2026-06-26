"""图像识别路由"""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from schemas.schemas import AnalyzeRequest, AnalyzeResponse

router = APIRouter()


@router.get("/fire")
async def get_fire_recognition(db: AsyncSession = Depends(get_db)):
    """获取火情识别数据"""
    result = await db.execute(
        text("""
            SELECT id, area_name, label, source, time, result, level, lat, lng, svg_type
            FROM image_recognition WHERE recognition_type = 'fire' ORDER BY id
        """)
    )
    rows = result.fetchall()
    return [
        {
            "id": row[0],
            "area": row[1] or "",
            "label": row[2] or "",
            "source": row[3] or "",
            "time": row[4] or "",
            "result": row[5] or "",
            "level": row[6] or "",
            "lat": row[7] or "",
            "lng": row[8] or "",
            "svgType": row[9] or "normal",
        }
        for row in rows
    ]


@router.get("/pest")
async def get_pest_recognition(db: AsyncSession = Depends(get_db)):
    """获取虫害识别数据"""
    result = await db.execute(
        text("""
            SELECT id, area_name, label, source, time, result, level, lat, lng, svg_type
            FROM image_recognition WHERE recognition_type = 'pest' ORDER BY id
        """)
    )
    rows = result.fetchall()
    return [
        {
            "id": row[0],
            "area": row[1] or "",
            "label": row[2] or "",
            "source": row[3] or "",
            "time": row[4] or "",
            "result": row[5] or "",
            "level": row[6] or "",
            "lat": row[7] or "",
            "lng": row[8] or "",
            "svgType": row[9] or "normal",
        }
        for row in rows
    ]


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_image(req: AnalyzeRequest):
    """分析上传图像（暂为占位，预留AI模型接入）"""
    # TODO: 接入实际 AI 图像识别模型
    return AnalyzeResponse(
        success=True,
        result="疑似 - 烟雾",
        confidence=78.5,
        level="mid",
    )
