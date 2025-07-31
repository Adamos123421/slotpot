# 🤖 Telegram MiniApp Deployment on Vercel

## 📋 Prerequisites

1. **Public IP for your backend**: Your backend at `196.119.216.98:5002`
2. **GitHub account** (for Vercel deployment)
3. **Telegram Bot** (for the miniapp)

## 🚀 Step 1: Prepare Your Project

### 1.1 Environment Variables
Create `.env.production` with your backend URL:
```env
REACT_APP_BACKEND_URL=http://196.119.216.98:5002
REACT_APP_SOCKET_URL=http://196.119.216.98:5002
REACT_APP_API_URL=http://196.119.216.98:5002
REACT_APP_CONTRACT_ADDRESS=your_contract_address
REACT_APP_TON_ENDPOINT=https://toncenter.com/api/v2/jsonRPC
```

### 1.2 Build the Project
```bash
npm run build
```

## 🌐 Step 2: Deploy to Vercel

### Option A: Using Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod

# Set environment variables
vercel env add REACT_APP_BACKEND_URL
# Enter: http://196.119.216.98:5002

vercel env add REACT_APP_SOCKET_URL
# Enter: http://196.119.216.98:5002

# Redeploy with environment variables
vercel --prod
```

### Option B: Using Vercel Website (Easier)
1. Go to https://vercel.com/
2. Connect your GitHub account
3. Import your repository
4. Set environment variables in Vercel dashboard:
   - `REACT_APP_BACKEND_URL` = `http://196.119.216.98:5002`
   - `REACT_APP_SOCKET_URL` = `http://196.119.216.98:5002`
5. Deploy

## 🤖 Step 3: Configure Telegram Bot

### 3.1 Create/Update Your Bot
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Use `/newbot` or `/mybots` to create/edit your bot
3. Set the Web App URL to your Vercel URL:
   ```
   /setmenubutton
   Select your bot
   Edit Menu Button
   URL: https://your-app.vercel.app
   Text: 🎰 Play SlotPot
   ```

### 3.2 Set Bot Commands
```
/setcommands
/start - Start playing SlotPot
/help - Get help and instructions
/stats - View your statistics
```

### 3.3 Configure Web App
```
/newapp
Select your bot
App Name: SlotPot
URL: https://your-app.vercel.app
Description: Decentralized TON betting game
Photo: Upload your game icon
```

## 🔧 Step 4: Update Backend CORS for Telegram

Update your backend to allow Telegram domains. Add this to your backend's CORS configuration:

```javascript
// In backend/server.js
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://your-app.vercel.app", // Your Vercel domain
    "https://web.telegram.org",
    "https://telegram.org",
    /^https:\/\/.*\.telegram\.org$/,
    true // Allow all origins for now
  ],
  methods: ["GET", "POST"],
  credentials: true
};
```

## 📱 Step 5: Test Your MiniApp

### 5.1 Direct Testing
1. Open your Vercel URL in browser
2. Should work normally with mock Telegram data

### 5.2 Telegram Testing
1. Open your bot in Telegram
2. Tap the menu button or use `/start`
3. The miniapp should open in Telegram

### 5.3 Debug Issues
Check browser console for:
- CORS errors
- API connection issues
- Telegram WebApp initialization

## 🛠️ Step 6: Optimize for Telegram

### 6.1 Telegram Theme Integration
Your app already uses:
```javascript
// In useTelegramWebApp.js
app.setHeaderColor('#1a1b2e');
app.setBackgroundColor('#1a1b2e');
```

### 6.2 Haptic Feedback
Your app already includes:
```javascript
// Haptic feedback on bet placement
hapticFeedback('medium');
```

### 6.3 Closing Confirmation
```javascript
app.enableClosingConfirmation();
```

## 🔒 Step 7: Security Considerations

### 7.1 Validate Telegram Data
Your backend should validate Telegram WebApp init data:
```javascript
// Validate Telegram user data
const validateTelegramWebAppData = (initData) => {
  // Implement Telegram WebApp data validation
  // Check hash, auth_date, etc.
};
```

### 7.2 Rate Limiting
Your backend already has rate limiting - ensure it handles Telegram traffic.

## 📊 Step 8: Monitor and Analytics

### 8.1 Vercel Analytics
- Enable Vercel Analytics in your dashboard
- Monitor page views and performance

### 8.2 Backend Monitoring
- Monitor API calls from Telegram users
- Track game statistics

## 🚨 Troubleshooting

### Common Issues:

**1. MiniApp doesn't open in Telegram**
- Check if URL is HTTPS (Vercel provides this)
- Verify CORS settings allow Telegram domains
- Check CSP headers in vercel.json

**2. API calls fail**
- Ensure backend allows Telegram origins
- Check if your backend is accessible from internet
- Verify environment variables are set correctly

**3. Telegram features don't work**
- Check if Telegram WebApp SDK is loaded
- Verify app.ready() is called
- Check browser console for Telegram errors

## 🎯 Final Checklist

- [ ] Backend running on public IP (196.119.216.98:5002)
- [ ] Frontend deployed to Vercel with HTTPS
- [ ] Environment variables set in Vercel
- [ ] Telegram bot configured with Web App URL
- [ ] CORS updated to allow Telegram domains
- [ ] Headers configured for iframe embedding
- [ ] Tested in both browser and Telegram

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Monitor backend logs for CORS/API errors
3. Test API endpoints directly: `http://196.119.216.98:5002/api/health`
4. Verify bot configuration in @BotFather

Your SlotPot Telegram MiniApp is now ready! 🎰🚀 