# 🚀 SlotPot Backend Deployment Guide

## 🏗️ Architecture Overview

The SlotPot backend provides:
- **Automated Jackpot Management**: 24/7 round automation using admin mnemonic
- **API Endpoints**: Contract state, user data, admin status
- **Smart Contract Integration**: Direct TON blockchain interaction
- **Security**: Admin mnemonic kept secure on server-side

## 📋 Prerequisites

- **Node.js 18+**
- **TON API Key** (from TON Center)
- **Admin Wallet Mnemonic** (24 words)
- **Deployed Smart Contract** address

## 🔧 Environment Setup

### 1. Copy Environment Template
```bash
cp backend/env.example backend/.env
```

### 2. Configure Environment Variables
```bash
# Backend Server Configuration
PORT=5000
NODE_ENV=production

# TON Network Configuration
TON_ENDPOINT=https://testnet.toncenter.com/api/v2/jsonRPC
TON_API_KEY=your_ton_api_key_here

# Smart Contract Configuration
CONTRACT_ADDRESS=EQBYLTm4nsvoqJRvs_L-IGNKwWs5RKe19HBK_lFadf19FUfb

# Admin Wallet Configuration (KEEP SECURE!)
ADMIN_MNEMONIC=word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24

# Automation Settings
ROUND_DURATION=300          # 5 minutes
MIN_BETS_TO_END=2          # Minimum bets required
CHECK_INTERVAL=30          # Check every 30 seconds

# Security
ADMIN_API_KEY=your_secure_admin_api_key_for_emergency_controls
```

### 3. Frontend Configuration
Create `src/.env` in your frontend:
```bash
REACT_APP_BACKEND_URL=http://localhost:5000
```

## 🚀 Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Backend Server
```bash
npm run server
```

### 3. Start Frontend (in another terminal)
```bash
npm start
```

### 4. Run Both Together
```bash
npm run dev
```

## 🌐 Production Deployment

### Option 1: Traditional VPS (Recommended)

#### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install nginx -y
```

#### 2. Deploy Application
```bash
# Clone repository
git clone https://github.com/your-repo/slotpot.git
cd slotpot

# Install dependencies
npm install

# Build frontend
npm run build

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'slotpot-backend',
    script: 'backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 3. Configure Nginx
```bash
# Create Nginx config
sudo cat > /etc/nginx/sites-available/slotpot << EOF
server {
    listen 80;
    server_name your-domain.com;

    # Serve React build files
    location / {
        root /path/to/slotpot/build;
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/slotpot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Option 2: Docker Deployment

#### 1. Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .

# Build frontend
RUN npm run build

EXPOSE 5000

CMD ["npm", "run", "start:prod"]
```

#### 2. Create docker-compose.yml
```yaml
version: '3.8'

services:
  slotpot:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    env_file:
      - backend/.env
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
```

#### 3. Deploy
```bash
docker-compose up -d
```

### Option 3: Cloud Platforms

#### Heroku
```bash
# Create Heroku app
heroku create slotpot-app

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set TON_ENDPOINT=https://testnet.toncenter.com/api/v2/jsonRPC
heroku config:set CONTRACT_ADDRESS=your_contract_address
heroku config:set ADMIN_MNEMONIC="word1 word2 ... word24"
# ... (set all other env vars)

# Deploy
git push heroku main
```

#### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway deploy
```

## 🔐 Security Considerations

### 1. Environment Variables
- **NEVER** commit `.env` files to version control
- Use secure, random `ADMIN_API_KEY`
- Keep `ADMIN_MNEMONIC` absolutely secret

### 2. Server Security
```bash
# Setup firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. Monitoring
```bash
# Install monitoring
npm install -g pm2-logrotate
pm2 install pm2-logrotate

# Check logs
pm2 logs slotpot-backend
pm2 monit
```

## 📊 API Endpoints

### Public Endpoints
- `GET /api/health` - Health check
- `GET /api/contract/state` - Contract state
- `GET /api/contract/bettor/:address` - User bet data
- `GET /api/admin/status` - Automation status

