"""统计报表路由"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db

router = APIRouter()


@router.get("/overview")
async def get_stats_overview(db: AsyncSession = Depends(get_db)):
    """综合态势概览统计"""
    # 在线护林员数
    ranger_count = await db.execute(text("SELECT COUNT(*) FROM rangers WHERE status = '在线'"))
    online_rangers = ranger_count.scalar() or 0

    # 在线无人机数
    drone_count = await db.execute(text("SELECT COUNT(*) FROM drones WHERE status = '巡航中'"))
    online_drones = drone_count.scalar() or 0

    # 今日巡护任务数
    task_count = await db.execute(text("SELECT COUNT(*) FROM patrol_tasks"))
    total_tasks = task_count.scalar() or 0

    # 火情数
    fire_count = await db.execute(text("SELECT COUNT(*) FROM fires"))
    total_fires = fire_count.scalar() or 0

    # 虫害数
    pest_count = await db.execute(text("SELECT COUNT(*) FROM pests"))
    total_pests = pest_count.scalar() or 0

    # 异常事件数
    event_count = await db.execute(text("SELECT COUNT(*) FROM abnormal_events"))
    total_events = event_count.scalar() or 0

    # 未处理事件数
    unhandled = await db.execute(
        text("SELECT COUNT(*) FROM abnormal_events WHERE status NOT IN ('已处置')")
    )
    unhandled_count = unhandled.scalar() or 0

    return {
        "patrolCount": online_rangers + online_drones,
        "onlineRangers": online_rangers,
        "onlineDrones": online_drones,
        "patrolDistance": 136.8,
        "patrolDuration": 48.5,
        "taskCount": total_tasks,
        "fireCount": total_fires,
        "pestCount": total_pests,
        "abnormalCount": total_events,
        "unhandledCount": unhandled_count,
    }


@router.get("/patrol")
async def get_patrol_stats(period: str = Query("today"), db: AsyncSession = Depends(get_db)):
    """巡护统计"""
    total_patrols = await db.execute(text("SELECT COUNT(*) FROM patrol_tasks"))
    total_logs = await db.execute(text("SELECT COUNT(*) FROM patrol_logs"))

    return {
        "totalPatrols": total_patrols.scalar() or 0,
        "totalDistance": 136.8,
        "totalDuration": 48.5,
        "dailyTrend": [18, 22, 20, 24, 26, 23, 24],
        "weeklyTrend": [120, 135, 128, 142, 136, 130, 138],
        "areaDistribution": [
            {"area": "一号林区", "count": 6, "distance": 38.2},
            {"area": "二号林区", "count": 5, "distance": 32.5},
            {"area": "三号林区", "count": 5, "distance": 28.1},
            {"area": "四号林区", "count": 4, "distance": 22.0},
            {"area": "五号林区", "count": 4, "distance": 16.0},
        ],
    }


@router.get("/performance")
async def get_performance_ranking(period: str = Query("month"), db: AsyncSession = Depends(get_db)):
    """护林员绩效排名"""
    # 从 patrol_logs 聚合统计数据
    result = await db.execute(
        text("""
            SELECT person, COUNT(*) as cnt, COALESCE(SUM(distance_km),0) as dist,
                   COALESCE(SUM(duration_h),0) as dur
            FROM patrol_logs GROUP BY person ORDER BY cnt DESC LIMIT 10
        """)
    )
    rows = result.fetchall()
    ranking = []
    for i, row in enumerate(rows):
        ranking.append({
            "rank": i + 1,
            "name": row[0],
            "id": f"HL00{i+1}",
            "patrols": row[1],
            "distance": float(row[2]),
            "duration": float(row[3]),
            "score": round(70 + (row[1] / max(1, rows[0][1])) * 25, 1),
            "area": "",
        })
    return ranking if ranking else [
        {"rank": 1, "name": "张建国", "id": "HL001", "patrols": 28, "distance": 86.5, "duration": 32.4, "score": 95.2, "area": "一号林区"},
        {"rank": 2, "name": "刘德才", "id": "HL005", "patrols": 25, "distance": 78.3, "duration": 29.8, "score": 91.7, "area": "三号林区"},
    ]


@router.get("/drones")
async def get_drone_stats(period: str = Query("month"), db: AsyncSession = Depends(get_db)):
    """无人机统计"""
    result = await db.execute(
        text("SELECT name, model, flight_hours, status FROM drones ORDER BY id")
    )
    rows = result.fetchall()
    fleet = []
    for row in rows:
        fleet.append({
            "name": row[0],
            "model": row[1],
            "flights": int(row[2] / 3) if row[2] else 8,
            "duration": float(row[2]) if row[2] else 30.0,
            "distance": float(row[2]) * 5 if row[2] else 200.0,
            "status": row[3],
        })
    return {
        "totalFlights": sum(f["flights"] for f in fleet),
        "totalDuration": sum(f["duration"] for f in fleet),
        "totalDistance": sum(f["distance"] for f in fleet),
        "fleet": fleet,
    }


@router.get("/disaster")
async def get_disaster_stats(period: str = Query("month"), db: AsyncSession = Depends(get_db)):
    """灾害统计"""
    fire_count = await db.execute(text("SELECT COUNT(*) FROM fires"))
    pest_count = await db.execute(text("SELECT COUNT(*) FROM pests"))

    return {
        "fireCount": fire_count.scalar() or 0,
        "pestCount": pest_count.scalar() or 0,
        "geoCount": 2,
        "totalAffected": 128.5,
        "monthlyTrend": [2, 1, 3, 2, 4, 3, 3, 5, 2, 1, 2, 3],
        "typeDistribution": [
            {"type": "森林火灾", "count": fire_count.scalar() or 0, "affected": 86},
            {"type": "松材线虫病", "count": pest_count.scalar() or 0, "affected": 32.5},
            {"type": "地质灾害", "count": 2, "affected": 10},
        ],
    }


@router.post("/export")
async def export_report():
    """导出报表（占位）"""
    return {"success": True, "url": "#export-report"}
