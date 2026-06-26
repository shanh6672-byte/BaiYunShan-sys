"""认证路由"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.user import User
from schemas.schemas import LoginRequest, LoginResponse, UserInfo
from services.auth import verify_password, create_access_token, require_auth

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.username == req.username)
    )
    user = result.scalar_one_or_none()

    if user is None:
        return LoginResponse(success=False, data=None, token=None)

    if not verify_password(req.password, user.password_hash):
        return LoginResponse(success=False, data=None, token=None)

    token = create_access_token({
        "sub": user.username,
        "role": user.role,
        "name": user.name,
    })

    return LoginResponse(
        success=True,
        data=UserInfo(username=user.username, role=user.role, name=user.name),
        token=token,
    )


@router.get("/me")
async def get_me(payload: dict = Depends(require_auth)):
    return {"username": payload.get("sub"), "role": payload.get("role"), "name": payload.get("name")}
