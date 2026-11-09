@echo off
title EmbedBench — Embedding Benchmarking Platform
color 1F

echo.
echo  ============================================================
echo   EmbedBench  ^|  Multi-Model Embedding Benchmarking Platform
echo  ============================================================
echo.

REM ── Check for Python ─────────────────────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python is not found on PATH.
    echo          Please install Python 3.10+ and try again.
    pause & exit /b 1
)

REM ── Activate virtualenv if present ───────────────────────────────────────
if exist "venv\Scripts\activate.bat" (
    echo  [INFO]  Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo  [WARN]  No venv found. Using system Python.
    echo          Tip: run  python -m venv venv  then  pip install -r requirements.txt
)

REM ── Install / verify dependencies ────────────────────────────────────────
echo  [INFO]  Checking dependencies...
pip install -r requirements.txt --quiet --disable-pip-version-check

REM ── Launch FastAPI backend ────────────────────────────────────────────────
echo.
echo  [INFO]  Starting FastAPI backend on http://localhost:8000
echo  [INFO]  API docs available at  http://localhost:8000/docs
echo  [INFO]  Frontend:  open  frontend\index.html  in your browser
echo.
echo  Press Ctrl+C to stop the server.
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

pause
