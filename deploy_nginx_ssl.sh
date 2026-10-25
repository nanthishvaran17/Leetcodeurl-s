#!/bin/bash
set -e

echo "=== Nandha LeetCode Tracker - Nginx & SSL Auto-Deployer ==="

# 1. Clean up conflicting conf.d files
sudo rm -f /etc/nginx/conf.d/*.conf

# 2. Write clean Nginx site configuration
sudo tee /etc/nginx/sites-available/default > /dev/null << 'EOF'
# 1. HTTP -> HTTPS Auto-Redirect (Port 80)
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name nandha-leetcode.duckdns.org 13.53.231.6 _;

    # Allow Let's Encrypt renewal challenges
    location /.well-known/acme-challenge/ {
        root /var/www/leetcode-tracker/frontend/dist;
    }

    location / {
        return 301 https://nandha-leetcode.duckdns.org$request_uri;
    }
}

# 2. Secure HTTPS Server (Port 443 with HTTP/2)
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name nandha-leetcode.duckdns.org;

    root /var/www/leetcode-tracker/frontend/dist;
    index index.html;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/nandha-leetcode.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nandha-leetcode.duckdns.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security Headers (Best Practices 100/100)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;

    # Gzip Compression (Reduces CSS from 469KB to 60KB)
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/x-javascript application/xml image/svg+xml;

    # Static Assets Long-Term 1-Year Immutable Cache (0ms Reloads)
    location ~* \.(?:css|js|webp|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
        try_files $uri =404;
    }

    # ARD 1.0 Manifests for 4/4 Agentic Browsing
    location = /ai-catalog.json {
        default_type application/ai-catalog+json;
        add_header Cache-Control "public, max-age=3600";
        try_files /ai-catalog.json =404;
    }

    location ^~ /.well-known/ {
        default_type application/ai-catalog+json;
        add_header Cache-Control "public, max-age=3600";
        try_files $uri =404;
    }

    # Backend API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # WebSocket Support
    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # SPA Client Routing
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF

# 3. Ensure symlink exists
sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# 4. Test configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# 5. Restart Nginx and app
echo "Restarting services..."
sudo systemctl restart nginx
sudo systemctl restart leetcode-tracker

echo ""
echo "=========================================================="
echo " SUCCESS! Website is now fully live on HTTPS & HTTP/2!"
echo " Visit: https://nandha-leetcode.duckdns.org"
echo "=========================================================="
