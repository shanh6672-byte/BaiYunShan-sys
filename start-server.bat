@echo off
chcp 65001 >nul
title 白云山森林巡护管理系统

REM 设置端口号（可修改）
set PORT=5052

echo ==========================================
echo   白云山森林巡护管理系统
echo ==========================================
echo.
echo 正在启动后端服务...
echo 端口: %PORT%
echo.

cd /d "%~dp0backend"
python run_port.py %PORT%

pause
