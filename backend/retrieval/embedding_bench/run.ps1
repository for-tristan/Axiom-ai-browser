#!/usr/bin/env pwsh
# EmbedBench startup script for PowerShell

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "   EmbedBench  |  Multi-Model Embedding Benchmarking Platform" -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host ""

# Activate venv if present
$venvActivate = Join-Path $PSScriptRoot "venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    Write-Host "  [INFO]  Activating virtual environment..." -ForegroundColor Green
    & $venvActivate
} else {
    Write-Host "  [WARN]  No venv found. Using system Python." -ForegroundColor Yellow
}

# Install dependencies
Write-Host "  [INFO]  Checking dependencies..." -ForegroundColor Green
pip install -r requirements.txt --quiet --disable-pip-version-check

# Launch
Write-Host ""
Write-Host "  [INFO]  Backend  → http://localhost:8000" -ForegroundColor Green
Write-Host "  [INFO]  API docs → http://localhost:8000/docs" -ForegroundColor Green
Write-Host "  [INFO]  Frontend → open frontend/index.html in your browser" -ForegroundColor Green
Write-Host ""
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

Set-Location $PSScriptRoot
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
