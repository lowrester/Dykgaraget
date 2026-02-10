# 🚀 DYKGARAGET PRODUCTION - COMPLETE SYSTEM

## 📦 FULLSTÄNDIGT SYSTEM INKLUDERAT

### Backend API (Node.js + PostgreSQL)
- ✅ RESTful API med Express
- ✅ PostgreSQL database
- ✅ JWT authentication
- ✅ Feature toggle system
- ✅ Invoice PDF generation (PDFKit)
- ✅ Email sending (Nodemailer + SendGrid)
- ✅ Stripe payment integration
- ✅ File upload (Multer)
- ✅ Rate limiting
- ✅ Security (Helmet, CORS)

### Frontend (React + Vite)
- ✅ API integration med Axios
- ✅ Zustand state management (med API, UTAN localStorage)
- ✅ Feature-aware components
- ✅ Dynamic module loading
- ✅ Admin feature toggle UI
- ✅ Invoice download/email
- ✅ Payment integration

### Deployment
- ✅ Proxmox deployment script
- ✅ Nginx configuration
- ✅ PM2 process management
- ✅ SSL/TLS setup
- ✅ Database migration scripts
- ✅ Update script

## 🎯 FEATURE TOGGLES

### Equipment Module (feature_equipment)
**När AKTIVERAD:**
- Utrustningslista i admin
- Utrustningsval vid bokning
- Inventariehantering

**När INAKTIVERAD:**
- Döljs i navigation
- API endpoints disabled
- Bokningsflöde skippar equipment-steget

### Invoicing Module (feature_invoicing)
**När AKTIVERAD:**
- Fakturagenering
- PDF skapande
- Email-utskick
- Fakturahistorik

**När INAKTIVERAD:**
- Fakturaknapp dold
- PDF generation disabled
- Email-funktioner relaterade till faktura disabled

### Payment Module (feature_payment)
**När AKTIVERAD (kräver invoicing):**
- Stripe checkout
- Swish/Klarna (optional)
- Payment status tracking
- Webhooks

**När INAKTIVERAD:**
- Betala-knapp dold
- Visar endast "Betala via faktura"
- Stripe integration inactive

### Email Module (feature_email)
**När AKTIVERAD:**
- Bokningsbekräftelser
- Faktura-email
- Påminnelser
- Lösenordsåterställning

**När INAKTIVERAD:**
- Emails skickas ej
- Visar meddelande "Email disabled by admin"

## 🔧 BACKEND API ENDPOINTS

### Settings
```
GET    /api/settings              # Alla inställningar (admin)
GET    /api/settings/features     # Feature flags (public)
PUT    /api/settings/:key         # Uppdatera setting (admin)
```

### Courses
```
GET    /api/courses               # Hämta alla kurser
POST   /api/courses               # Skapa kurs (admin)
PUT    /api/courses/:id           # Uppdatera kurs (admin)
DELETE /api/courses/:id           # Ta bort kurs (admin)
```

### Equipment (requires feature_equipment)
```
GET    /api/equipment             # Hämta utrustning
POST   /api/equipment             # Skapa utrustning (admin)
PUT    /api/equipment/:id         # Uppdatera (admin)
DELETE /api/equipment/:id         # Ta bort (admin)
```

### Invoices (requires feature_invoicing)
```
GET    /api/invoices              # Hämta fakturor (admin)
POST   /api/invoices              # Skapa faktura (admin)
GET    /api/invoices/:id/pdf      # Download PDF
POST   /api/invoices/:id/email    # Skicka via email
```

### Payments (requires feature_payment + feature_invoicing)
```
POST   /api/payments/create-checkout    # Stripe checkout
POST   /api/payments/webhook            # Stripe webhook
GET    /api/payments/:id                # Payment status
```

## 💾 DATABASE SCHEMA

### settings table
```sql
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Default values:**
- feature_equipment: 'true'
- feature_invoicing: 'true'
- feature_payment: 'false' (disabled by default)
- feature_email: 'true'

### Feature Dependencies in Code
```javascript
// Backend middleware validates
if (feature_payment && !feature_invoicing) {
  throw new Error('Invoicing must be enabled first')
}
```

## 📄 INVOICE PDF FEATURES

### PDF Layout
- Company header (from settings)
- Invoice number (auto-generated: DYK-YYYY-NNN)
- Customer info
- Line items table
- Subtotal, VAT, Total
- Payment terms
- Bank account info

### Generation
```javascript
// Usage
const pdf = await generateInvoicePDF(invoiceId)
// Returns: /uploads/invoices/invoice_123.pdf
```

### Email Sending
```javascript
// Send invoice via email
await emailInvoice(invoiceId)
// Sends to customer with PDF attachment
```

## 🔐 SECURITY FEATURES

### Authentication
- JWT tokens (access + refresh)
- Bcrypt password hashing
- Rate limiting
- Helmet security headers

### Authorization
- Role-based (admin, customer, instructor)
- Feature-based middleware
- Resource ownership validation

### Data Protection
- Input sanitization
- SQL injection prevention (parameterized queries)
- XSS protection
- CORS configuration

## 🚀 DEPLOYMENT PROCESS

### 1. Preparation
```bash
# On your local machine
git clone <repo>
cd dykgaraget-production
```

### 2. Upload to Proxmox VM
```bash
scp -r . root@your-vm-ip:/tmp/dykgaraget
```

### 3. Run Deployment
```bash
ssh root@your-vm-ip
cd /tmp/dykgaraget/deployment
chmod +x deploy-proxmox.sh
./deploy-proxmox.sh
```

### 4. Configure
```bash
# Edit environment variables
nano /var/www/dykgaraget/backend/.env

