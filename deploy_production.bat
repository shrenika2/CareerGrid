@echo off
echo ===================================================
echo   InternMatch AI Production Deployment Script (Win)
echo ===================================================
echo.

:: 1. Verify that .env file exists in the root directory
if not exist ".env" (
    echo [ERROR] Root .env configuration file is missing!
    echo Please copy and populate the .env configuration before deploying.
    echo.
    exit /b 1
)

echo [INFO] Root .env file verified successfully.
echo.

:: 2. Run docker-compose down to clear old container caches
echo [INFO] Stopping and cleaning existing Docker containers...
docker-compose down
if %ERRORLEVEL% neq 0 (
    echo [WARNING] docker-compose down failed or was not active. Continuing...
)
echo.

:: 3. Run docker-compose up --build -d
echo [INFO] Building and launching InternMatch containers in detached mode...
docker-compose up --build -d
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Production container orchestration failed to launch!
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo   DEPLOYMENT SUCCESSFUL: InternMatch AI is Online
echo   - Frontend Proxy: http://localhost:80
echo   - Backend Server: http://localhost:5000
echo   - FastAPI Sidecar: http://localhost:8000
echo ===================================================
