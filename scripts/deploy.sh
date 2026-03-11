#!/usr/bin/env bash
# CarMatch deploy script
# Run on the VPS after pushing new code: npm run deploy
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
RESET='\033[0m'

step() { echo -e "\n${BOLD}→ $1${RESET}"; }
done_() { echo -e "\n${GREEN}✓ $1${RESET}"; }

step "Pulling latest code…"
git pull origin main

step "Installing dependencies…"
npm ci

step "Running database migrations…"
npm run db:migrate

step "Building Next.js…"
npm run build

step "Reloading pm2 apps…"
# reload = zero-downtime for web; restart for worker
if pm2 describe web > /dev/null 2>&1; then
  pm2 reload pm2.config.js --update-env
else
  # First deploy: start all apps
  pm2 start pm2.config.js
  pm2 save
fi

done_ "Deploy complete"
echo ""
pm2 status
