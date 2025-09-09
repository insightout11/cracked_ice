@echo off
echo Starting Off-Night Optimizer...
echo.
echo Starting server on port 3001...
start cmd /k "cd server && npm run dev"
timeout /t 3
echo.
echo Starting web client on port 3000...
start cmd /k "cd web && npm run dev"
echo.
echo Both servers starting...
echo Server: http://localhost:3001
echo Client: http://localhost:3000
echo.
pause