### Admin Endpoints (require `ADMIN_API_KEY`)
- `POST /api/admin/force-start` - Force start round
- `POST /api/admin/force-end` - Force end round
- `POST /api/admin/settings` - Update automation settings

## 🔄 Automation Features

### Round Management
- ✅ **Auto-start**: New rounds when no active round
- ✅ **Auto-end**: After duration or conditions met
- ✅ **Timer-based**: Configurable round duration
- ✅ **Condition-based**: Minimum bets + jackpot size
- ✅ **Error handling**: Retry logic and error tracking

### Configuration
- `ROUND_DURATION`: Round length in seconds (default: 300)
- `MIN_BETS_TO_END`: Minimum bets to end early (default: 2)
- `CHECK_INTERVAL`: How often to check contract (default: 30s)

## 🚨 Troubleshooting

### Common Issues

#### Backend won't start
```bash
# Check logs
pm2 logs slotpot-backend

# Common causes:
# - Invalid ADMIN_MNEMONIC
# - Wrong CONTRACT_ADDRESS
# - Network connectivity issues
```

#### Automation not working
```bash
# Check admin status
curl http://localhost:5000/api/admin/status

# Verify contract address
curl http://localhost:5000/api/contract/state
```

#### Frontend can't connect
```bash
# Check CORS settings
# Verify REACT_APP_BACKEND_URL
# Check if backend is running on correct port
```

### Health Check
```bash
# Check backend health
curl http://localhost:5000/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "automation": {
    "isAutoManaged": true,
    "isRunning": true,
    ...
  }
}
```

## 📈 Scaling Considerations

### Performance
- Backend handles ~100 concurrent users easily
- Database recommended for >1000 users
- Consider Redis for caching contract state

### High Availability
- Use load balancer for multiple backend instances
- Database replication
- Automated backups of environment configuration

## 🛠️ Maintenance

### Regular Tasks
- Monitor logs: `pm2 logs`
- Check automation stats: `curl /api/admin/status`
- Update dependencies: `npm audit fix`
- Backup environment configuration

### Updates
```bash
# Pull latest code
git pull origin main

# Install new dependencies
npm install

# Rebuild frontend
npm run build

# Restart backend
pm2 restart slotpot-backend
```

## 📞 Support

For deployment issues:
1. Check logs: `pm2 logs slotpot-backend`
2. Verify environment variables
3. Test contract connectivity
4. Check automation status via API

The backend is now properly secured and can run 24/7 with automated jackpot management!

## 🎯 Recommended Option: Railway (Easiest)

Railway is perfect for your Node.js backend with Socket.io and continuous processes.

### Step 1: Prepare Your Backend

First, let's create the necessary deployment files:

#### 1.1 Create `backend/package.json` (if not exists)
```json
{
  "name": "slotpot-backend",
  "version": "1.0.0",
  "description": "SlotPot betting game backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "uuid": "^9.0.0",
    "axios": "^1.5.0",
    "node-cron": "^3.0.2"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

#### 1.2 Create `backend/.env.example`
```env
NODE_ENV=production
PORT=5002
ADMIN_API_KEY=your_secure_admin_key_here
CONTRACT_ADDRESS=your_ton_contract_address
TON_ENDPOINT=https://toncenter.com/api/v2/jsonRPC
TON_API_TOKEN=your_ton_api_token
```

### Step 2: Deploy to Railway

#### Option A: Using Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Navigate to backend directory
cd backend

# Initialize Railway project
railway init

# Deploy
railway up
```

#### Option B: Using Railway Website (Recommended)
1. Go to https://railway.app/
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Choose "backend" as the root directory
6. Railway will auto-detect Node.js and deploy

### Step 3: Configure Environment Variables in Railway
After deployment, set these environment variables in Railway dashboard:
- `NODE_ENV` = `production`
- `PORT` = `5002` (Railway will override this)
- `ADMIN_API_KEY` = `your_secure_key`
- `CONTRACT_ADDRESS` = `your_contract_address`
- `TON_ENDPOINT` = `https://toncenter.com/api/v2/jsonRPC`
- `TON_API_TOKEN` = `your_actual_token`

