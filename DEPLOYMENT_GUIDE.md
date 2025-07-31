# SlotPot Deployment Guide

## 🌐 Your API is Now Publicly Accessible!

Your backend API is configured to accept connections from the internet on port 5002.

### Step 1: Get Your Public IP
Visit any of these websites to find your public IP:
- https://whatismyip.com/
- https://whatismyip.org/
- Or Google "what is my IP"

### Step 2: Your API Endpoints Are Now Available At:
```
http://YOUR_PUBLIC_IP:5002/api/health
http://YOUR_PUBLIC_IP:5002/api/admin/status
http://YOUR_PUBLIC_IP:5002/api/contract/state
```

## 🚀 Frontend Hosting Options

### Option 1: Netlify (Recommended)

1. **Build your frontend:**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify:**
   - Go to https://netlify.com/
   - Create account and click "Add new site"
   - Drag and drop your `build` folder
   - Or connect your GitHub repo

3. **Configure environment variables:**
   - In Netlify dashboard: Site settings > Environment variables
   - Add these variables:
     ```
     REACT_APP_BACKEND_URL=http://YOUR_PUBLIC_IP:5002
     REACT_APP_SOCKET_URL=http://YOUR_PUBLIC_IP:5002
     REACT_APP_API_URL=http://YOUR_PUBLIC_IP:5002
     ```

4. **Redeploy** after adding environment variables

### Option 2: Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Add environment variables:**
   ```bash
   vercel env add REACT_APP_BACKEND_URL
   # Enter: http://YOUR_PUBLIC_IP:5002
   
   vercel env add REACT_APP_SOCKET_URL  
   # Enter: http://YOUR_PUBLIC_IP:5002
   ```

4. **Redeploy:**
   ```bash
   vercel --prod
   ```

### Option 3: GitHub Pages

1. **Install gh-pages:**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Add to your package.json:**
   ```json
   {
     "homepage": "https://yourusername.github.io/slotpot",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d build"
     }
   }
   ```

3. **Create .env.production file:**
   ```bash
   echo REACT_APP_BACKEND_URL=http://YOUR_PUBLIC_IP:5002 > .env.production
   echo REACT_APP_SOCKET_URL=http://YOUR_PUBLIC_IP:5002 >> .env.production
   ```

4. **Deploy:**
   ```bash
   npm run deploy
   ```

## 🔧 Configuration Files

### Create .env.production
Create this file with your public IP:
```env
REACT_APP_BACKEND_URL=http://YOUR_PUBLIC_IP:5002
REACT_APP_SOCKET_URL=http://YOUR_PUBLIC_IP:5002
REACT_APP_API_URL=http://YOUR_PUBLIC_IP:5002
REACT_APP_CONTRACT_ADDRESS=your_contract_address
REACT_APP_TON_ENDPOINT=https://toncenter.com/api/v2/jsonRPC
```

### For Local Development
Create .env.local:
```env
REACT_APP_BACKEND_URL=https://strongly-export-anthony-prince.trycloudflare.com
REACT_APP_SOCKET_URL=https://strongly-export-anthony-prince.trycloudflare.com
REACT_APP_API_URL=https://strongly-export-anthony-prince.trycloudflare.com
```

## 🧪 Testing Your Setup

### 1. Test Backend API
Replace `YOUR_PUBLIC_IP` with your actual IP:
```bash
curl http://YOUR_PUBLIC_IP:5002/api/health
```

### 2. Test from Another Device
- Connect to mobile hotspot (different network)
- Visit: http://YOUR_PUBLIC_IP:5002/api/health
- Should return JSON response

### 3. Test WebSocket Connection
Open browser console on your hosted frontend and check for:
```
🔌 Socket connected to: http://YOUR_PUBLIC_IP:5002
```

## 🛡️ Security Considerations

### 1. HTTPS (Recommended for Production)
- Use Cloudflare or nginx proxy for SSL
- Get free SSL certificate from Let's Encrypt

### 2. Rate Limiting (Already Configured)
Your backend has built-in rate limiting:
- 50 requests per minute per IP
- Automatic blocking of suspicious traffic

### 3. Firewall Rules
Current firewall allows all traffic on port 5002. To restrict:
```bash
# Allow only specific countries (optional)
netsh advfirewall firewall set rule name="SlotPot API Port 5002" new remoteip=SPECIFIC_IP_RANGES
```

## 🚨 Troubleshooting

### API Not Accessible
1. **Check Windows Firewall:**
   ```bash
   netsh advfirewall firewall show rule name="SlotPot API Port 5002"
   ```

2. **Check Router Port Forwarding:**
   - Login to router (usually 192.168.1.1)
   - Forward port 5002 to your PC's local IP

3. **Check Backend Status:**
   ```bash
   curl https://strongly-export-anthony-prince.trycloudflare.com/api/health
   ```

### Frontend Can't Connect
1. **Check Console Errors:**
   - Open browser DevTools
   - Look for CORS or connection errors

2. **Verify Environment Variables:**
   - Check if REACT_APP_BACKEND_URL is set correctly
   - Rebuild after changing environment variables

3. **Test API Directly:**
   ```bash
   curl http://YOUR_PUBLIC_IP:5002/api/admin/status
   ```

## 📱 Running Your Backend 24/7

### Option 1: Keep PC Running
- Disable sleep mode
- Use UPS for power backup
- Monitor with Task Manager

### Option 2: VPS Hosting (Recommended)
- DigitalOcean, Linode, or AWS
- Copy backend folder to VPS
- Use PM2 for process management

### Option 3: Windows Service
Convert your Node.js app to Windows service:
```bash
npm install -g node-windows
```

## 🎉 Final Steps

1. **Get your public IP** from whatismyip.com
2. **Replace YOUR_PUBLIC_IP** in all configuration files
3. **Choose a hosting platform** (Netlify recommended)
4. **Deploy your frontend** with correct environment variables
5. **Test everything** works from different devices/networks

Your SlotPot application is now globally accessible! 🌍 