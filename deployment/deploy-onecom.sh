#!/bin/bash
set -e

# ============================================================
# Dykgaraget - one.com VPS Deployment Script
# Ubuntu 20.04/22.04 LTS
#
# Kör direkt på servern via SSH:
#   ssh root@your-server
#   chmod +x deploy-onecom.sh
#   ./deploy-onecom.sh
# ============================================================

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

# ---------- Config (ändra dessa) ----------
APP_DIR="/var/www/dykgaraget"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
NGINX_CONF="/etc/nginx/sites-available/dykgaraget"
NGINX_HTML="/var/www/html/dykgaraget"
DB_NAME="dykgaraget"
DB_USER="dykgaraget_user"
# Lösenord sätts interaktivt nedan om det inte finns sedan tidigare
DOMAIN=""   # Sätt t.ex. "dykgaraget.se" för SSL, lämna tomt för att skippa

# ---------- Root check ----------
if [ "$EUID" -ne 0 ]; then
  error "Kör som root: sudo ./deploy-onecom.sh"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   🌊  Dykgaraget — one.com VPS Deployment       ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ============================================================
# STEG 1 – Systempaket
# ============================================================
step "1/9  Systempaket"

apt-get update -qq

for pkg in curl git nginx postgresql postgresql-contrib; do
  if dpkg -s "$pkg" &>/dev/null; then
    info "$pkg redan installerat ✓"
  else
    info "Installerar $pkg ..."
    apt-get install -y "$pkg" -qq
  fi
done

# ============================================================
# STEG 2 – Node.js
# ============================================================
step "2/9  Node.js"

if command -v node &>/dev/null; then
  info "Node.js redan installerat: $(node -v) ✓"
else
  info "Installerar Node.js 18 ..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash - 2>/dev/null
  apt-get install -y nodejs -qq
  info "Node.js installerat: $(node -v) ✓"
fi

if command -v pm2 &>/dev/null; then
  info "PM2 redan installerat: $(pm2 -v) ✓"
else
  info "Installerar PM2 ..."
  npm install -g pm2 --quiet
  info "PM2 installerat ✓"
fi

# ============================================================
# STEG 3 – PostgreSQL & databas
# ============================================================
step "3/9  PostgreSQL"

# Se till att PostgreSQL är igång
if ! systemctl is-active --quiet postgresql; then
  info "Startar PostgreSQL ..."
  systemctl start postgresql
  systemctl enable postgresql
else
  info "PostgreSQL körs redan ✓"
fi

# Databas
if sudo -u postgres psql -lqt | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
  info "Databas '$DB_NAME' finns redan ✓"
else
  info "Skapar databas '$DB_NAME' ..."
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
fi

# Databasanvändare
if sudo -u postgres psql -tAc "\du $DB_USER" | grep -qw "$DB_USER"; then
  info "Databasanvändare '$DB_USER' finns redan ✓"
else
  echo ""
  warn "Databasanvändare '$DB_USER' saknas — ange lösenord:"
  read -rsp "  Lösenord för $DB_USER: " DB_PASSWORD
  echo ""
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
  info "Användare skapad ✓"
  warn "⚠  Kom ihåg att sätta DB_PASSWORD i $BACKEND_DIR/.env"
fi

# ============================================================
# STEG 4 – Applikationskatalog
# ============================================================
step "4/9  Applikationskatalog"

if [ -d "$APP_DIR" ]; then
  warn "Katalogen $APP_DIR finns redan"
  read -rp "  Fortsätt och skriv över? (ja/nej) " ANS
  if [[ ! "$ANS" =~ ^[Jj][Aa]$ ]]; then
    error "Deployment avbruten av användaren"
  fi
  BACKUP_DIR="${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
  info "Skapar backup → $BACKUP_DIR ..."
  cp -r "$APP_DIR" "$BACKUP_DIR"
  info "Backup klar ✓"
else
  mkdir -p "$APP_DIR"
  info "Katalog skapad ✓"
fi

# ============================================================
# STEG 5 – Backend
# ============================================================
step "5/9  Backend"

# Källkod måste finnas intill scriptet
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -d "$SCRIPT_DIR/../backend" ]; then
  error "Källkod saknas: $SCRIPT_DIR/../backend\n  Ladda upp hela dykgaraget-production/ till servern."
fi

info "Kopierar backend ..."
rm -rf "$BACKEND_DIR"
cp -r "$SCRIPT_DIR/../backend" "$BACKEND_DIR"

cd "$BACKEND_DIR"

info "Installerar npm-paket ..."
npm install --production --quiet

if [ -f .env ]; then
  warn ".env finns redan — behålls ✓"
else
  cp .env.example .env
  warn "⚠  Ny .env skapad — redigera $BACKEND_DIR/.env innan du startar!"
fi

info "Skapar upload-katalog ..."
mkdir -p uploads/invoices
chown -R www-data:www-data uploads

info "Kör databasmigreringar ..."
npm run migrate 2>/dev/null || warn "Migrering misslyckades eller redan utförd"

# PM2 – restart om den körs, annars start
if pm2 list | grep -q "dykgaraget-api"; then
  info "PM2-process finns, startar om ..."
  pm2 restart dykgaraget-api --update-env
