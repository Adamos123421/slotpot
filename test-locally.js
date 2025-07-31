#!/usr/bin/env node

const { exec, spawn } = require('child_process');

console.log('🚀 Starting SlotPot Local Testing...\n');

// Start React app
console.log('📦 Starting React development server...');
const reactProcess = spawn('npm', ['start'], { 
  stdio: 'pipe',
  shell: true 
});

let serverStarted = false;

reactProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  
  if (output.includes('webpack compiled') || output.includes('Local:') || output.includes('localhost:3000')) {
    if (!serverStarted) {
      serverStarted = true;
      openBrowser();
    }
  }
});

reactProcess.stderr.on('data', (data) => {
  const output = data.toString();
  if (!output.includes('webpack')) {
    console.log(output);
  }
});

function openBrowser() {
  console.log('\n📱 React server is ready!');
  console.log('\n🌐 Opening browser...');
  
  // Try different methods to open browser
  const url = 'http://localhost:3000';
  
  // Windows-specific command
  if (process.platform === 'win32') {
    exec(`start ${url}`, (error) => {
      if (error) {
        console.log('⚠️  Could not auto-open browser. Please manually open: ' + url);
      } else {
        console.log('✅ Browser opened successfully!');
      }
    });
  } 
  // macOS
  else if (process.platform === 'darwin') {
    exec(`open ${url}`, (error) => {
      if (error) {
        console.log('⚠️  Could not auto-open browser. Please manually open: ' + url);
      } else {
        console.log('✅ Browser opened successfully!');
      }
    });
  }
  // Linux
  else {
    exec(`xdg-open ${url}`, (error) => {
      if (error) {
        console.log('⚠️  Could not auto-open browser. Please manually open: ' + url);
      } else {
        console.log('✅ Browser opened successfully!');
      }
    });
  }
  
  showTestingInstructions();
}

function showTestingInstructions() {
  console.log(`
✅ Testing Setup Complete!

🌐 APP URL: http://localhost:3000

🎮 TESTING FEATURES:
- Mock Telegram user data loaded
- All Telegram API calls logged to console  
- Press ESC to test back button
- Haptic feedback shows as visual effects
- Alerts show as browser dialogs

📱 MOBILE TESTING:
1. Open Chrome DevTools (F12)
2. Click device toolbar icon (mobile view)
3. Select iPhone/Android preset
4. Test touch interactions

🔧 CONSOLE COMMANDS:
Open DevTools Console and try:
- window.Telegram.WebApp.showAlert("Test message")
- window.Telegram.WebApp.HapticFeedback.impactOccurred("heavy")
- window.Telegram.WebApp.close()

🚨 LOOK FOR:
- Red "🤖 TELEGRAM MOCK MODE" badge in top-right
- Console logs for all Telegram API calls
- Visual effects for haptic feedback

Press Ctrl+C to stop testing
  `);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping test server...');
  if (reactProcess) {
    reactProcess.kill();
  }
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping test server...');
  if (reactProcess) {
    reactProcess.kill();
  }
  process.exit();
}); 