# Update database password
sudo -u postgres psql
ALTER USER dykgaraget_user WITH PASSWORD 'new_secure_password';
```

### 5. Test
```bash
# Check API health
curl http://localhost:3000/api/health

# Check frontend
curl http://localhost

# Check features
curl http://localhost:3000/api/settings/features
```

## 🔄 UPDATE WORKFLOW

```bash
# On server
cd /var/www/dykgaraget
git pull origin main

# Run update script
./deployment/update.sh

# Or manual:
cd backend && npm install && pm2 restart dykgaraget-api
cd ../frontend && npm run build && cp -r dist/* /var/www/html/dykgaraget/
```

## 🎛️ ADMIN FEATURE MANAGEMENT

### UI (Recommended)
1. Login as admin
2. Navigate to Settings → Features
3. Toggle switches
4. Changes apply immediately
5. Frontend reloads feature state

### API
```bash
# Get current features
curl -X GET http://api.dykgaraget.se/api/settings/features

Response:
{
  "equipment": true,
  "invoicing": true,
  "payment": false,
  "email": true
}

# Enable payment (validates invoicing is enabled)
curl -X PUT http://api.dykgaraget.se/api/settings/feature_payment \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"true"}'
```

### Database
```sql
-- View all features
SELECT * FROM settings WHERE key LIKE 'feature_%';

-- Update feature
UPDATE settings 
SET value = 'true', updated_at = NOW() 
WHERE key = 'feature_payment';

-- Check dependencies (handled by API, not enforced in DB)
```

## 📊 MONITORING

### PM2 Dashboard
```bash
pm2 monit
pm2 logs dykgaraget-api
pm2 status
```

### Database
```bash
sudo -u postgres psql -d dykgaraget

-- Active features
SELECT key, value FROM settings WHERE category = 'features';

-- Invoice count
SELECT COUNT(*) FROM invoices;

-- Booking count
SELECT COUNT(*) FROM bookings;
```

### Nginx
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## ✅ TESTING CHECKLIST

### Backend
- [ ] Server starts without errors
- [ ] Database connection works
- [ ] API health check responds
- [ ] JWT authentication works
- [ ] Feature toggle validation works
- [ ] Invoice PDF generates
- [ ] Email sends (if enabled)
- [ ] Payment creates checkout (if enabled)

### Frontend
- [ ] App loads without errors
- [ ] API connection works
- [ ] Login works
- [ ] Features show/hide based on toggles
- [ ] Equipment hidden when disabled
- [ ] Invoice button hidden when disabled
- [ ] Payment hidden when disabled or invoicing disabled

### Integration
- [ ] Create booking → Invoice generated
- [ ] Download invoice PDF
- [ ] Email invoice
- [ ] Toggle equipment → UI updates
- [ ] Toggle payment → requires invoicing check
- [ ] Disable invoicing → payment auto-disables

## 🐛 TROUBLESHOOTING

### "Payment requires invoicing to be enabled"
```bash
# Enable invoicing first
curl -X PUT .../api/settings/feature_invoicing -d '{"value":"true"}'
# Then enable payment
curl -X PUT .../api/settings/feature_payment -d '{"value":"true"}'
```

### PDF generation fails
```bash
# Create uploads directory
mkdir -p /var/www/dykgaraget/backend/uploads/invoices
chown -R www-data:www-data /var/www/dykgaraget/backend/uploads
```

### Email not sending
```bash
# Check SendGrid API key
grep SENDGRID_API_KEY /var/www/dykgaraget/backend/.env

# Test email
curl -X POST http://localhost:3000/api/test-email
```

---

## 📂 FILE STRUCTURE

Complete file listing available in project. Key files:

**Backend:**
- src/server.js - Main server
- src/routes/settings.js - Feature toggle API
- src/routes/invoices.js - Invoice endpoints
- src/services/invoice.js - PDF generation
- src/services/email.js - Email sending
- src/middleware/auth.js - Authentication + feature checks

**Frontend:**
- src/api/client.js - Axios API client
- src/store/settingsStore.js - Feature flags
- src/pages/admin/FeatureSettings.jsx - Toggle UI
- src/hooks/useFeature.js - Feature checking hook

**Deployment:**
- deployment/deploy-proxmox.sh - Full deployment
- deployment/update.sh - Update script
- deployment/nginx.conf - Nginx configuration

---

**SYSTEM COMPLET! 🎉**

All functionality included. Ready for production deployment on Proxmox.
