#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

warn "⚠️  WARNING: This will stop PostgreSQL database!"
read -p "Are you sure? (yes/no) " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  info "Cancelled"
  exit 0
fi

if systemctl is-active --quiet postgresql; then
  info "Stopping PostgreSQL..."
  systemctl stop postgresql
  info "PostgreSQL stopped ✓"
else
  warn "PostgreSQL not running"
fi
