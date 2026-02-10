#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

if pm2 list | grep -q "dykgaraget-api"; then
  info "Stopping backend..."
  pm2 stop dykgaraget-api
  pm2 save
  info "Backend stopped ✓"
else
  warn "Backend not running"
fi
