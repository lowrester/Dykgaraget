#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting local verification...${NC}"

# 1. Backend Checks
echo -e "\n${BLUE}📦 Checking Backend...${NC}"
cd backend
npm install --no-audit --loglevel error
echo -e "Testing backend..."
npm test
cd ..

# 2. Frontend Checks
echo -e "\n${BLUE}📦 Checking Frontend...${NC}"
cd frontend
npm install --no-audit --loglevel error
echo -e "Linting frontend..."
npm run lint
echo -e "Testing frontend..."
npm test
echo -e "Building frontend..."
npm run build
cd ..

echo -e "\n${GREEN}✅ Verification passed! Safe to push.${NC}"
