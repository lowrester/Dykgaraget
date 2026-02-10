#!/bin/bash
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

BACKEND_DIR="/var/www/dykgaraget/backend"

if [ ! -d "$BACKEND_DIR" ]; then
  error "Backend directory not found"
fi

cd $BACKEND_DIR

if pm2 list | grep -q "dykgaraget-api"; then
  info "Backend already running"
  pm2 status dykgaraget-api
else
  info "Starting backend..."
  pm2 start src/server.js --name dykgaraget-api
  pm2 save
  sleep 2
  pm2 status dykgaraget-api
fi

info "Backend running ✓"
