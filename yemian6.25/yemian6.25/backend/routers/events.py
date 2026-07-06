"""异常事件路由"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from schemas.schemas import CreateEventRequest, CreateEventResponse

router = APIRouter()


@router.get("")
async def get_abnormal_events(
    type: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """获取异常事件列表"""
    if type:
        result = await db.execute(
            text("""
                SELECT event_code, event_type, area_name, description, level, report_time, status, handler
                FROM abnormal_events WHERE event_type = :typ ORDER BY id DESC
            """),
            {"typ": type},
        )
    else:
        result = await db.execute(
            text("""
                SELECT event_code, event_type, area_name, description, level, report_time, status, handler
                FROM abnormal_events ORDER BY id DESC
            """)
        )

    rows = result.fetchall()
    return [
        {
            "id": row[0],
            "type": row[1],
            "area": row[2] or "",
            "desc": row[3] or "",
            "level": row[4] or "",
            "time": row[5] or "",
            "status": row[6] or "",
            "handler": row[7] or "",
        }
        for row in rows
    ]


@router.post("", response_model=CreateEventResponse)
async def create_abnormal_event(
    req: CreateEventRequest,
    db: AsyncSession = Depends(get_db),
):
    """创建异常事件"""
    import time
    event_code = f"AE{int(time.time())}"
    await db.execute(
        text("""
            INSERT INTO abnormal_events (event_code, event_type, area_name, description, level, report_time, status, handler, location)
            VALUES (:code, :typ, :area, :desc, :level, NOW()::text, '待处置', :handler, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))
        """),
        {
            "code": event_code,
            "typ": req.event_type,
            "area": req.area_name,
            "desc": req.description,
            "level": req.level,
            "handler": req.handler,
            "lng": req.lng,
            "lat": req.lat,
        },
    )
    await db.commit()
    return CreateEventResponse(success=True, id=event_code)
