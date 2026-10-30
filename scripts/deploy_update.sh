#!/bin/bash
set -e

echo "=========================================================="
echo "🚀 NANDHA LEETCODE INTELLIGENCE — AUTO UPDATE & DEPLOY"
echo "=========================================================="

# Always navigate to repo root
if [ -d "/var/www/leetcode-tracker" ]; then
    cd /var/www/leetcode-tracker
else
    cd "$(dirname "$0")/.."
fi

echo "📥 1. Pulling latest Git changes..."
git pull origin main

echo "🎨 2. Building frontend production bundle..."
cd frontend
npm run build
cd ..

echo "⚙️ 3. Restarting services..."
sudo systemctl restart leetcode-tracker
sudo systemctl restart nginx

echo "🔍 4. Checking status..."
sudo systemctl status leetcode-tracker --no-pager

echo ""
echo "=========================================================="
echo "🎉 DEPLOYMENT SUCCESSFUL! All services are active & live!"
echo "🌐 Visit: https://nandha-leetcode.duckdns.org"
echo "=========================================================="