### Step 4: Update Frontend Environment Variables
Update your Vercel environment variables to use the Railway URL:
- `REACT_APP_BACKEND_URL` = `https://your-app.railway.app`
- `REACT_APP_SOCKET_URL` = `https://your-app.railway.app`

---

## 🔄 Alternative Option: Render

### Step 1: Deploy to Render
1. Go to https://render.com/
2. Connect your GitHub account
3. Click "New" → "Web Service"
4. Select your repository
5. Configure:
   - **Name**: `slotpot-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (for testing) or Starter ($7/month)

### Step 2: Environment Variables in Render
Set the same environment variables as Railway.

---

## 🚀 Alternative Option: Vercel Functions (Advanced)

If you want everything on Vercel, we need to restructure for serverless:

### Create `api/` directory structure:
```
api/
├── admin/
│   ├── status.js
│   └── settings.js
├── user/
│   └── register.js
└── socket.js
```

This requires significant restructuring since Socket.io doesn't work well with serverless.

---

## 🔧 Railway Setup (Detailed Steps)

Let me help you set up Railway step by step:

### 1. Create Railway Account
- Go to https://railway.app/
- Sign up with GitHub
- Connect your repository

### 2. Project Configuration
```yaml
# railway.toml (optional, for advanced config)
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"

[variables]
NODE_ENV = "production"
```

### 3. Health Check Endpoint
Add this to your `backend/server.js`:
```javascript
// Health check for Railway
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV 
  });
});
```

### 4. Port Configuration
Update your server.js port binding:
```javascript
const PORT = process.env.PORT || 5002;

// Bind to 0.0.0.0 for Railway
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});
```

---

## 🔒 Security Considerations

### 1. Environment Variables
Never commit sensitive data. Use:
```bash
# .env (never commit this)
ADMIN_API_KEY=super_secure_key_123
TON_API_TOKEN=your_actual_token
```

### 2. CORS Configuration
Update CORS for your deployed domain:
```javascript
const corsOptions = {
  origin: [
    "https://your-frontend.vercel.app",
    "https://web.telegram.org",
    "https://telegram.org",
    /^https:\/\/.*\.telegram\.org$/,
    process.env.NODE_ENV === 'development' ? "http://localhost:3000" : null
  ].filter(Boolean),
  methods: ["GET", "POST"],
  credentials: true
};
```

### 3. Rate Limiting
Your existing rate limiting is good for production.

---

## 📊 Monitoring & Logs

### Railway Monitoring
- Check logs in Railway dashboard
- Set up alerts for errors
- Monitor resource usage

### Health Checks
```javascript
// Enhanced health check
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    services: {
      adminAutomation: adminAutomation.getStatus().isRunning,
      contractPolling: getPollingStatus().isPolling,
      socketConnections: socketService.getConnectionCount()
    }
  };
  res.json(health);
});
```

---

## 🚨 Troubleshooting

### Common Issues:

**1. Port Binding Issues**
- Ensure you bind to `0.0.0.0`, not `localhost`
- Use `process.env.PORT` for Railway

**2. Socket.io Connection Issues**
- Enable sticky sessions if needed
- Check WebSocket support

**3. Environment Variables**
- Verify all required variables are set
- Check variable names match exactly

**4. Build Failures**
- Ensure all dependencies in package.json
- Check Node.js version compatibility

---

## 🎯 Quick Start Commands

```bash
# 1. Navigate to backend
cd backend

# 2. Install Railway CLI
npm install -g @railway/cli

# 3. Login and deploy
railway login
railway init
railway up

# 4. Set environment variables
railway variables set NODE_ENV=production
railway variables set ADMIN_API_KEY=your_key_here

# 5. Check deployment
railway logs
```

Your backend will be live at `https://your-project.railway.app`! 🚀 