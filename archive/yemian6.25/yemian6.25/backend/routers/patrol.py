"""巡护路由"""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db


def _parse_dt(s):
    """将前端 datetime-local 字符串转为 Python datetime，失败返回 None"""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None

router = APIRouter()


@router.get("/routes")
async def get_patrol_routes(db: AsyncSession = Depends(get_db)):
    """获取巡护路线"""
    result = await db.execute(
        text("""
            SELECT person, ST_AsGeoJSON(path) as path,
                   to_char(created_at, 'YYYY-MM-DD') as date, length_km
            FROM patrol_routes WHERE status = '启用'
            ORDER BY id
        """)
    )
    rows = result.fetchall()
    routes = []
    for row in rows:
        geojson = json.loads(row[1]) if row[1] else {"coordinates": []}
        coords = [[c[1], c[0]] for c in geojson["coordinates"]]
        routes.append({
            "person": row[0] or "",
            "coords": coords,
            "date": str(row[2]) if row[2] else "",
            "distance": f"{row[3]}km" if row[3] else "",
        })
    return routes


# ==================== 巡护任务 CRUD ====================

@router.get("/tasks")
async def get_patrol_tasks(db: AsyncSession = Depends(get_db)):
    """获取巡护任务列表"""
    result = await db.execute(
        text("""
            SELECT task_code, name, task_type, assigned_ranger, assigned_drone,
                   area_name, progress, status, description,
                   to_char(start_time, 'YYYY-MM-DD HH24:MI') as st,
                   to_char(end_time, 'YYYY-MM-DD HH24:MI') as et
            FROM patrol_tasks ORDER BY id DESC
        """)
    )
    rows = result.fetchall()
    return [
        {
            "task_code": row[0],
            "name": row[1],
            "task_type": row[2] or "",
            "executor": row[3] or row[4] or "",
            "area": row[5] or "",
            "progress": row[6] or 0,
            "status": row[7] or "",
            "description": row[8] or "",
            "start_time": row[9] or "",
            "end_time": row[10] or "",
        }
        for row in rows
    ]


@router.post("/tasks")
async def create_patrol_task(req: Request, db: AsyncSession = Depends(get_db)):
    """创建巡护任务"""
    data = await req.json()
    code = "T" + datetime.now().strftime("%m%d%H%M%S")
    await db.execute(
        text("""
            INSERT INTO patrol_tasks (task_code, name, task_type, assigned_ranger, assigned_drone,
                area_name, description, start_time, end_time, progress, status)
            VALUES (:code, :name, :type, :ranger, :drone, :area, :desc,
                :st, :et, 0, '待执行')
        """),
        {
            "code": code, "name": data.get("name", ""), "type": data.get("task_type", "日常巡护"),
            "ranger": data.get("ranger", ""), "drone": data.get("drone", ""),
            "area": data.get("area", ""), "desc": data.get("description", ""),
            "st": _parse_dt(data.get("start_time")), "et": _parse_dt(data.get("end_time")),
        },
    )
    await db.commit()
    return {"success": True, "task_code": code}


@router.put("/tasks/{task_code}")
async def update_patrol_task(task_code: str, req: Request, db: AsyncSession = Depends(get_db)):
    """更新巡护任务（进度/状态）"""
    data = await req.json()
    sets = []
    params = {"code": task_code}
    for field in ["progress", "status", "name"]:
        if field in data and data[field] is not None:
            sets.append(f"{field} = :{field}")
            params[field] = data[field]
    if sets:
        await db.execute(text(f"UPDATE patrol_tasks SET {', '.join(sets)} WHERE task_code = :code"), params)
        await db.commit()
    return {"success": True}


@router.delete("/tasks/{task_code}")
async def delete_patrol_task(task_code: str, db: AsyncSession = Depends(get_db)):
    """删除巡护任务"""
    await db.execute(text("DELETE FROM patrol_tasks WHERE task_code = :code"), {"code": task_code})
    await db.commit()
    return {"success": True}


# ==================== 轨迹回放 API（对接 patrol-replay-player.js） ====================

@router.get("/trajectory/sessions/list")
async def get_trajectory_sessions(db: AsyncSession = Depends(get_db)):
    """获取轨迹档案汇总（按路线分组）"""
    result = await db.execute(
        text("""
            SELECT route_code, name, person, route_type, length_km, status
            FROM patrol_routes WHERE status = '启用' ORDER BY route_code
        """)
    )
    rows = result.fetchall()
    return [
        {
            "id": row[0], "name": row[1], "person": row[2],
            "type": row[3], "length_km": float(row[4] or 0), "status": row[5]
        }
        for row in rows
    ]


@router.get("/trajectory/{route_code}")
async def get_trajectory_points(
    route_code: str,
    user_id: str = None,
    db: AsyncSession = Depends(get_db),
):
    """获取单条轨迹的坐标点（回放引擎使用）"""
    result = await db.execute(
        text("""
            SELECT ST_AsGeoJSON(path) as geojson, person, length_km
            FROM patrol_routes
            WHERE route_code = :code OR person = :code
            LIMIT 1
        """),
        {"code": route_code}
    )
    row = result.fetchone()
    if not row:
        return {"points": []}

    import json
    geojson = json.loads(row[0])
    coords = geojson.get("coordinates", [])
    points = []
    base_ts = 1719700000000  # 2024-06-30 base timestamp
    for i, c in enumerate(coords):
        points.append({
            "latitude": round(c[1], 6),
            "longitude": round(c[0], 6),
            "recorded_at": base_ts + i * 5000,  # 5秒间隔
            "speed": round(random.uniform(1.5, 3.5), 1) if "RT1" in route_code else round(random.uniform(8, 15), 1),
            "accuracy": random.randint(3, 10),
            "heading": random.randint(0, 359),
        })

    return {"points": points, "person": row[1], "length_km": float(row[2] or 0)}




# ==================== 巡护日志 CRUD ====================

@router.get("/logs")
async def get_patrol_logs(db: AsyncSession = Depends(get_db)):
    """获取巡护日志"""
    result = await db.execute(
        text("""
            SELECT patrol_date, person, area_name, duration_h, distance_km, findings
            FROM patrol_logs ORDER BY id DESC LIMIT 50
        """)
    )
    rows = result.fetchall()
    return [
        {
            "date": row[0],
            "person": row[1],
            "area": row[2],
            "duration_h": row[3] or 0,
            "distance_km": row[4] or 0,
            "findings": row[5] or "无异常",
        }
        for row in rows
    ]


@router.post("/logs")
async def create_patrol_log(req: Request, db: AsyncSession = Depends(get_db)):
    """填报巡护日志"""
    data = await req.json()
    await db.execute(
        text("""
            INSERT INTO patrol_logs (patrol_date, person, area_name, duration_h, distance_km, findings)
            VALUES (:date, :person, :area, :dur, :dist, :findings)
        """),
        {
            "date": data.get("date", datetime.now().strftime("%m-%d")),
            "person": data.get("person", ""), "area": data.get("area", ""),
            "dur": data.get("duration_h", 0), "dist": data.get("distance_km", 0),
            "findings": data.get("findings", "无异常"),
        },
    )
    await db.commit()
    return {"success": True}
