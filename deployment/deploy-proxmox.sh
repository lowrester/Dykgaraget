#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_DIR="/var/www/dykgaraget"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
DB_NAME="dykgaraget"
DB_USER="dykgaraget_user"
# Random passwords/secrets generated at runtime
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9')
JWT_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9')
NGINX_CONF="/etc/nginx/sites-available/dykgaraget"

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  error "Please run as root (sudo ./deploy-proxmox.sh)"
  exit 1
fi

echo "════════════════════════════════════════════════════════════"
echo "🌊 Dykgaraget Production Deployment"
echo "════════════════════════════════════════════════════════════"
echo ""

# ========== STEP 1: System Dependencies ==========
step "1/8 Installing system dependencies..."

apt update -qq

# Install essentials if not present
if ! command -v curl &> /dev/null; then
  info "Installing curl..."
  apt install -y curl
else
  info "curl already installed ✓"
fi

if ! command -v git &> /dev/null; then
  info "Installing git..."
  apt install -y git
else
  info "git already installed ✓"
fi

if ! command -v nginx &> /dev/null; then
  info "Installing nginx..."
  apt install -y nginx
else
  info "nginx already installed ✓"
fi

# ========== STEP 2: Node.js ==========
step "2/8 Installing Node.js..."

if ! command -v node &> /dev/null; then
  info "Installing Node.js 18..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
else
  NODE_VERSION=$(node -v)
  info "Node.js already installed: $NODE_VERSION ✓"
fi

# Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
  info "Installing PM2..."
  npm install -g pm2
else
  PM2_VERSION=$(pm2 -v)
  info "PM2 already installed: $PM2_VERSION ✓"
fi

# ========== STEP 3: PostgreSQL ==========
step "3/8 Setting up PostgreSQL..."

if ! command -v psql &> /dev/null; then
  info "Installing PostgreSQL..."
  apt install -y postgresql postgresql-contrib
  systemctl start postgresql
  systemctl enable postgresql
else
  info "PostgreSQL already installed ✓"
fi

# Check if database exists
if sudo -u postgres -i psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
  warn "Database '$DB_NAME' already exists, skipping creation"
else
  info "Creating database '$DB_NAME'..."
  sudo -u postgres -i psql << EOFDB
CREATE DATABASE $DB_NAME;
EOFDB
fi

# Check if user exists
if sudo -u postgres -i psql -t -c '\du' | cut -d \| -f 1 | grep -qw $DB_USER; then
  info "Database user '$DB_USER' already exists, updating password to match generated secret..."
  sudo -u postgres -i psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
else
  info "Creating database user '$DB_USER'..."
  sudo -u postgres -i psql << EOFDB
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOFDB
  info "Database user created with a secure random password ✓"
fi

# ========== STEP 4: Application Directory ==========
step "4/8 Setting up application directory..."

if [ -d "$APP_DIR" ]; then
  warn "Application directory already exists: $APP_DIR"
  read -p "Continue and overwrite? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "Deployment cancelled"
    exit 1
  fi
  info "Backing up existing installation..."
  BACKUP_DIR="${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
  cp -r $APP_DIR $BACKUP_DIR
  info "Backup saved to: $BACKUP_DIR"
else
  info "Creating application directory..."
  mkdir -p $APP_DIR
fi

# ========== STEP 5: Deploy Backend ==========
step "5/8 Deploying backend..."

# Check if backend source exists
if [ ! -d "../backend" ]; then
  error "Backend source directory not found!"
  error "Make sure you're running this from the deployment/ directory"
  exit 1
fi

# Copy backend files
info "Copying backend files..."
rm -rf $BACKEND_DIR
cp -r ../backend $BACKEND_DIR

cd $BACKEND_DIR

# Install dependencies
info "Installing backend dependencies..."
npm install --production --quiet

# Setup .env
if [ -f .env ]; then
  warn ".env file already exists, keeping it"
else
  info "Creating .env file from example..."
  cp .env.example .env
  
  # Inject generated secrets
  sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
  sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
  sed -i "s/DB_USER=.*/DB_USER=$DB_USER/" .env
  sed -i "s/DB_NAME=.*/DB_NAME=$DB_NAME/" .env
  
  info "Injected generated passwords and secrets into $BACKEND_DIR/.env ✓"
