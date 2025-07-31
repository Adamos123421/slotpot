#!/bin/bash

echo "☁️ Setting up Cloudflare Tunnel for HTTPS"
echo "========================================"

# Download and install cloudflared
echo "📥 Installing Cloudflare Tunnel..."
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared-linux-amd64.deb

# Create tunnel configuration
echo "⚙️ Creating tunnel configuration..."
mkdir -p ~/.cloudflared

cat > ~/.cloudflared/config.yml << EOF
tunnel: slotpot-backend
credentials-file: ~/.cloudflared/cert.pem

ingress:
  - hostname: "*.trycloudflare.com"
    service: https://strongly-export-anthony-prince.trycloudflare.com
  - service: http_status:404
EOF

echo "🚀 Starting tunnel..."
echo "This will give you a free HTTPS URL like: https://random-name.trycloudflare.com"
echo ""
echo "Run this command on your VPS:"
echo "cloudflared tunnel --url https://strongly-export-anthony-prince.trycloudflare.com"
echo ""
echo "The tunnel will show you the HTTPS URL to use in your frontend!" 