#!/bin/bash
set -e

# ============================================================
# Dykgaraget - one.com VPS Update Script
# 
# Kör direkt på servern via SSH:
#   ssh root@your-server
#   cd /var/www/dykgaraget
#   ./deployment/update-onecom.sh
#
# Eller med flaggor:
#   ./update-onecom.sh --backend-only
#   ./update-onecom.sh --frontend-only
#   ./update-onecom.sh --skip-build     (hoppar npm install om inget ändrats)
# ============================================================

# ---------- Flaggor ----------
BACKEND_ONLY=false
FRONTEND_ONLY=false
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --backend-only)  BACKEND_ONLY=true ;;
    --frontend-only) FRONTEND_ONLY=true ;;
    --skip-build)    SKIP_BUILD=true ;;
    --help)
      echo "Användning: $0 [--backend-only] [--frontend-only] [--skip-build]"
      exit 0 ;;
    *)
      echo "Okänd flagga: $arg  (kör $0 --help)"
      exit 1 ;;
  esac
done

# ---------- Colors ----------
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

APP_DIR="/var/www/dykgaraget"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
NGINX_HTML="/var/www/html/dykgaraget"

if [ "$EUID" -ne 0 ]; then
  error "Kör som root: sudo ./update-onecom.sh"
fi

if [ ! -d "$APP_DIR" ]; then
  error "Applikationen hittas inte på $APP_DIR\n  Kör deploy-onecom.sh först."
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   🔄  Dykgaraget — one.com Update               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Visa vad vi ska göra
[ "$BACKEND_ONLY"  = true ] && info "Läge: --backend-only"
[ "$FRONTEND_ONLY" = true ] && info "Läge: --frontend-only"
[ "$SKIP_BUILD"    = true ] && info "Läge: --skip-build (npm install hoppas om inget ändrats)"

# ============================================================
# BACKUP
# ============================================================
step "Backup"

BACKUP_DIR="${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
info "Skapar backup → $BACKUP_DIR ..."
cp -r "$APP_DIR" "$BACKUP_DIR"
info "Backup klar ✓"

# ============================================================
# GIT PULL
# ============================================================
step "Hämta senaste kod"

cd "$APP_DIR"

if [ ! -d .git ]; then
  warn "Inte ett git-repo — hoppar över git pull"
  warn "Kopiera nya filer manuellt till $APP_DIR om du inte använder git"
else
  # Auto-switch from HTTPS to SSH if needed
  CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
  if [[ "$CURRENT_REMOTE" == "https://github.com/lowrester/Dykgaraget.git" ]]; then
    info "HTTPS-remote upptäckt, byter till SSH för privat repo-stöd..."
    git remote set-url origin git@github.com:lowrester/Dykgaraget.git
  fi

  info "Hämtar från git ..."
  git fetch origin

  LOCAL=$(git rev-parse @)
  REMOTE=$(git rev-parse '@{u}' 2>/dev/null || echo "unknown")

  if [ "$LOCAL" = "$REMOTE" ]; then
    info "Redan aktuell ✓"
  else
    CHANGED=$(git diff --name-only "$LOCAL" "$REMOTE" 2>/dev/null || echo "")
    info "Uppdateringar hittade:"
    echo "$CHANGED" | sed 's/^/    /'
    git pull origin main 2>/dev/null || git pull origin master
    info "Pull klar ✓"
  fi

  # Spara listan med ändrade filer för smarta beslut nedan
  CHANGED_FILES=$(git diff --name-only "$LOCAL" HEAD 2>/dev/null || echo "")
fi

