# 🎮 Local Testing Guide - No Hosting Required!

## Quick Start (Recommended)

```bash
npm run test-local
```

This will:
- ✅ Start your React app 
- ✅ Mock all Telegram WebApp features
- ✅ Open browser in mobile view
- ✅ Log all interactions to console

## Alternative Methods

### Method 1: Basic Local Testing
```bash
npm start
```
Then open: `http://localhost:3000`

### Method 2: Mobile Simulation
```bash
npm run test-mobile
```

### Method 3: Manual Browser Testing
1. Start app: `npm start`
2. Open Chrome DevTools (F12)
3. Click "Toggle device toolbar" (mobile icon)
4. Select iPhone/Android view
5. Test your app!

## 🎯 What You Can Test Locally

### ✅ Full Telegram Features (Mocked)
- User authentication simulation
- Haptic feedback (visual effects)
- Telegram alerts/confirms
- Back button (press ESC)
- Theme colors
- All WebApp API calls

### ✅ UI/UX Testing
- Mobile responsiveness
- Touch interactions
- Animations and transitions
- Dark theme appearance
- Button interactions

### ✅ Functionality Testing
- Betting interface
- Chat system
- Leaderboard updates
- Real-time counters
- Navigation between tabs

## 🔧 Testing Features

### Console Commands
Open browser DevTools (F12) → Console tab:

```javascript
// Test Telegram alerts
window.Telegram.WebApp.showAlert("Test message!")

// Test haptic feedback
window.Telegram.WebApp.HapticFeedback.impactOccurred("heavy")

// Check user data
console.log(window.Telegram.WebApp.initDataUnsafe.user)

// Test back button
window.Telegram.WebApp.BackButton.show()
```

### Keyboard Shortcuts
- **ESC**: Trigger back button
- **F12**: Open DevTools
- **Ctrl+Shift+M**: Toggle mobile view in Chrome

### Visual Indicators
- 🤖 **Red badge**: Shows "TELEGRAM MOCK MODE" 
- 📳 **Body scale**: Visual haptic feedback
- 💡 **Brightness**: Visual notifications

## 🚀 Testing Workflow

1. **Start testing**: `npm run test-local`
2. **Check console**: All Telegram calls are logged
3. **Test features**: Click buttons, navigate tabs
4. **Check mobile**: Browser opens in mobile view
5. **Debug**: Use DevTools for detailed inspection

## 📱 Mobile-Specific Testing

### Touch Events
- Tap buttons and check haptic feedback
- Swipe gestures (if implemented)
- Long press interactions

### Screen Sizes
Test these resolutions in DevTools:
- iPhone SE: 375×667
- iPhone 12: 390×844  
- Android: 360×640

### Performance
- Smooth animations
- Fast loading
- Responsive interactions

## 🆚 Local vs Real Telegram

| Feature | Local Testing | Real Telegram |
|---------|---------------|---------------|
| **Speed** | ⚡ Instant | 🔄 Setup required |
| **Debugging** | 🛠️ Full DevTools | 📱 Limited |
| **Haptics** | 👀 Visual only | 📳 Real vibration |
| **User Data** | 🤖 Mock data | 👤 Real user |
| **Deployment** | ❌ Not needed | ✅ Required |

## 🎯 When to Use Each Method

### Use Local Testing For:
- 🎨 UI/UX development
- 🐛 Bug fixing
- 🔧 Feature development
- 📱 Responsive design
- ⚡ Quick iterations

### Use Real Telegram For:
- 🚀 Final testing
- 👥 User acceptance testing
- 🔗 Share with others
- 📳 Real haptic feedback
- 🌐 Production preview

## 🔥 Pro Tips

1. **Keep Console Open**: All Telegram API calls are logged
2. **Use Mobile View**: Test in browser mobile mode
3. **Test Touch**: Click/tap instead of hover
4. **Check Performance**: Monitor frame rates
5. **Test Offline**: Disable network to test PWA features

## 🚨 Troubleshooting

### App Won't Start
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm start
```

### Mock Not Working
Check console for:
```
🔧 Initializing Telegram WebApp Mock for local testing
```

### Missing Features
The mock supports:
- ✅ User data
- ✅ Alerts/Confirms
- ✅ Haptic feedback
- ✅ Back button
- ✅ Theme colors
- ✅ All WebApp methods

---

**Happy Local Testing! 🎰**

*No ngrok, no hosting, no hassle!* 