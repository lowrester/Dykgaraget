#!/bin/bash
# ============================================================
# Dykgaraget - Diagnosscript
# Kör detta om något inte fungerar:
#   chmod +x test-setup.sh && ./test-setup.sh
# ============================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
fail() { echo -e "${RED}  ✗${NC} $1"; ERRORS=$((ERRORS+1)); }
warn() { echo -e "${YELLOW}  !${NC} $1"; }
ERRORS=0

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   🔍  Dykgaraget Setup Diagnostik            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ---------- Node.js ----------
echo "[ Node.js ]"
if command -v node &>/dev/null; then
  V=$(node -v); ok "Node.js: $V"
  [[ "$V" < "v18" ]] && warn "Rekommenderar Node.js 18+"
else
  fail "Node.js saknas"
fi

# ---------- PM2 ----------
echo "[ PM2 ]"
if command -v pm2 &>/dev/null; then
  ok "PM2 installerat"
  if pm2 list 2>/dev/null | grep -q "dykgaraget-api"; then
    STATUS=$(pm2 list 2>/dev/null | grep "dykgaraget-api" | awk '{print $10}')
    [[ "$STATUS" == "online" ]] && ok "dykgaraget-api: online" || fail "dykgaraget-api: $STATUS"
  else
    fail "PM2-process 'dykgaraget-api' saknas - kör: pm2 start src/server.js --name dykgaraget-api"
  fi
else
  fail "PM2 saknas - kör: npm install -g pm2"
fi

# ---------- PostgreSQL ----------
echo "[ PostgreSQL ]"
if command -v psql &>/dev/null; then
  ok "psql tillgängligt"
  if systemctl is-active --quiet postgresql 2>/dev/null; then
    ok "PostgreSQL körs"
  else
    fail "PostgreSQL är inte igång - kör: systemctl start postgresql"
  fi
else
  fail "PostgreSQL saknas"
fi

# ---------- .env ----------
BACKEND_DIR="/var/www/dykgaraget/backend"
echo "[ .env ]"
if [ -f "$BACKEND_DIR/.env" ]; then
  ok ".env finns"
  source "$BACKEND_DIR/.env" 2>/dev/null || true
  
  if [ -z "$JWT_SECRET" ] || [[ "$JWT_SECRET" == *"BYTA_UT"* ]] || [[ "$JWT_SECRET" == *"your_jwt"* ]]; then
    fail "JWT_SECRET är inte satt! Generera ett: openssl rand -base64 48"
  elif [ ${#JWT_SECRET} -lt 32 ]; then
    fail "JWT_SECRET är för kort (${#JWT_SECRET} tecken, kräver 32+)"
  else
    ok "JWT_SECRET satt (${#JWT_SECRET} tecken)"
  fi
  
  if [ -z "$DB_PASSWORD" ] || [[ "$DB_PASSWORD" == *"BYTA_UT"* ]] || [[ "$DB_PASSWORD" == "changeme123" ]]; then
    warn "DB_PASSWORD verkar vara ett defaultvärde"
  else
    ok "DB_PASSWORD satt"
  fi
else
  fail ".env saknas i $BACKEND_DIR"
  warn "Kör: cp .env.example .env && nano .env"
fi

# ---------- API hälsa ----------
echo "[ API ]"
if command -v curl &>/dev/null; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
  if [ "$HTTP" == "200" ]; then
    ok "API svarar på port 3000"
  else
    fail "API svarar inte (HTTP $HTTP) - kolla: pm2 logs dykgaraget-api"
  fi
  
  # Testa login
  echo "[ Inloggning ]"
  ADMIN_PW="${ADMIN_PASSWORD:-Admin123!}"
  LOGIN=$(curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"admin\",\"password\":\"$ADMIN_PW\"}" 2>/dev/null)
  
  if echo "$LOGIN" | grep -q '"token"'; then
    ok "Admin-inloggning fungerar (lösenord: $ADMIN_PW)"
  elif echo "$LOGIN" | grep -q 'Felaktiga'; then
    fail "Felaktigt lösenord - återställ med: ADMIN_PASSWORD=$ADMIN_PW node $BACKEND_DIR/src/db/reset-password.js"
  elif echo "$LOGIN" | grep -q 'ECONNREFUSED\|error'; then
    fail "Kan inte nå backend - starta: pm2 start src/server.js --name dykgaraget-api"
  else
    fail "Inloggning misslyckades: $LOGIN"
  fi
else
  warn "curl saknas - kan inte testa API"
fi

# ---------- Admin-användare ----------
echo "[ Databas ]"
if command -v psql &>/dev/null; then
  source "$BACKEND_DIR/.env" 2>/dev/null || true
  ADMIN_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "${DB_HOST:-localhost}" -U "${DB_USER:-dykgaraget_user}" -d "${DB_NAME:-dykgaraget}" -tAc "SELECT COUNT(*) FROM users WHERE username='admin'" 2>/dev/null)
  if [ "$ADMIN_COUNT" == "1" ]; then
    ok "Admin-användare finns i databasen"
  else
    fail "Admin-användare saknas! Kör: cd $BACKEND_DIR && npm run migrate"
  fi
fi

# ---------- Nginx ----------
echo "[ Nginx ]"
if command -v nginx &>/dev/null; then
  ok "Nginx installerat"
  if systemctl is-active --quiet nginx 2>/dev/null; then
    ok "Nginx körs"
    if nginx -t 2>/dev/null; then
      ok "Nginx-konfiguration giltig"
    else
      fail "Nginx-konfiguration har fel - kör: nginx -t"
    fi
  else
    fail "Nginx är inte igång - kör: systemctl start nginx"
  fi
else
  warn "Nginx saknas"
fi

# ---------- Sammanfattning ----------
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Allt ser bra ut!${NC}"
else
  echo -e "${RED}❌ $ERRORS fel hittades${NC}"
  echo ""
  echo "Vanliga lösningar:"
  echo "  • Inloggning fungerar inte: cd /var/www/dykgaraget/backend && npm run migrate"
  echo "  • JWT_SECRET saknas: openssl rand -base64 48  (klistra in i .env)"
  echo "  • Backend nere: pm2 restart dykgaraget-api && pm2 logs dykgaraget-api"
  echo "  • DB-fel: systemctl restart postgresql"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
