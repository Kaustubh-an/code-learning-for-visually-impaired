@echo off
cd /d "%~dp0"

if not exist ".venv" (
    echo Creating virtual environment...
    py -m venv .venv
)

echo Installing or checking dependencies...
call .venv\Scripts\python.exe -m pip install --upgrade pip
call .venv\Scripts\python.exe -m pip install -r requirements.txt

echo.
echo Starting the Code Learning Platform...
echo Open http://127.0.0.1:8000 in Microsoft Edge or Chrome.
echo Press CTRL+C to stop the server.
echo.
call .venv\Scripts\python.exe -m uvicorn app.main:app --reload
pause
