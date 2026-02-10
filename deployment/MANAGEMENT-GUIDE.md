# 🛠️ DYKGARAGET MANAGEMENT GUIDE

## 📜 ALLA SCRIPTS

### Deployment
- `deploy-proxmox.sh` - Full deployment (initial install)

### Updates
- `update.sh` - Update både backend och frontend

### Backend Management
- `start-backend.sh` - Starta backend (PM2)
- `stop-backend.sh` - Stoppa backend

### Frontend Management
- `start-frontend.sh` - Bygg och deploya frontend
- `stop-frontend.sh` - Ta ner frontend (visa maintenance page)

### Database Management
- `start-database.sh` - Starta PostgreSQL
- `stop-database.sh` - Stoppa PostgreSQL

---

## 🚀 DEPLOYMENT (Första Gången)

### Förberedelser
```bash
# Från din dator - upload filer
scp dykgaraget-PRODUCTION-COMPLETE.zip root@your-server:/tmp/

# SSH till server
ssh root@your-server

# Unzip
cd /tmp
unzip dykgaraget-PRODUCTION-COMPLETE.zip
cd dykgaraget-production/deployment
```

### Kör Deployment
```bash
chmod +x deploy-proxmox.sh
./deploy-proxmox.sh
```

**Scriptet hanterar:**
- ✅ Kollar om Node.js redan finns
- ✅ Kollar om PostgreSQL redan finns
- ✅ Kollar om databas redan finns
- ✅ Kollar om användare redan finns
- ✅ Backar up befintlig installation
- ✅ Frågar innan overwrite
- ✅ Skapar uploads directory
- ✅ Konfigurerar PM2
- ✅ Konfigurerar Nginx

### Efter Deployment
```bash
# 1. Ändra database password
sudo -u postgres psql
ALTER USER dykgaraget_user WITH PASSWORD 'your_secure_password';
\q

# 2. Uppdatera backend .env
nano /var/www/dykgaraget/backend/.env

# Ändra:
DB_PASSWORD=your_secure_password
JWT_SECRET=min_32_characters_random_string
SENDGRID_API_KEY=your_key  # om email enabled
STRIPE_SECRET_KEY=sk_live_xxx  # om payment enabled

# 3. Uppdatera frontend .env
nano /var/www/dykgaraget/frontend/.env

# Ändra:
VITE_API_URL=https://api.dykgaraget.se
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx  # om payment enabled

# 4. Restart backend
pm2 restart dykgaraget-api

# 5. Test
curl http://localhost/api/health
```

---

## 🔄 UPDATES (Efter Initial Deployment)

### Standard Update (Rekommenderat)
```bash
cd /var/www/dykgaraget
./deployment/update.sh
```

**Scriptet hanterar:**
- ✅ Skapar backup innan update
- ✅ Git pull (om git repo)
- ✅ Kollar om package.json ändrats
- ✅ Installerar nya dependencies (endast om nödvändigt)
- ✅ Kör migrations
- ✅ Restartar backend
- ✅ Bygger frontend
- ✅ Deplojar till nginx
- ✅ Rensar gamla backups (behåller 5 senaste)

### Manuell Update
```bash
# Backend
cd /var/www/dykgaraget/backend
git pull
npm install --production
npm run migrate
pm2 restart dykgaraget-api

# Frontend
cd /var/www/dykgaraget/frontend
git pull
npm install
npm run build
cp -r dist/* /var/www/html/dykgaraget/
systemctl reload nginx
```

### Rollback Efter Misslyckad Update
```bash
# Hitta backup
ls -lt /var/www/dykgaraget_backup_*

# Restore från backup
cp -r /var/www/dykgaraget_backup_YYYYMMDD_HHMMSS/* /var/www/dykgaraget/

# Restart
pm2 restart dykgaraget-api
systemctl reload nginx
```

---

## 🎯 COMPONENT MANAGEMENT

### Backend Operations

**Start Backend**
```bash
./start-backend.sh
```
- Startar PM2 process
- Sparar till PM2 startup
- Visar status

**Stop Backend**
```bash
./stop-backend.sh
```
- Stoppar PM2 process
- API blir otillgänglig

**Restart Backend**
```bash
pm2 restart dykgaraget-api
```

**View Logs**
```bash
pm2 logs dykgaraget-api
pm2 logs dykgaraget-api --lines 100
pm2 logs dykgaraget-api --err  # endast errors
```

**Monitor**
```bash
pm2 monit
```

---

### Frontend Operations

**Start/Deploy Frontend**
```bash
./start-frontend.sh
```
- Bygger production build
- Deplojar till nginx
- Reloader nginx

**Stop Frontend (Maintenance Mode)**
```bash
./stop-frontend.sh
```
- Tar bort frontend filer
- Visar maintenance page
- Användare ser "🔧 Underhåll"

**Quick Rebuild**
```bash
cd /var/www/dykgaraget/frontend
npm run build
cp -r dist/* /var/www/html/dykgaraget/
```

---

### Database Operations

**Start Database**
```bash
./start-database.sh
```
- Startar PostgreSQL service
- Testar connection

**Stop Database**
```bash
./stop-database.sh
```
- ⚠️ VARNING: Stoppar hela databasen
- Frågar om bekräftelse
- Backend kommer att faila

