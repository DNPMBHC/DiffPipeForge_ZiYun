@echo off
chcp 65001 > nul
setlocal

echo ==========================================
echo       DiffPipe Forge WebUI 启动器
echo ==========================================

set ROOT=%~dp0
set PATH=%ROOT%python_embeded_DP;%ROOT%python_embeded_DP\Scripts;%ROOT%python;%ROOT%python\Scripts;%PATH%

set PYTHON_EXE=python
if exist "%ROOT%python_embeded_DP\python.exe" set PYTHON_EXE=%ROOT%python_embeded_DP\python.exe
if exist "%ROOT%python\python.exe" set PYTHON_EXE=%ROOT%python\python.exe

echo [INFO] Python: %PYTHON_EXE%

echo [INFO] 检查 WebUI 依赖...
"%PYTHON_EXE%" -c "import fastapi, uvicorn" >nul 2>&1
if errorlevel 1 (
    echo [INFO] 正在安装 FastAPI/Uvicorn...
    "%PYTHON_EXE%" -m pip install fastapi "uvicorn[standard]"
    if errorlevel 1 goto :ERROR
)

cd /d "%ROOT%app\ui"
if not exist "node_modules" (
    echo [INFO] 检测到前端依赖缺失，正在安装...
    call npm install
    if errorlevel 1 goto :ERROR
)

if not exist "dist\index.html" (
    echo [INFO] 正在构建 WebUI 静态资源...
    set VITE_WEB_ONLY=1
    call npm run build:web
    if errorlevel 1 goto :ERROR
)

cd /d "%ROOT%"
echo [INFO] 启动 WebUI: http://127.0.0.1:7860
start "" "http://127.0.0.1:7860"
"%PYTHON_EXE%" "%ROOT%app\web_server.py" --host 127.0.0.1 --port 7860
goto :END

:ERROR
echo [ERROR] WebUI 启动失败，请查看上方日志。
pause

:END
endlocal