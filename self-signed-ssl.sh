#!/bin/bash

echo "🔒 Setting up Self-Signed SSL Certificate"
echo "========================================"

# Install OpenSSL
apt update
apt install -y openssl

# Create SSL directory
mkdir -p /etc/ssl/slotpot

# Generate private key
openssl genrsa -out /etc/ssl/slotpot/private.key 2048

# Generate certificate
openssl req -new -x509 -key /etc/ssl/slotpot/private.key -out /etc/ssl/slotpot/certificate.crt -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=82.29.173.197"

# Update your Node.js server to use HTTPS
echo "⚙️ You'll need to update your server.js to use HTTPS"
echo "Add this to the top of server.js:"
echo ""
echo "const https = require('https');"
echo "const fs = require('fs');"
echo ""
echo "const options = {"
echo "  key: fs.readFileSync('/etc/ssl/slotpot/private.key'),"
echo "  cert: fs.readFileSync('/etc/ssl/slotpot/certificate.crt')"
echo "};"
echo ""
echo "const server = https.createServer(options, app);"
echo ""
echo "⚠️ Note: Browsers will show security warnings with self-signed certificates" 