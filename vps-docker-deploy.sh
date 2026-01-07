#!/bin/bash

APP_DIR="/var/www/zap-entregas"
REPO_URL="https://github.com/ThonBlack/Zap-Entregas.git"

echo "========================================"
echo "   ZAP ENTREGAS - DOCKER DEPLOY 🐳"
echo "========================================"

# 1. Check Docker
if ! command -v docker &> /dev/null; then
    echo "Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
fi

# 2. Update Code
if [ ! -d "$APP_DIR" ]; then
    git clone $REPO_URL $APP_DIR
fi

cd $APP_DIR
echo "Atualizando codigo..."
git pull

# 3. Build & Restart
echo "Construindo e Iniciando Container..."
# Stop old PM2 if running (migration)
pm2 stop zap-entregas 2>/dev/null || true
pm2 delete zap-entregas 2>/dev/null || true

# Docker Compose Up
docker compose up -d --build

echo "========================================"
echo "   SUCESSO! Rodando na porta 4000"
echo "========================================"
