@echo off
echo Starting CDSS Backend...
cd backend
start cmd /k "python -m tools.api"
timeout /t 3
echo Starting CDSS Frontend...
cd ..\frontend
start cmd /k "npm run dev"
echo CDSS is starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
