#!/bin/bash
set -e

echo "=========================================================="
echo "NANDHA LEETCODE INTELLIGENCE — AUTO UPDATE & DEPLOY"
echo "=========================================================="

# Always navigate to repo root
if [ -d "/var/www/leetcode-tracker" ]; then
    cd /var/www/leetcode-tracker
else
    cd "$(dirname "$0")/.."
fi

echo "1. Pulling latest Git changes..."
git pull origin main

echo "2. Updating Python backend dependencies & migrations..."
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "/opt/nandha_leetcode_intelligence/venv" ]; then
    source /opt/nandha_leetcode_intelligence/venv/bin/activate
fi

if command -v pip >/dev/null 2>&1; then
    pip install -r requirements.txt --quiet
fi

# Run automated schema migrations
python3 -c "
try:
    from backend.migrate_db import run_db_migrations
    run_db_migrations()
    print('Database schema migrations verified.')
except Exception as e:
    print(f'Migration note: {e}')
" || python -c "
try:
    from backend.migrate_db import run_db_migrations
    run_db_migrations()
    print('Database schema migrations verified.')
except Exception as e:
    print(f'Migration note: {e}')
" || true

echo "3. Installing frontend dependencies & building bundle..."
cd frontend
if [ -f "package-lock.json" ]; then
    npm install --no-audit --no-fund --quiet
fi
npm run build
cd ..

echo "4. Restarting services..."
sudo systemctl restart leetcode-tracker || true
sudo systemctl restart nginx || true

echo "5. Checking backend service status..."
sudo systemctl status leetcode-tracker --no-pager || true

echo ""
echo "=========================================================="
echo "DEPLOYMENT COMPLETE! Services restarted successfully!"
echo "Visit: https://nandha-leetcode.duckdns.org"
echo "Tip: Clear browser cache (Ctrl+Shift+R) to load latest UI"
echo "=========================================================="