**Database Backup**
```bash
# Backup
sudo -u postgres pg_dump dykgaraget > backup_$(date +%Y%m%d).sql

# Restore
sudo -u postgres psql dykgaraget < backup_YYYYMMDD.sql
```

**Connect to Database**
```bash
sudo -u postgres psql -d dykgaraget
```

**Common Queries**
```sql
-- Visa tables
\dt

-- Visa users
SELECT username, email, role FROM users;

-- Visa features
SELECT * FROM settings WHERE category = 'features';

-- Visa invoices
SELECT invoice_number, total_amount, status FROM invoices ORDER BY created_at DESC LIMIT 10;

-- Exit
\q
```

---

## 🔍 MONITORING & TROUBLESHOOTING

### Check System Status

**All Services**
```bash
# Backend
pm2 status

# Frontend
ls -lh /var/www/html/dykgaraget

# Database
systemctl status postgresql

# Nginx
systemctl status nginx
```

**Quick Health Check**
```bash
# API
curl http://localhost/api/health

# Expected response:
{"status":"healthy","timestamp":"2024-..."}

# Feature Flags
curl http://localhost/api/settings/features

# Expected response:
{"equipment":true,"invoicing":true,"payment":false,"email":true}
```

---

### Common Issues

**Backend Won't Start**
```bash
# Check logs
pm2 logs dykgaraget-api --err

# Common issues:
# 1. Database not running
./start-database.sh

# 2. Wrong .env config
nano /var/www/dykgaraget/backend/.env

# 3. Port already in use
lsof -i :3000
# Kill process if needed

# 4. Missing dependencies
cd /var/www/dykgaraget/backend
npm install
```

**Frontend Not Loading**
```bash
# Check nginx
systemctl status nginx
nginx -t

# Check files
ls -lh /var/www/html/dykgaraget

# Rebuild
cd /var/www/dykgaraget/frontend
npm run build
cp -r dist/* /var/www/html/dykgaraget/
```

**Database Connection Errors**
```bash
# Check if running
systemctl status postgresql

# Test connection
sudo -u postgres psql -d dykgaraget -c "SELECT 1"

# Check credentials
grep DB_ /var/www/dykgaraget/backend/.env
```

**Features Not Toggling**
```bash
# Check database
sudo -u postgres psql -d dykgaraget
SELECT * FROM settings WHERE key LIKE 'feature_%';

# Manual update if needed
UPDATE settings SET value = 'true' WHERE key = 'feature_equipment';
```

---

## 📊 LOGS & DEBUGGING

### Backend Logs
```bash
# Real-time
pm2 logs dykgaraget-api

# Last 100 lines
pm2 logs dykgaraget-api --lines 100

# Only errors
pm2 logs dykgaraget-api --err

# Save to file
pm2 logs dykgaraget-api --lines 1000 > logs.txt
```

### Nginx Logs
```bash
# Access log
tail -f /var/log/nginx/access.log

# Error log
tail -f /var/log/nginx/error.log

# Grep for errors
grep "error" /var/log/nginx/error.log
```

### Database Logs
```bash
# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-14-main.log
```

---

## 🔐 SECURITY MAINTENANCE

### Update System
```bash
apt update && apt upgrade -y
```

### Update Node Packages
```bash
# Backend
cd /var/www/dykgaraget/backend
npm audit
npm audit fix

# Frontend
cd /var/www/dykgaraget/frontend
npm audit
npm audit fix
```

### Check Open Ports
```bash
netstat -tulpn | grep LISTEN
```

### Firewall
```bash
# Check status
ufw status

# Configure if needed
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

---

## 📋 MAINTENANCE CHECKLIST

### Daily
- [ ] Check PM2 status: `pm2 status`
- [ ] Check API health: `curl localhost/api/health`

### Weekly
- [ ] Review logs: `pm2 logs dykgaraget-api --lines 100`
- [ ] Check disk space: `df -h`
- [ ] Check database size: `sudo -u postgres psql -d dykgaraget -c "\l+"`

### Monthly
- [ ] Update system: `apt update && apt upgrade`
- [ ] Update dependencies: `npm audit fix`
- [ ] Backup database: `pg_dump dykgaraget > backup.sql`
- [ ] Clean old backups: (auto in update script)
- [ ] Review and rotate logs

### As Needed
- [ ] Toggle features via admin UI
- [ ] Monitor invoice generation
- [ ] Check email delivery (if enabled)
- [ ] Test payment flow (if enabled)

---

## 🎯 QUICK REFERENCE

### Restart Everything
```bash
pm2 restart dykgaraget-api
systemctl reload nginx
```

### Stop Everything
```bash
./stop-backend.sh
./stop-frontend.sh
# Database usually stays running
```

### Start Everything
```bash
./start-database.sh
./start-backend.sh
./start-frontend.sh
```

### Full Update
```bash
cd /var/www/dykgaraget
./deployment/update.sh
```

### Emergency Rollback
```bash
# Find latest backup
ls -lt /var/www/dykgaraget_backup_* | head -1

# Restore
cp -r /var/www/dykgaraget_backup_YYYYMMDD_HHMMSS/* /var/www/dykgaraget/

# Restart
pm2 restart dykgaraget-api
systemctl reload nginx
```

---

**KOMPLETT MANAGEMENT GUIDE! 🎉**
