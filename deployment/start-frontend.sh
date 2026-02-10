#!/bin/bash
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

FRONTEND_DIR="/var/www/dykgaraget/frontend"
NGINX_HTML="/var/www/html/dykgaraget"

if [ ! -d "$FRONTEND_DIR" ]; then
  error "Frontend directory not found"
fi

cd $FRONTEND_DIR

info "Building frontend..."
npm run build

info "Deploying to nginx..."
rm -rf $NGINX_HTML/*
cp -r dist/* $NGINX_HTML/
chown -R www-data:www-data $NGINX_HTML

info "Reloading nginx..."
nginx -t && systemctl reload nginx

info "Frontend deployed ✓"
