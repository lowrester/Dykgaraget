#!/bin/bash
echo "════════════════════════════════════════════════════════"
echo "🔍 Dykgaraget Diagnostic Tool"
echo "════════════════════════════════════════════════════════"

echo -e "\n1. Checking PM2 status..."
pm2 status dykgaraget-api

echo -e "\n2. Checking Backend Health Check (Local)..."
curl -s -I http://localhost:3000/api/health | head -n 1

echo -e "\n3. Checking Nginx Health Check (Public Path)..."
curl -s -I http://localhost/api/health | head -n 1

echo -e "\n4. Tail of Backend Logs (PM2):"
pm2 logs dykgaraget-api --lines 20 --no-daemon &
LOG_PID=$!
sleep 3
kill $LOG_PID

echo -e "\n5. Tail of Nginx Error Logs:"
sudo tail -n 20 /var/log/nginx/error.log

echo -e "\n════════════════════════════════════════════════════════"
echo "Done."
