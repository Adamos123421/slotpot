# Telegram Mini App Testing Guide

## Prerequisites

1. **Install ngrok** (already done)
2. **Telegram account** with access to @BotFather
3. **Node.js and npm** (already installed)

## Step-by-Step Setup

### 1. Start Your React Development Server

```bash
npm start
```

This will start your app on `http://localhost:3000`

### 2. Create Secure Tunnel with ngrok

Open a new terminal and run:

```bash
ngrok http 3000
```

You'll see output like:
```
Session Status                online
Account                       YourAccount (Plan: Free)
Version                       3.0.0
Region                        United States (us)
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

**Copy the `https://abc123.ngrok.io` URL** - this is your public HTTPS URL.

### 3. Create Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Choose a name (e.g., "SlotPot Test Bot")
4. Choose a username (e.g., "slotpot_test_bot")
5. You'll receive your bot token: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

### 4. Create Mini App

1. Message @BotFather again
2. Send `/newapp`
3. Select your bot from the list
4. Enter app name: "SlotPot"
5. Enter description: "Premium Slot Machine Betting Platform"
6. Upload a photo (optional, 640x360px recommended)
7. Send demo GIF/video (optional)
8. **Enter your ngrok URL**: `https://abc123.ngrok.io`

### 5. Test Your Mini App

1. @BotFather will give you a link like `https://t.me/slotpot_test_bot/slotpot`
2. Open this link in Telegram
3. Your React app should load inside Telegram!

## Alternative Method: Direct Link Testing

You can also test directly by creating a test link:

```
https://t.me/YourBotUsername?start=webapp
```

## Features to Test

### ✅ Basic Functionality
- [ ] App loads in Telegram WebApp
- [ ] Dark theme matches Telegram
- [ ] Navigation works (jackpot, chat, stats tabs)
- [ ] Haptic feedback on button presses
- [ ] Betting interface functions

### ✅ Telegram Integration
- [ ] User info displays (if logged in)
- [ ] Telegram alerts show on bet placement
- [ ] Back button behavior
- [ ] Theme colors match Telegram

### ✅ Mobile Optimization
- [ ] Responsive design works
- [ ] Touch interactions feel natural
- [ ] Performance is smooth

## Troubleshooting

### Common Issues

1. **"This site can't be reached"**
   - Make sure ngrok is running
   - Check your ngrok URL is correct
   - Ensure React dev server is running on port 3000

2. **App doesn't look right**
   - Telegram WebApp script should load
   - Check browser console for errors
   - Verify HTTPS (ngrok provides this automatically)

3. **No haptic feedback**
   - Only works on mobile devices
   - Test on actual Telegram mobile app, not desktop

### Development Commands

```bash
# Start React app
npm start

# Start ngrok tunnel (in separate terminal)
ngrok http 3000

# Check if Telegram WebApp is available
# Open browser console and type:
console.log(window.Telegram?.WebApp)
```

## Production Deployment

When ready for production:

1. Build your app: `npm run build`
2. Deploy to hosting service (Vercel, Netlify, etc.)
3. Update mini app URL in @BotFather to your production URL
4. Submit for review if needed

## Development vs Production

| Environment | URL | Testing Method |
|-------------|-----|----------------|
| Development | `ngrok` tunnel | @BotFather test app |
| Production | Deployed site | Official mini app |

## Next Steps

1. Test all functionality in Telegram mobile app
2. Add user wallet connection
3. Implement TON blockchain integration
4. Add real betting mechanics
5. Deploy to production hosting

## Notes

- ngrok free tier sessions expire after 2 hours
- Keep your bot token secure
- Test on multiple devices/screen sizes
- Consider using ngrok authtoken for longer sessions

---

**Happy Testing! 🎰** 