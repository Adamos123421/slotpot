#!/bin/bash

echo "🚀 SlotPot Backend Quick Setup for Hostinger VPS"
echo "================================================"

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y
apt install -y curl wget unzip

# Install Node.js
echo "📥 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify installation
echo "✅ Node.js version: $(node --version)"
echo "✅ NPM version: $(npm --version)"

# Install PM2
echo "📥 Installing PM2..."
npm install -g pm2

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /var/www/slotpot-backend
cd /var/www/slotpot-backend

# Extract files
echo "📦 Extracting application files..."
if [ -f /root/slotpot-backend.zip ]; then
    unzip /root/slotpot-backend.zip
    if [ -d backend ]; then
        mv backend/* .
        rmdir backend
    fi
else
    echo "❌ slotpot-backend.zip not found in /root/"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create environment file
echo "⚙️ Creating environment file..."
if [ -f env.example ]; then
    cp env.example .env
    echo "✅ Environment file created from example"
    echo "⚠️  IMPORTANT: Edit .env file with your actual values!"
    echo "   Run: nano .env"
else
    echo "❌ env.example not found"
fi

# Create logs directory
mkdir -p logs

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 5002
ufw --force enable

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit environment file: nano .env"
echo "2. Test the app: node server.js"
echo "3. Start with PM2: pm2 start ecosystem.config.js --env production"
echo "4. Save PM2 config: pm2 save && pm2 startup"
echo ""
echo "🌐 Your API will be available at: http://82.29.173.197:5002" 