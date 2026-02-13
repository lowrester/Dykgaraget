#!/bin/bash
set -e

# ============================================================
# Dykgaraget - Rollback Script
# 
# Återställer systemet till föregående backup.
# ============================================================

APP_DIR="/var/www/dykgaraget"
NGINX_HTML="/var/www/html/dykgaraget"

# ---------- Färger ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

if [ "$EUID" -ne 0 ]; then
  error "Kör som root: sudo ./rollback.sh"
fi

# 1. Hitta senaste backupen
LATEST_BACKUP=$(ls -dt ${APP_DIR}_backup_* 2>/dev/null | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
  error "Ingen backup hittades!"
fi

echo -e "${YELLOW}Varning: Detta kommer att skriva över nuvarande version med backupen från: $LATEST_BACKUP${NC}"
read -p "Vill du fortsätta? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# 2. Utför återställning
info "Återställer applikationsfiler..."
rm -rf "$APP_DIR"
cp -r "$LATEST_BACKUP" "$APP_DIR"

info "Startar om backend..."
pm2 restart dykgaraget-api || (cd "$APP_DIR/backend" && pm2 start src/server.js --name dykgaraget-api)

info "Återställer frontend (Nginx)..."
# Hitta senaste nginx-backup om möjligt
LATEST_NGINX=$(ls -dt ${NGINX_HTML}_bak_* 2>/dev/null | head -n 1)
if [ -n "$LATEST_NGINX" ]; then
  rm -rf "$NGINX_HTML"/*
  cp -r "$LATEST_NGINX"/* "$NGINX_HTML/"
  chown -R www-data:www-data "$NGINX_HTML"
fi

systemctl reload nginx

info "${GREEN}Rollback klar! ✓${NC}"
pm2 status
