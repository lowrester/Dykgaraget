#!/bin/bash
# ============================================================
# 🧹 Server Wipe Script - Dykgaraget Prep
# Purpose: Removes old PM2 processes, Nginx configs, and web files
# Usage: sudo ./server-wipe.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Root check
if [ "$EUID" -ne 0 ]; then
  error "Please run as root (sudo ./server-wipe.sh)"
fi

echo "════════════════════════════════════════════════════════════"
echo "⚠️  SERVER WIPE - PREPARING FOR DYKGARAGET"
echo "════════════════════════════════════════════════════════════"
warn "This will delete ALL pm2 processes, nginx sites, and /var/www content."
read -p "Are you sure you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "Wipe cancelled."
fi

# 1. PM2 Cleanup
step() { echo -e "\n[STEP] $1"; }

step "Stopping all PM2 processes..."
if command -v pm2 &> /dev/null; then
    pm2 stop all || true
    pm2 delete all || true
    pm2 save --force || true
    info "PM2 cleared."
else
    info "PM2 not found, skipping."
fi

# 2. Nginx Cleanup
step "Cleaning Nginx configurations..."
rm -f /etc/nginx/sites-enabled/*
rm -f /etc/nginx/sites-available/*
if nginx -t &> /dev/null; then
    systemctl reload nginx || true
    info "Nginx configurations removed."
else
    warn "Nginx config test failed, possibly due to empty sites. Reloading anyway..."
    systemctl reload nginx || true
fi

# 3. Web File Cleanup
step "Deleting web files..."
rm -rf /var/www/*
rm -rf /var/www/html/*
mkdir -p /var/www/html
info "/var/www/ is now empty."

# 4. Database hint
step "Database cleanup (Manual)..."
echo "To see existing databases: sudo -u postgres psql -l"
echo "To drop a database: sudo -u postgres psql -c 'DROP DATABASE your_db_name;'"

echo -e "\n${GREEN}✅ SERVER CLEANED!${NC}"
echo "You can now proceed with the Dykgaraget deployment."
