# 🌊 Dykgaraget Production System

## 🎯 SYSTEM ÖVERSIKT

**Fullständig production-ready lösning med:**
- ✅ Backend API (Node.js + Express + PostgreSQL)
- ✅ Frontend (React + Vite)
- ✅ Feature Toggles (Equipment, Invoicing, Payment)
- ✅ PDF Fakturering
- ✅ Email Integration
- ✅ Stripe Payment (optional)
- ✅ Proxmox Deployment Scripts

## 📦 FEATURE MODULES

### 1. Equipment Module
- Utrustningshantering
- Inventarie
- Uthyrning
- **Toggle:** `feature_equipment`

### 2. Invoicing Module
- PDF fakturagenerering
- Email till kund
- Fakturahistorik
- **Toggle:** `feature_invoicing`
- **Required for:** Payment Module

### 3. Payment Module
- Stripe integration
- Swish (optional)
- Klarna (optional)
- **Toggle:** `feature_payment`
- **Requires:** Invoicing Module

### 4. Email Module
- Bokningsbekräftelser
- Faktura-utskick
- Påminnelser
- **Toggle:** `feature_email`

## 🔧 FEATURE DEPENDENCIES

```
Payment Module
    ↓ requires
Invoicing Module
```

**Validering:**
- Invoicing KAN aktiveras utan Payment
- Payment kan INTE aktiveras utan Invoicing
- Equipment är oberoende
- Email är oberoende

## 🚀 DEPLOYMENT

### Proxmox (Rekommenderat)

```bash
# 1. Upload files to server
scp -r dykgaraget-production root@your-server:/tmp/

# 2. SSH to server
ssh root@your-server

# 3. Run deployment
cd /tmp/dykgaraget-production/deployment
chmod +x deploy-proxmox.sh
./deploy-proxmox.sh
```

### Manual Deployment

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Edit .env med dina credentials
npm run migrate
npm start

# Frontend
cd frontend
npm install
npm run build
# Deploy dist/ till nginx/apache
```

## 🔄 UPDATES

```bash
# On server
cd /var/www/dykgaraget
git pull
./deployment/update.sh
```

## 🎛️ FEATURE MANAGEMENT

### Via Admin UI

1. Login som admin
2. Gå till Settings → Features
3. Toggle features on/off
4. Sparas direkt i databas

### Via API

```bash
# Get all features
curl https://api.dykgaraget.se/api/settings/features

# Enable invoicing
curl -X PUT https://api.dykgaraget.se/api/settings/feature_invoicing \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"true"}'

# Enable payment (requires invoicing first)
curl -X PUT https://api.dykgaraget.se/api/settings/feature_payment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"true"}'
```

### Via Database

```sql
-- View all features
SELECT * FROM settings WHERE category = 'features';

-- Enable feature
UPDATE settings SET value = 'true' WHERE key = 'feature_equipment';

-- Disable feature
UPDATE settings SET value = 'false' WHERE key = 'feature_payment';
```

## 📊 SYSTEM ARCHITECTURE

```
┌─────────────┐
│   Nginx     │ ← SSL, Static files, Reverse proxy
└──────┬──────┘
       │
┌──────▼──────────────────────────────┐
│         React Frontend              │
│  - Checks feature flags on load     │
│  - Shows/hides modules dynamically  │
│  - API calls via axios              │
└──────┬──────────────────────────────┘
       │
┌──────▼──────────────────────────────┐
│      Express Backend (PM2)          │
│  - Feature middleware checks        │
│  - JWT authentication               │
│  - Rate limiting                    │
└──────┬──────────────────────────────┘
       │
┌──────▼──────────────────────────────┐
│       PostgreSQL Database           │
│  - settings table (feature flags)   │
│  - All business data                │
└─────────────────────────────────────┘
```

## 🔐 ENVIRONMENT VARIABLES

### Backend (.env)
```bash
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_NAME=dykgaraget
DB_USER=dykgaraget_user
DB_PASSWORD=your_password
JWT_SECRET=min_32_characters_secret
SENDGRID_API_KEY=your_sendgrid_key
STRIPE_SECRET_KEY=sk_live_xxx
```

### Frontend (.env)
```bash
VITE_API_URL=https://api.dykgaraget.se
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

## 📄 INVOICE FEATURES

### PDF Generation
```javascript
// Generate invoice PDF
POST /api/invoices
{
  "booking_id": 123,
  "user_id": 456
}

// Returns invoice with PDF
{
  "id": 789,
  "invoice_number": "DYK-2024-001",
  "pdf_url": "/uploads/invoices/invoice_789.pdf"
}
```

### Email Invoice
```javascript
// Email invoice to customer
POST /api/invoices/:id/email

// Sends email with PDF attachment
```

### Download Invoice
```javascript
// Download PDF
GET /api/invoices/:id/pdf

// Returns PDF file
```

## 💳 PAYMENT FLOW

### With Invoicing + Payment enabled:

1. **Booking Created** → Invoice generated
2. **Invoice Sent** → Email with PDF
3. **Payment Link** → Stripe checkout (if enabled)
4. **Payment Confirmed** → Webhook updates status

### With only Invoicing enabled:

1. **Booking Created** → Invoice generated
2. **Invoice Sent** → Email with PDF
3. **Manual Payment** → Banköverföring
4. **Admin Marks Paid** → Status updated

## 🧪 TESTING

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# API health check
curl https://api.dykgaraget.se/health

# Feature flags check
curl https://api.dykgaraget.se/api/settings/features
```

## 📁 FILE STRUCTURE

```
dykgaraget-production/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── db/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── store/
│   │   ├── pages/
│   │   └── components/
│   └── package.json
└── deployment/
    ├── deploy-proxmox.sh
    ├── update.sh
    └── README.md
```

## ✅ POST-DEPLOYMENT CHECKLIST

- [ ] Database migrated
- [ ] PM2 running backend
- [ ] Nginx serving frontend
- [ ] SSL certificate installed
- [ ] Feature flags configured:
  - [ ] Equipment: enabled/disabled
  - [ ] Invoicing: enabled/disabled
  - [ ] Payment: enabled/disabled (only if invoicing enabled)
  - [ ] Email: enabled/disabled
- [ ] SendGrid configured (if email enabled)
- [ ] Stripe configured (if payment enabled)
- [ ] Test invoice generation
- [ ] Test email sending
- [ ] Test payment flow (if enabled)

## 🆘 TROUBLESHOOTING

### Backend not starting
```bash
pm2 logs dykgaraget-api
# Check .env file
# Check database connection
```

### Frontend not loading
```bash
nginx -t
systemctl status nginx
# Check build output
```

### Features not toggling
```bash
# Check database
psql -d dykgaraget -c "SELECT * FROM settings WHERE category = 'features'"

# Check API response
curl https://api.dykgaraget.se/api/settings/features
```

### Invoice PDF not generating
```bash
# Check uploads directory exists
mkdir -p /var/www/dykgaraget/backend/uploads/invoices
chown -R www-data:www-data /var/www/dykgaraget/backend/uploads

# Check permissions
ls -la /var/www/dykgaraget/backend/uploads
```

---

**PRODUCTION READY! 🚀**
