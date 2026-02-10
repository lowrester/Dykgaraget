#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

NGINX_HTML="/var/www/html/dykgaraget"

if [ -d "$NGINX_HTML" ]; then
  warn "Removing frontend from nginx..."
  rm -rf $NGINX_HTML/*
  
  # Create maintenance page
  cat > $NGINX_HTML/index.html << 'EOFHTML'
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Underhåll - Dykgaraget</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #0066CC 0%, #00A8E8 100%);
      color: white;
      text-align: center;
    }
    h1 { font-size: 3rem; margin: 0; }
    p { font-size: 1.25rem; opacity: 0.9; }
  </style>
</head>
<body>
  <div>
    <h1>🔧 Underhåll</h1>
    <p>Dykgaraget genomgår underhåll och är tillbaka snart.</p>
  </div>
</body>
</html>
EOFHTML
  
  info "Maintenance page deployed ✓"
else
  warn "Frontend directory not found"
fi
