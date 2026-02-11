#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/var/www/dykgaraget"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
step() { echo -e "${BLUE}[STEP]${NC} $1"; }
run_as_user() {
  if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    sudo -u "$SUDO_USER" "$@"
  else
    "$@"
  fi
}

if [ "$EUID" -ne 0 ]; then 
  error "Please run as root"
fi

echo "════════════════════════════════════════════════════════════"
echo "🔄 Dykgaraget Update"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
  error "Application not found at $APP_DIR"
fi

# ========== BACKUP ==========
step "Creating backup..."
BACKUP_DIR="${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
cp -r $APP_DIR $BACKUP_DIR
info "Backup created: $BACKUP_DIR"

# ========== GIT PULL ==========
step "Pulling latest code..."
cd $APP_DIR

if [ ! -d .git ]; then
  warn "Not a git repository. Would you like to initialize it automatically?"
  read -p "Initialize and link to GitHub (SSH)? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    info "Initializing git and linking to origin (SSH)..."
    run_as_user git init
    run_as_user git remote add origin git@github.com:lowrester/Dykgaraget.git
    run_as_user git fetch origin
    run_as_user git checkout -f main || run_as_user git checkout -f master
  else
    warn "Skipping git setup. You must manually manage files."
  fi
fi

if [ -d .git ]; then
  info "Fetching updates from git..."
  run_as_user git fetch origin
  
  # Check if there are updates
  LOCAL=$(git rev-parse @)
  UPSTREAM='@{u}'
  REMOTE=$(git rev-parse "$UPSTREAM" 2>/dev/null || echo "unknown")
  
  if [ "$LOCAL" = "$REMOTE" ]; then
    info "Already up to date ✓"
  elif [ "$REMOTE" != "unknown" ]; then
    info "Updates available, pulling..."
    run_as_user git pull origin main || run_as_user git pull origin master
  fi
fi

# ========== UPDATE BACKEND ==========
step "Updating backend..."
cd $BACKEND_DIR

# Check for package.json changes (handle first run where HEAD@{1} might not exist)
if git rev-parse HEAD@{1} >/dev/null 2>&1; then
  if git diff --name-only HEAD@{1} HEAD | grep -q "package.json"; then
    info "package.json changed, installing dependencies..."
    npm install --omit=dev
  else
    info "No dependency changes detected"
  fi
else
  info "Initial run or no git history, installing dependencies just in case..."
  npm install --omit=dev
fi

# Run migrations if exists
if [ -f "src/db/migrate.js" ]; then
  info "Running database migrations..."
  # Use absolute node path and run from backend dir to ensure .env is found
  node src/db/migrate.js || warn "Migration failed or already applied"
fi

# Restart backend
if pm2 list | grep -q "dykgaraget-api"; then
  info "Restarting backend..."
  pm2 restart dykgaraget-api
  
  # Wait for startup
  sleep 2
  
  # Check if running
  if pm2 list | grep -q "dykgaraget-api.*online"; then
    info "Backend restarted successfully ✓"
  else
    error "Backend failed to start! Check logs: pm2 logs dykgaraget-api"
  fi
else
  warn "Backend not running, starting..."
  pm2 start src/server.js --name dykgaraget-api
  pm2 save
fi

# ========== UPDATE FRONTEND ==========
step "Updating frontend..."
cd $FRONTEND_DIR

# Check for package.json changes (handle first run)
if git rev-parse HEAD@{1} >/dev/null 2>&1; then
  if git diff --name-only HEAD@{1} HEAD | grep -q "package.json"; then
    info "package.json changed, installing dependencies..."
    npm install
  else
    info "No dependency changes detected"
  fi
else
  info "Initial run or no git history, installing dependencies just in case..."
  npm install
fi

# Build frontend
info "Building frontend..."
npm run build

# Deploy to nginx
info "Deploying to nginx..."
NGINX_HTML="/var/www/html/dykgaraget"

# Backup current build
if [ -d "$NGINX_HTML" ]; then
  NGINX_BACKUP="${NGINX_HTML}_backup_$(date +%Y%m%d_%H%M%S)"
  cp -r $NGINX_HTML $NGINX_BACKUP
  info "Nginx files backed up to: $NGINX_BACKUP"
fi

# Deploy new build
rm -rf $NGINX_HTML/*
cp -r dist/* $NGINX_HTML/
chown -R www-data:www-data $NGINX_HTML

# ========== RELOAD NGINX ==========
step "Reloading nginx..."
if nginx -t 2>/dev/null; then
  systemctl reload nginx
  info "Nginx reloaded ✓"
else
  error "Nginx config test failed!"
fi

# ========== CLEANUP OLD BACKUPS ==========
info "Cleaning old backups (keeping last 5)..."
cd /var/www
ls -dt dykgaraget_backup_* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true
ls -dt /var/www/html/dykgaraget_backup_* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

# ========== COMPLETION ==========
echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ UPDATE COMPLETE!${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📊 Status:"
pm2 status
echo ""
echo "🔗 Test:"
echo "   curl http://localhost/api/health"
echo ""
echo "📝 Logs:"
echo "   pm2 logs dykgaraget-api"
echo ""
echo "🔙 Rollback if needed:"
echo "   cp -r $BACKUP_DIR/* $APP_DIR/"
echo "   pm2 restart dykgaraget-api"
echo ""
