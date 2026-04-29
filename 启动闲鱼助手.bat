@echo off
title 闲鱼自动化助手
cd /d "%~dp0"

echo ==========================================
echo         闲鱼自动化助手 - 正在启动...
echo ==========================================
echo.
echo 首次启动可能需要等待几秒钟
echo 如需关闭，请直接关闭应用窗口
echo.

:: 使用 Electron 启动应用
pnpm run dev

if %errorlevel% neq 0 (
    echo.
    echo [!] 启动失败，请确保已安装依赖
    echo 尝试运行: pnpm install
    pause
)
