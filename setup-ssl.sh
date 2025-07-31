#!/bin/bash

echo "🔒 Setting up SSL/HTTPS for SlotPot Backend"
echo "=========================================="

# Install Nginx and Certbot
echo "📦 Installing Nginx and Certbot..."
apt update
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx configuration for your domain
echo "⚙️ Configuring Nginx..."

# Replace 'yourdomain.com' with your actual domain
DOMAIN="yourdomain.com"  # UPDATE THIS WITH YOUR DOMAIN

cat > /etc/nginx/sites-available/slotpot << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass https://strongly-export-anthony-prince.trycloudflare.com;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass https://strongly-export-anthony-prince.trycloudflare.com;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/slotpot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Start Nginx
systemctl start nginx
systemctl enable nginx

# Get SSL certificate
echo "🔒 Getting SSL certificate..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email your-email@example.com

# Open HTTPS port
ufw allow 443

echo "✅ SSL setup complete!"
echo "🌐 Your API is now available at: https://$DOMAIN"
echo "🔒 SSL certificate will auto-renew" 