fi

# Run migrations
info "Running database migrations..."
if [ -f src/db/migrate.js ]; then
  npm run migrate || warn "Migration failed or already run"
else
  warn "No migration script found, skipping..."
fi

# Create uploads directory
info "Creating uploads directory..."
mkdir -p uploads/invoices
chown -R www-data:www-data uploads

# Start/restart backend with PM2
info "Starting backend with PM2..."
if pm2 list | grep -q "dykgaraget-api"; then
  info "Backend already running, restarting..."
  pm2 restart dykgaraget-api
else
  info "Starting backend for first time..."
  pm2 start src/server.js --name dykgaraget-api
  pm2 save
fi

# ========== STEP 6: Deploy Frontend ==========
step "6/8 Deploying frontend..."

# Check if frontend source exists
if [ ! -d "../frontend" ]; then
  error "Frontend source directory not found!"
  exit 1
fi

# Copy frontend files
info "Copying frontend files..."
rm -rf $FRONTEND_DIR
cp -r ../frontend $FRONTEND_DIR

cd $FRONTEND_DIR

# Install dependencies
info "Installing frontend dependencies..."
npm install --quiet

# Setup .env
if [ -f .env ]; then
  warn ".env file already exists, keeping it"
else
  info "Creating .env file from example..."
  cp .env.example .env
fi

# Build frontend
info "Building frontend..."
npm run build

# Deploy to nginx directory
info "Deploying to nginx..."
NGINX_HTML="/var/www/html/dykgaraget"
rm -rf $NGINX_HTML
mkdir -p $NGINX_HTML
cp -r dist/* $NGINX_HTML/
chown -R www-data:www-data $NGINX_HTML

# ========== STEP 7: Configure Nginx ==========
step "7/8 Configuring nginx..."

if [ -f "$NGINX_CONF" ]; then
  warn "Nginx config already exists, backing up..."
  cp $NGINX_CONF "${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
fi

info "Creating nginx configuration..."
cat > $NGINX_CONF << 'EOFNGINX'
server {
    listen 80;
    server_name dykgaraget.se www.dykgaraget.se;
    
    # Frontend
    root /var/www/html/dykgaraget;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOFNGINX

# Enable site
if [ -L /etc/nginx/sites-enabled/dykgaraget ]; then
  info "Nginx site already enabled"
else
  info "Enabling nginx site..."
  ln -s $NGINX_CONF /etc/nginx/sites-enabled/
fi

# Test and reload nginx
info "Testing nginx configuration..."
if nginx -t 2>/dev/null; then
  info "Reloading nginx..."
  systemctl reload nginx
else
  error "Nginx configuration test failed!"
  exit 1
fi

# ========== STEP 8: PM2 Startup ==========
step "8/8 Configuring PM2 startup..."

if systemctl list-units --type=service | grep -q pm2-root; then
  info "PM2 startup already configured"
else
  info "Setting up PM2 startup..."
  pm2 startup systemd -u root --hp /root
  pm2 save
fi

# ========== COMPLETION ==========
echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📊 System Status:"
pm2 status
echo ""
echo "🔗 Access Points:"
echo "   Frontend: http://$(hostname -I | awk '{print $1}')"
echo "   API Health: http://$(hostname -I | awk '{print $1}')/api/health"
echo ""
echo "⚙️  Configuration Files:"
echo "   Backend .env: $BACKEND_DIR/.env"
echo "   Frontend .env: $FRONTEND_DIR/.env"
echo "   Nginx config: $NGINX_CONF"
echo ""
echo "🔐 Security Checklist:"
echo "   [x] Database password generated automatically"
echo "   [x] JWT_SECRET generated automatically"
echo "   [ ] Setup SSL with: certbot --nginx -d dykgaraget.se"
echo "   [ ] Configure firewall: ufw allow 22,80,443"
echo ""
echo "📝 Next Steps:"
echo "   1. Review configuration: cat $BACKEND_DIR/.env"
echo "   2. Test the API: curl http://localhost/api/health"
echo ""
echo "🔄 To update: cd $APP_DIR && ./deployment/update.sh"
echo ""
