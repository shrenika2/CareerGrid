#!/bin/bash
set -e

echo "==================================================="
echo "  InternMatch AI Production Deployment Script (Unix)"
echo "==================================================="
echo

# 1. Verify that .env file exists in the root directory
if [ ! -f ".env" ]; then
    echo "[ERROR] Root .env configuration file is missing!"
    echo "Please copy and populate the .env configuration before deploying."
    echo
    exit 1
fi

echo "[INFO] Root .env file verified successfully."
echo

# 2. Run docker-compose down to clear old container caches
echo "[INFO] Stopping and cleaning existing Docker containers..."
docker-compose down || echo "[WARNING] docker-compose down encountered issues, continuing..."
echo

# 3. Run docker-compose up --build -d
echo "[INFO] Building and launching InternMatch containers in detached mode..."
docker-compose up --build -d

echo
echo "==================================================="
echo "  DEPLOYMENT SUCCESSFUL: InternMatch AI is Online"
echo "  - Frontend Proxy: http://localhost:80"
echo "  - Backend Server: http://localhost:5000"
echo "  - FastAPI Sidecar: http://localhost:8000"
echo "==================================================="
