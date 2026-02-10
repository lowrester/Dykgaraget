# 🛠️ DYKGARAGET – Driftsättningsguide

---

## ⚡ SNABBSTART (one.com VPS)

```bash
# 1. Kopiera filerna till servern
scp dykgaraget-PRODUCTION-FINAL.zip root@din-server:/tmp/

# 2. SSH in på servern
ssh root@din-server

# 3. Packa upp och kör
cd /tmp && unzip dykgaraget-PRODUCTION-FINAL.zip
cd dykgaraget-production/deployment
chmod +x deploy-onecom.sh
./deploy-onecom.sh
```

---

## 🔐 ADMIN-INLOGGNING

**URL:** `https://din-domän.se/admin/login`

| Fält          | Värde        |
|---------------|--------------|
| Användarnamn  | `admin`      |
| Lösenord      | `Admin123!`  |

> ⚠️ **BYT LÖSENORDET** efter första inloggning via Admin → Inställningar

### Ändra lösenord INNAN deploy

Sätt lösenordet i `.env` **innan** du kör `npm run migrate`:
```bash
# backend/.env
ADMIN_PASSWORD=DittSäkraLösenord123!
```

### Återställ glömt lösenord

```bash
ssh root@din-server
cd /var/www/dykgaraget/backend
ADMIN_PASSWORD=NyttLösenord node src/db/reset-password.js
```

---

## ⚙️ KONFIGURATIONSFILER

### backend/.env (KRITISK — fyll i alla värden)
```env
NODE_ENV=production
PORT=3000

FRONTEND_URL=https://din-domän.se

DB_HOST=localhost
DB_PORT=5432
DB_NAME=dykgaraget
DB_USER=dykgaraget_user
DB_PASSWORD=DITT_DB_LÖSENORD

# Generera: openssl rand -base64 48
JWT_SECRET=MINST_32_SLUMPMÄSSIGA_TECKEN_HÄR
JWT_EXPIRES_IN=7d

# Lösenord för admin-användaren (sätts vid migrate)
ADMIN_PASSWORD=Admin123!

# Valfritt - krävs bara om email-feature är på
SENDGRID_API_KEY=SG.xxxx
EMAIL_FROM=info@din-domän.se

# Valfritt - krävs bara om betalnings-feature är på
STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

### frontend/.env
```env
VITE_API_URL=/api
```

---

## 🔄 UPPDATERA APPLIKATIONEN

```bash
ssh root@din-server
cd /var/www/dykgaraget/deployment

# Uppdatera allt
./update-onecom.sh

# Bara backend (snabbare vid API-ändringar)
./update-onecom.sh --backend-only

# Bara frontend (snabbare vid UI-ändringar)
./update-onecom.sh --frontend-only
```

---

## 🗄️ DATABASMIGRERING

```bash
cd /var/www/dykgaraget/backend

# Kör migreringar (skapar tabeller + seed-data)
npm run migrate

# Återställ admin-lösenord
node src/db/reset-password.js
# eller med eget lösenord:
ADMIN_PASSWORD=NyttLösenord node src/db/reset-password.js
```

---

## 📊 DRIFT & ÖVERVAKNING

```bash
# PM2 status
pm2 status

# Loggar (live)
pm2 logs dykgaraget-api

# Loggar (senaste 100 rader)
pm2 logs dykgaraget-api --lines 100

# CPU/minne
pm2 monit

# Starta om backend
pm2 restart dykgaraget-api

# Nginx status
systemctl status nginx

# Kontrollera API
curl http://localhost/api/health
```

---

## 🔙 ROLLBACK

```bash
# Hitta senaste backup
ls -lt /var/www/dykgaraget_backup_* | head -3

# Återställ
cp -r /var/www/dykgaraget_backup_[datum]/* /var/www/dykgaraget/
pm2 restart dykgaraget-api
systemctl reload nginx
```

---

## 🔒 SÄKERHETSCHECKLISTA

Kör igenom denna lista INNAN live-driftsättning:

- [ ] `JWT_SECRET` bytt till slumpmässig sträng (≥32 tecken)
- [ ] `DB_PASSWORD` bytt från defaultvärdet
- [ ] `ADMIN_PASSWORD` satt till eget lösenord
- [ ] Admin-lösenordet bytts i UI efter första inloggning
- [ ] `NODE_ENV=production` i .env
- [ ] HTTPS/SSL aktiverat (certbot körd)
- [ ] Firewall konfigurerad (port 80, 443, 22)
- [ ] `.env` filen är inte tillgänglig från webben (nginx block)

### Nginx .env-block (lägg till i nginx config):
```nginx
location ~ /\.env {
    deny all;
    return 404;
}
```

---

## 🔧 FELSÖKNING

### Backend startar inte
```bash
pm2 logs dykgaraget-api --lines 50
# Vanliga orsaker:
# - DB_PASSWORD fel → kontrollera .env
# - JWT_SECRET saknas → lägg till i .env
# - Port 3000 upptagen → lsof -i :3000
```

### Kan inte logga in på admin
```bash
# 1. Kontrollera att backend körs
curl http://localhost:3000/api/health

# 2. Testa login direkt
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'

# 3. Om fel hash - återställ lösenord
cd /var/www/dykgaraget/backend
node src/db/reset-password.js
```

### Databasen svarar inte
```bash
systemctl status postgresql
systemctl start postgresql
sudo -u postgres psql -c "\l" # lista databaser
```

### Nginx 502 Bad Gateway
```bash
# Backend är nere
pm2 restart dykgaraget-api
pm2 logs dykgaraget-api --lines 20
```

---

## 📁 FILSTRUKTUR

```
/var/www/dykgaraget/
├── backend/
│   ├── .env              ← KONFIGURERA DETTA
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── db/
│       │   ├── connection.js
│       │   ├── migrate.js
│       │   └── reset-password.js   ← Återställ lösenord
│       ├── middleware/auth.js
│       ├── routes/
│       └── services/
├── frontend/
│   ├── .env              ← Sätt VITE_API_URL=/api
│   └── src/
└── deployment/
    ├── deploy-onecom.sh
    ├── update-onecom.sh
    └── MANAGEMENT-GUIDE.md  ← Du är här
```

/var/www/html/dykgaraget/   ← Byggd frontend (nginx servar härifrån)
