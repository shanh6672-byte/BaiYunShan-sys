"""云山智巡 FastAPI 应用入口"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from models.database import engine

# 前端文件目录（绝对路径）— yemian6.25 目录在 backend 同级
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../yemian6.25"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── API 路由 ──
from routers import auth, forest, rangers, drones, fires, pests
from routers import patrol, recognition, stats, risk, spatial, events, system

app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(forest.router, prefix="/api/forest", tags=["林区配置"])
app.include_router(rangers.router, prefix="/api/rangers", tags=["护林员"])
app.include_router(drones.router, prefix="/api/drones", tags=["无人机"])
app.include_router(fires.router, prefix="/api/fires", tags=["火情"])
app.include_router(pests.router, prefix="/api/pests", tags=["虫害"])
app.include_router(patrol.router, prefix="/api/patrol", tags=["巡护"])
app.include_router(recognition.router, prefix="/api/recognition", tags=["图像识别"])
app.include_router(stats.router, prefix="/api/stats", tags=["统计报表"])
app.include_router(risk.router, prefix="/api/risk", tags=["风险预警"])
app.include_router(spatial.router, prefix="/api/spatial", tags=["空间分析"])
app.include_router(events.router, prefix="/api/abnormal-events", tags=["异常事件"])
app.include_router(system.router, prefix="/api", tags=["系统管理"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION, "frontend": FRONTEND_DIR}


# ── Express 代理（避免跨域）──
import httpx as _httpx

@app.get("/api/proxy/trajectory/sessions/list")
async def proxy_traj_sessions():
    async with _httpx.AsyncClient() as client:
        resp = await client.get("http://localhost:3000/api/trajectory/sessions/list")
        return resp.json()

@app.get("/api/proxy/trajectory/{path:path}")
async def proxy_traj_points(path: str, userId: str = ""):
    async with _httpx.AsyncClient() as client:
        url = f"http://localhost:3000/api/trajectory/{path}"
        if userId: url += f"?userId={userId}"
        resp = await client.get(url)
        return resp.json()

# ── 轨迹回放 API（对接 patrol-replay-player.js） ──
import json as _json, random as _random
from sqlalchemy import text as _text
from models.database import AsyncSessionLocal as _AsyncSessionLocal

@app.get("/api/trajectory/sessions/list")
async def trajectory_sessions():
    async with _AsyncSessionLocal() as db:
        result = await db.execute(_text(
            "SELECT route_code, name, person, route_type, length_km FROM patrol_routes WHERE status='启用' ORDER BY route_code"
        ))
        rows = result.fetchall()
        return [{"id": r[0], "name": r[1], "person": r[2], "type": r[3], "length_km": float(r[4] or 0)} for r in rows]

@app.get("/api/trajectory/{route_code}")
async def trajectory_points(route_code: str, userId: str = ""):
    async with _AsyncSessionLocal() as db:
        result = await db.execute(_text(
            "SELECT ST_AsGeoJSON(path), person, length_km FROM patrol_routes WHERE route_code=:c OR person=:c LIMIT 1"
        ), {"c": route_code})
        row = result.fetchone()
        if not row:
            return {"points": []}
        geojson = _json.loads(row[0])
        coords = geojson.get("coordinates", [])
        base_ts = 1719700000000
        is_drone = row[1] and row[1].startswith("UAV")
        points = []
        for i, c in enumerate(coords):
            points.append({
                "latitude": round(c[1], 6), "longitude": round(c[0], 6),
                "recorded_at": base_ts + i * 5000,
                "speed": round(_random.uniform(8, 15), 1) if is_drone else round(_random.uniform(1.5, 3.5), 1),
                "accuracy": _random.randint(3, 10), "heading": _random.randint(0, 359),
            })
        return {"points": points, "person": row[1], "length_km": float(row[2] or 0)}

@app.get("/api/patrols")
async def patrols_list():
    async with _AsyncSessionLocal() as db:
        result = await db.execute(_text(
            "SELECT task_code, name, assigned_ranger, area_name, status FROM patrol_tasks"
        ))
        rows = result.fetchall()
        return [{"id": r[0], "name": r[1], "area": r[3] or "", "status": r[4] or "pending",
                 "members": [{"id": r[2], "name": r[2]} if r[2] else None]} for r in rows]

# ── 前端静态文件 ──
@app.get("/")
async def index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/{name:path}")
async def get_static(name: str):
    """服务前端静态文件（安全路径检查）"""
    full = os.path.abspath(os.path.join(FRONTEND_DIR, name))
    # 安全检查：确保文件在前端目录内
    if not full.startswith(os.path.abspath(FRONTEND_DIR)):
        return {"detail": "Not Found"}, 404
    if os.path.isfile(full):
        return FileResponse(full)
    # 不在白名单中 → 可能是前端 SPA 路由，返回 index.html
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