else
  info "Startar backend med PM2 ..."
  pm2 start src/server.js --name dykgaraget-api
fi
pm2 save --force
info "Backend igång ✓"

# ============================================================
# STEG 6 – Frontend
# ============================================================
step "6/9  Frontend"

if [ ! -d "$SCRIPT_DIR/../frontend" ]; then
  error "Källkod saknas: $SCRIPT_DIR/../frontend"
fi

info "Kopierar frontend ..."
rm -rf "$FRONTEND_DIR"
cp -r "$SCRIPT_DIR/../frontend" "$FRONTEND_DIR"

cd "$FRONTEND_DIR"

if [ -f .env ]; then
  warn ".env finns redan — behålls ✓"
else
  cp .env.example .env
  warn "⚠  Ny .env skapad — sätt VITE_API_URL i $FRONTEND_DIR/.env"
fi

info "Installerar npm-paket ..."
npm install --quiet

info "Bygger frontend ..."
npm run build

info "Deployer till nginx ..."
rm -rf "$NGINX_HTML"
mkdir -p "$NGINX_HTML"
cp -r dist/* "$NGINX_HTML/"
chown -R www-data:www-data "$NGINX_HTML"
info "Frontend deployard ✓"

# ============================================================
# STEG 7 – Nginx
# ============================================================
step "7/9  Nginx"

if [ -f "$NGINX_CONF" ]; then
  NGINX_BACKUP="${NGINX_CONF}.bak.$(date +%Y%m%d_%H%M%S)"
  warn "Befintlig nginx-config säkerhetskopieras → $NGINX_BACKUP"
  cp "$NGINX_CONF" "$NGINX_BACKUP"
fi

cat > "$NGINX_CONF" << EOFNGINX
server {
    listen 80;
    server_name ${DOMAIN:-_};

    root $NGINX_HTML;
    index index.html;

    # Security headers
    add_header X-Frame-Options   "SAMEORIGIN"  always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection  "1; mode=block" always;

    # SPA – alla routes hanteras av React
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API (proxyas till Node.js)
    location /api {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Statiska filer – long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOFNGINX

# Aktivera site om symlink saknas
if [ ! -L /etc/nginx/sites-enabled/dykgaraget ]; then
  ln -s "$NGINX_CONF" /etc/nginx/sites-enabled/dykgaraget
  info "Nginx site aktiverad ✓"
else
  info "Nginx site redan aktiverad ✓"
fi

# Ta bort default-site om den blockerar
if [ -L /etc/nginx/sites-enabled/default ]; then
  warn "Tar bort nginx default-site ..."
  rm /etc/nginx/sites-enabled/default
fi

nginx -t 2>/dev/null && systemctl reload nginx
info "Nginx konfigurerad ✓"

# ============================================================
# STEG 8 – PM2 autostart vid omstart
# ============================================================
step "8/9  PM2 startup"

if systemctl list-units --type=service | grep -q "pm2-root"; then
  info "PM2 startup redan konfigurerad ✓"
else
  info "Konfigurerar PM2 startup ..."
  pm2 startup systemd -u root --hp /root | tail -1 | bash
  pm2 save --force
fi

# ============================================================
# STEG 9 – SSL (Certbot) — valfritt
# ============================================================
step "9/9  SSL/TLS"

if [ -z "$DOMAIN" ]; then
  warn "DOMAIN inte satt i scriptet — hoppar över SSL."
  warn "Kör manuellt: certbot --nginx -d dykgaraget.se -d www.dykgaraget.se"
else
  if command -v certbot &>/dev/null; then
    info "Certbot redan installerat ✓"
  else
    info "Installerar certbot ..."
    apt-get install -y certbot python3-certbot-nginx -qq
  fi
  info "Begär SSL-certifikat för $DOMAIN ..."
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos \
    --email "admin@$DOMAIN" || warn "Certbot misslyckades — fortsätt utan SSL"
fi

# ============================================================
# KLAR
# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅  Deployment klar!                           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "📊 PM2 status:"
pm2 status
echo ""
echo "🔗 Åtkomst:"
IP=$(hostname -I | awk '{print $1}')
echo "   Frontend : http://$IP"
echo "   API health: http://$IP/api/health"
echo ""
echo "⚙️  Konfigurationsfiler:"
echo "   Backend  : $BACKEND_DIR/.env"
echo "   Frontend : $FRONTEND_DIR/.env"
echo "   Nginx    : $NGINX_CONF"
echo ""
echo "🔐 Åtgärda innan driftsättning:"
echo "   [ ] Sätt riktiga värden i $BACKEND_DIR/.env"
echo "       - DB_PASSWORD"
echo "       - JWT_SECRET  (minst 32 tecken)"
echo "       - SENDGRID_API_KEY  (om e-post aktiveras)"
echo "       - STRIPE_SECRET_KEY (om betalning aktiveras)"
echo "   [ ] Sätt VITE_API_URL i $FRONTEND_DIR/.env"
echo "   [ ] Sätt DOMAIN i detta script och kör certbot"
echo ""
echo "🔄 Kommande uppdateringar:"
echo "   $SCRIPT_DIR/update-onecom.sh"
echo ""
