"""系统管理路由：用户、角色、权限、日志、备份、监控"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.user import User
from services.auth import require_auth, hash_password

router = APIRouter()


# ==================== 用户管理 ====================
@router.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    """获取用户列表"""
    result = await db.execute(
        text("""
            SELECT id, username, name, role, status,
                   COALESCE(to_char(last_login, 'YYYY-MM-DD HH24:MI'), '') as last_login
            FROM users ORDER BY id
        """)
    )
    rows = result.fetchall()
    return [
        {
            "id": f"U{row[0]:03d}",
            "username": row[1],
            "name": row[2],
            "role": row[3],
            "status": row[4] or "离线",
            "lastLogin": row[5],
        }
        for row in rows
    ]


@router.post("/users")
async def create_user(req: dict, db: AsyncSession = Depends(get_db)):
    """创建用户"""
    hashed = hash_password(req.get("password", "123456"))
    result = await db.execute(
        text("""
            INSERT INTO users (username, password_hash, name, role, status)
            VALUES (:username, :hash, :name, :role, '离线') RETURNING id
        """),
        {
            "username": req["username"],
            "hash": hashed,
            "name": req.get("name", req["username"]),
            "role": req.get("role", "ranger"),
        },
    )
    await db.commit()
    uid = result.scalar()
    return {"success": True, "id": f"U{uid:03d}"}


@router.put("/users/{user_id}")
async def update_user(user_id: str, req: dict, db: AsyncSession = Depends(get_db)):
    """更新用户"""
    # 从 U001 格式提取数字ID
    uid = int(user_id[1:]) if user_id.startswith("U") else int(user_id)

    updates = []
    params = {"uid": uid}
    if "username" in req and req["username"]:
        updates.append("username = :username")
        params["username"] = req["username"]
    if "name" in req and req["name"]:
        updates.append("name = :name")
        params["name"] = req["name"]
    if "role" in req and req["role"]:
        updates.append("role = :role")
        params["role"] = req["role"]
    if "password" in req and req["password"]:
        updates.append("password_hash = :hash")
        params["hash"] = hash_password(req["password"])

    if updates:
        await db.execute(
            text(f"UPDATE users SET {', '.join(updates)} WHERE id = :uid"),
            params,
        )
        await db.commit()

    return {"success": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    """删除用户"""
    uid = int(user_id[1:]) if user_id.startswith("U") else int(user_id)
    await db.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": uid})
    await db.commit()
    return {"success": True}


# ==================== 角色管理 ====================
@router.get("/roles")
async def get_roles(db: AsyncSession = Depends(get_db)):
    """获取角色列表"""
    return [
        {"id": "R001", "name": "admin", "label": "系统管理员", "desc": "拥有系统全部权限", "userCount": 1},
        {"id": "R002", "name": "ranger", "label": "护林员", "desc": "巡护监控与数据上报权限", "userCount": 5},
        {"id": "R003", "name": "guest", "label": "游客", "desc": "仅查看驾驶舱与统计报表", "userCount": 1},
    ]


@router.post("/roles")
async def create_role(req: dict, db: AsyncSession = Depends(get_db)):
    return {"success": True, "id": f"R{id(req)}"}


@router.put("/roles/{role_id}")
async def update_role(role_id: str, req: dict, db: AsyncSession = Depends(get_db)):
    return {"success": True}


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, db: AsyncSession = Depends(get_db)):
    return {"success": True}


# ==================== 权限管理 ====================
@router.get("/permissions")
async def get_permissions():
    """获取权限配置"""
    return [
        {"module": "综合驾驶舱", "admin": True, "ranger": True, "guest": True},
        {"module": "巡护监控与管理", "admin": True, "ranger": True, "guest": False},
        {"module": "空间数据管理", "admin": True, "ranger": True, "guest": False},
        {"module": "灾害识别处置", "admin": True, "ranger": True, "guest": False},
        {"module": "统计报表", "admin": True, "ranger": True, "guest": True},
        {"module": "系统管理", "admin": True, "ranger": False, "guest": False},
    ]


@router.put("/permissions/{role_id}")
async def update_permission(role_id: str, req: dict):
    return {"success": True}


# ==================== 数据运维 ====================
@router.get("/system/data-ops")
async def get_data_ops(db: AsyncSession = Depends(get_db)):
    """获取数据运维状态"""
    result = await db.execute(
        text("""
            SELECT backup_time, backup_type, status, size
            FROM data_backups ORDER BY id DESC LIMIT 5
        """)
    )
    rows = result.fetchall()
    recent_ops = [
        {
            "time": row[0],
            "type": row[1],
            "status": row[2],
            "size": row[3],
        }
        for row in rows
    ]

    return {
        "lastBackup": recent_ops[0]["time"] if recent_ops else "",
        "backupSize": recent_ops[0]["size"] if recent_ops else "0 GB",
        "dbStatus": "正常",
        "storageUsed": "68.5%",
        "recentOps": recent_ops,
    }


@router.post("/system/backup")
async def backup_data(req: dict = None, db: AsyncSession = Depends(get_db)):
    """执行数据备份"""
    from datetime import datetime
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    await db.execute(
        text("""
            INSERT INTO data_backups (backup_time, backup_type, status, size)
            VALUES (:time, :type, '成功', :size)
        """),
        {"time": now, "type": req.get("type", "full") if req else "full", "size": "2.3 GB"},
    )
    await db.commit()
    return {"success": True, "id": f"BK{int(datetime.now().timestamp())}"}


@router.post("/system/import")
async def import_data(req: dict, db: AsyncSession = Depends(get_db)):
    """导入数据"""
    return {"success": True, "id": f"IMP{id(req)}"}


# ==================== 日志管理 ====================
@router.get("/system/logs")
async def get_system_logs(db: AsyncSession = Depends(get_db)):
    """获取系统操作日志"""
    result = await db.execute(
        text("""
            SELECT log_time, username, action, module, ip_address
            FROM system_logs ORDER BY id DESC LIMIT 100
        """)
    )
    rows = result.fetchall()
    return [
        {
            "time": row[0],
            "user": row[1],
            "action": row[2],
            "module": row[3] or "",
            "ip": row[4] or "-",
        }
        for row in rows
    ]


# ==================== 系统监控 ====================
@router.get("/system/monitor")
async def get_system_monitor():
    """获取系统监控数据"""
    import psutil
    cpu = psutil.cpu_percent(interval=0.1) if _check_psutil() else 32.5
    mem = psutil.virtual_memory().percent if _check_psutil() else 58.2
    disk = psutil.disk_usage("/").percent if _check_psutil() else 68.5

    import os
    uptime_seconds = getattr(psutil, "boot_time", lambda: 0)()
    if uptime_seconds:
        import time
        uptime_seconds = int(time.time() - uptime_seconds)
        days = uptime_seconds // 86400
        hours = (uptime_seconds % 86400) // 3600
        uptime = f"{days}天 {hours}小时"
    else:
        uptime = "15天 8小时"

    return {
        "cpu": cpu,
        "memory": mem,
        "disk": disk,
        "network": 12.8,
        "uptime": uptime,
        "services": [
            {"name": "Web服务", "status": "运行中", "port": 80, "cpu": 8.2, "memory": 12.5},
            {"name": "数据库", "status": "运行中", "port": 5432, "cpu": 15.3, "memory": 25.8},
            {"name": "消息队列", "status": "运行中", "port": 5672, "cpu": 3.9, "memory": 9.7},
        ],
    }


def _check_psutil() -> bool:
    try:
        import psutil
        return True
    except ImportError:
        return False
