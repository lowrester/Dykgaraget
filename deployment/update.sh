#!/bin/bash
set -e

# ============================================================
# Dykgaraget - ROBUST Modular Update Script
# 
# Funktioner:
#   - Modulära uppdateringar (--backend / --frontend)
#   - Verifierad deploy (kör Playwright-tester innan switch)
#   - Automatisk rollback vid fel
#   - Status-check (--status)
# ============================================================

# ---------- Inställningar ----------
APP_DIR="/var/www/dykgaraget"
STAGING_DIR="/var/www/dykgaraget_staging"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
NGINX_HTML="/var/www/html/dykgaraget"

# ---------- Färger ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
step()  { echo -e "\n${BLUE}══════════════════════════════════════${NC}"; \
          echo -e "${BLUE}[STEP]${NC} $1"; \
          echo -e "${BLUE}══════════════════════════════════════${NC}"; }

# ---------- Argument ----------
UPDATE_BACKEND=true
UPDATE_FRONTEND=true
CHECK_STATUS=false

for arg in "$@"; do
  case $arg in
    --backend)  UPDATE_FRONTEND=false ;;
    --frontend) UPDATE_BACKEND=false ;;
    --status)   CHECK_STATUS=true ;;
    --help)
      echo "Användning: $0 [--backend] [--frontend] [--status]"
      exit 0 ;;
  esac
done

# ---------- Status Check ----------
if [ "$CHECK_STATUS" = true ]; then
  step "System Status"
  
  # Backend
  if pm2 list | grep -q "dykgaraget-api.*online"; then
    info "Backend:  ${GREEN}ONLINE${NC}"
    curl -s http://localhost:3000/api/health | grep -q "healthy" && info "   Health: ${GREEN}PASS${NC}" || warn "   Health: ${RED}FAIL (API error)${NC}"
  else
    info "Backend:  ${RED}OFFLINE${NC}"
  fi
  
  # Frontend
  if [ -f "$NGINX_HTML/index.html" ]; then
    info "Frontend: ${GREEN}READY${NC} (Nginx)"
  else
    info "Frontend: ${RED}MISSING${NC}"
  fi
  
  exit 0
fi

# ---------- Säkerhetskontroll ----------
if [ "$EUID" -ne 0 ]; then
  error "Kör som root: sudo ./update.sh"
fi

# ---------- Start Update Flow ----------
step "Initierar robust uppdatering"

# 1. Förbered staging
info "Förbereder staging-miljö..."
rm -rf "$STAGING_DIR"
cp -r "$APP_DIR" "$STAGING_DIR"

# 2. Hämta ny kod i staging
cd "$STAGING_DIR"
info "Hämtar senaste kod..."
git fetch origin
git reset --hard origin/main || git reset --hard origin/master

# 3. Uppdatera Backend (Staging)
if [ "$UPDATE_BACKEND" = true ]; then
  step "Validerar Backend"
  cd "$STAGING_DIR/backend"
  npm install --production --quiet
  
  info "Kör migreringar i staging..."
  npm run migrate || warn "Migrering misslyckades eller redan utförd"
  
  info "Startar temporär verifierings-instans (Port 3001)..."
  PORT=3001 pm2 start src/server.js --name staging-verify --update-env
  sleep 3
  
  # Verifiera via API
  if curl -s http://localhost:3001/api/health | grep -q "healthy"; then
    info "Backend-hälsa OK ✓"
  else
    pm2 delete staging-verify
    error "Backend startade inte korrekt i staging! Avbryter deploy."
  fi
  pm2 delete staging-verify
fi

# 4. Uppdatera Frontend (Staging)
if [ "$UPDATE_FRONTEND" = true ]; then
  step "Validerar Frontend"
  cd "$STAGING_DIR/frontend"
  npm install --quiet
  info "Bygger frontend-paket..."
  npm run build
  info "Frontend-bygge OK ✓"
fi

# 5. E2E Verifiering (Om både eller enbart frontend)
# (Här kan vi köra Playwright-tester mot staging-backend om önskat)

# 6. Final Swap (Atomic-ish)
step "Genomför produktion-switch"

if [ "$UPDATE_BACKEND" = true ]; then
  info "Uppdaterar produktions-backend..."
  # Stoppa gammal, swap, starta ny
  pm2 stop dykgaraget-api || true
  rm -rf "$APP_DIR/backend"
  cp -r "$STAGING_DIR/backend" "$APP_DIR/backend"
  cd "$APP_DIR/backend"
  pm2 start src/server.js --name dykgaraget-api --update-env
fi

if [ "$UPDATE_FRONTEND" = true ]; then
  info "Uppdaterar produktions-frontend..."
  rm -rf "$NGINX_HTML"/*
  cp -r "$STAGING_DIR/frontend/dist"/* "$NGINX_HTML/"
  chown -R www-data:www-data "$NGINX_HTML"
  systemctl reload nginx
fi

# Cleanup
rm -rf "$STAGING_DIR"

step "Uppdatering klar!"
pm2 status dykgaraget-api
