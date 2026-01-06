#!/bin/bash

# Configuration
APP_DIR="/var/www/zap-entregas"
REPO_URL="https://github.com/ThonBlack/Zap-Entregas.git"

echo "========================================"
echo "      ZAP ENTREGAS - VPS DEPLOY"
echo "========================================"

# 1. Ensure Dependencies
echo "[1] Checking dependencies..."
if ! command -v git &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y git
fi

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# 2. Clone or Update
if [ -d "$APP_DIR" ]; then
    echo "[2] Updating existing application..."
    cd $APP_DIR
    git pull
else
    echo "[2] Fresh installation..."
    sudo mkdir -p /var/www
    sudo chown -R $USER:$USER /var/www
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# 3. Install & Build
echo "[3] Installing dependencies & Building..."
npm install
npm run build

# 4. Start/Restart PM2
echo "[4] Configuring PM2..."
if pm2 list | grep -q "zap-entregas"; then
    pm2 restart zap-entregas
else
    pm2 start ecosystem.config.js
    pm2 save
fi

echo "========================================"
echo "   DEPLOY SUCCESS! Running on Port 4000"
echo "========================================"
