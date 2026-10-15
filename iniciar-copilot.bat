@echo off
chcp 65001 >nul
title Copilot Protheus - Inicializador
echo ======================================================
echo    Iniciando Stack do Copilot Protheus
echo ======================================================
echo.

echo [1/4] Iniciando Ollama ARC (GPU Intel Arc)...
start "Ollama ARC (GPU)" cmd /k "cd /d C:\ollama-arc && ollama-serve.bat"

timeout /t 2 /nobreak >nul

echo [2/4] Iniciando Backend FastAPI...
start "Backend FastAPI (Porta 8000)" cmd /k "cd /d C:\projeto\copilotprotheus\backend && C:\projeto\copilotprotheus\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [3/4] Iniciando Frontend Chat...
start "Frontend Chat (Porta 5173)" cmd /k "cd /d C:\projeto\copilotprotheus\frontend && npm run dev"

timeout /t 2 /nobreak >nul

echo [4/4] Iniciando Frontend Admin...
start "Admin Frontend (Porta 5174)" cmd /k "cd /d C:\projeto\copilotprotheus\admin-frontend && npm run dev"

echo.
echo ======================================================
echo    Todos os serviços foram disparados em janelas dedicadas:
echo.
echo    - Chat Copilot:      http://localhost:5173
echo    - Painel Admin:      http://localhost:5174
echo    - Backend API Docs:  http://localhost:8000/docs
echo    - Ollama ARC (GPU):  http://localhost:11434
echo ======================================================
echo.
pause