# ============================================================
# BACKEND UPDATE
# ============================================================
if [ "$FRONTEND_ONLY" = false ]; then
  step "Uppdatera backend"

  if [ ! -d "$BACKEND_DIR" ]; then
    error "Backend-katalog saknas: $BACKEND_DIR"
  fi

  cd "$BACKEND_DIR"

  # npm install — bara om package.json ändrats (eller --skip-build ej satt)
  if [ "$SKIP_BUILD" = false ]; then
    if echo "$CHANGED_FILES" | grep -q "backend/package.json"; then
      info "package.json ändrad — installerar om npm-paket ..."
      npm install --production --quiet
    else
      info "package.json oförändrad — hoppar npm install ✓"
    fi
  else
    info "(--skip-build) Hoppar npm install"
  fi

  # Databasmigreringar
  if npm run | grep -q "migrate" 2>/dev/null; then
    info "Kör migreringar ..."
    npm run migrate 2>/dev/null && info "Migreringar klara ✓" \
      || warn "Migrering misslyckades eller redan utförd"
  fi

  # Restart — med hälsokontroll
  if pm2 list | grep -q "dykgaraget-api"; then
    info "Startar om backend ..."
    pm2 restart dykgaraget-api --update-env
  else
    warn "PM2-process saknas — startar ..."
    pm2 start src/server.js --name dykgaraget-api
  fi
  pm2 save --force

  # Vänta och verifiera
  info "Verifierar backend ..."
  sleep 3
  if pm2 list | grep "dykgaraget-api" | grep -q "online"; then
    info "Backend körs ✓"
  else
    error "Backend startade inte!\n  Kolla loggar: pm2 logs dykgaraget-api\n  Rollback: cp -r $BACKUP_DIR/* $APP_DIR/"
  fi
fi

# ============================================================
# FRONTEND UPDATE
# ============================================================
if [ "$BACKEND_ONLY" = false ]; then
  step "Uppdatera frontend"

  if [ ! -d "$FRONTEND_DIR" ]; then
    error "Frontend-katalog saknas: $FRONTEND_DIR"
  fi

  cd "$FRONTEND_DIR"

  # npm install — bara om package.json ändrats
  if [ "$SKIP_BUILD" = false ]; then
    if echo "$CHANGED_FILES" | grep -q "frontend/package.json"; then
      info "package.json ändrad — installerar om npm-paket ..."
      npm install --quiet
    else
      info "package.json oförändrad — hoppar npm install ✓"
    fi
  else
    info "(--skip-build) Hoppar npm install"
  fi

  # Bygg
  info "Bygger frontend ..."
  npm run build

  # Backup av befintlig build
  if [ -d "$NGINX_HTML" ] && [ "$(ls -A $NGINX_HTML)" ]; then
    NGINX_BACKUP="${NGINX_HTML}_bak_$(date +%Y%m%d_%H%M%S)"
    info "Säkerhetskopierar befintlig build → $NGINX_BACKUP ..."
    cp -r "$NGINX_HTML" "$NGINX_BACKUP"
  fi

  # Deploya ny build
  info "Deployer till nginx ..."
  rm -rf "${NGINX_HTML:?}"/*
  cp -r dist/* "$NGINX_HTML/"
  chown -R www-data:www-data "$NGINX_HTML"
  info "Frontend deployard ✓"

  # Nginx reload
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    info "Nginx reloadad ✓"
  else
    error "Nginx-konfigurationsfel!\n  Kolla: nginx -t"
  fi
fi

# ============================================================
# STÄDA GAMLA BACKUPER (behåller 5 senaste)
# ============================================================
step "Städa / rensa gamla backuper"

info "Behåller 5 senaste app-backuper ..."
ls -dt "${APP_DIR}_backup_"* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

info "Behåller 5 senaste nginx-backuper ..."
ls -dt "${NGINX_HTML}_bak_"* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

info "Städning klar ✓"

# ============================================================
# KLAR
# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅  Update klar!                               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "📊 PM2 status:"
pm2 status
echo ""
echo "🔍 Snabbtester:"
echo "   curl http://localhost/api/health"
echo "   curl http://localhost"
echo ""
echo "📝 Loggar:"
echo "   pm2 logs dykgaraget-api"
echo ""
echo "🔙 Rollback om något gick fel:"
echo "   cp -r ${APP_DIR}_backup_[senaste]/* $APP_DIR/"
echo "   pm2 restart dykgaraget-api"
echo "   systemctl reload nginx"
echo ""
