#!/bin/bash

# SlotPot Backend Deployment Script for Hostinger VPS
echo "🚀 Starting SlotPot Backend Deployment..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo "📥 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📥 Installing PM2..."
    sudo npm install -g pm2
fi

# Create logs directory
mkdir -p logs

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Copy environment file
if [ ! -f .env ]; then
    echo "⚠️  Creating .env file from example..."
    cp env.example .env
    echo "🔧 Please edit .env file with your actual values!"
fi

# Stop existing PM2 process if running
echo "⏹️  Stopping existing processes..."
pm2 stop slotpot-backend 2>/dev/null || true
pm2 delete slotpot-backend 2>/dev/null || true

# Start the application with PM2
echo "🚀 Starting SlotPot Backend..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

echo "✅ Deployment complete!"
echo "📊 Check status with: pm2 status"
echo "📝 View logs with: pm2 logs slotpot-backend"
echo "🔄 Restart with: pm2 restart slotpot-backend" 