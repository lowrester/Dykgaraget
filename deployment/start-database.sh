#!/bin/bash
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

if systemctl is-active --quiet postgresql; then
  info "PostgreSQL already running ✓"
  sudo -u postgres psql -c "SELECT version();" | head -1
else
  info "Starting PostgreSQL..."
  systemctl start postgresql
  sleep 2
  
  if systemctl is-active --quiet postgresql; then
    info "PostgreSQL started ✓"
  else
    error "Failed to start PostgreSQL"
  fi
fi

# Test connection
if sudo -u postgres psql -d dykgaraget -c "SELECT 1" &>/dev/null; then
  info "Database connection OK ✓"
else
  error "Cannot connect to database"
fi
