// Mock Telegram WebApp for local testing
const createTelegramMock = () => {
  const mockUser = {
    id: 123456789,
    first_name: "Test",
    last_name: "User",
    username: "testuser",
    language_code: "en",
    is_premium: false
  };

  const mockWebApp = {
    initData: "mock_init_data",
    initDataUnsafe: {
      user: mockUser,
      auth_date: Date.now(),
      hash: "mock_hash"
    },
    version: "6.0",
    platform: "web",
    colorScheme: "dark",
    themeParams: {
      bg_color: "#1a1b2e",
      text_color: "#ffffff",
      hint_color: "#708499",
      link_color: "#5288c1",
      button_color: "#5288c1",
      button_text_color: "#ffffff",
      secondary_bg_color: "#131415"
    },
    isExpanded: true,
    viewportHeight: window.innerHeight,
    viewportStableHeight: window.innerHeight,
    isClosingConfirmationEnabled: false,
    isVerticalSwipesEnabled: true,

    // Methods
    ready: () => {
      console.log("📱 Telegram WebApp ready (MOCK)");
    },
    
    expand: () => {
      console.log("📱 Telegram WebApp expanded (MOCK)");
    },
    
    close: () => {
      console.log("📱 Telegram WebApp closed (MOCK)");
      window.alert("App would close in real Telegram");
    },
    
    setHeaderColor: (color) => {
      console.log(`📱 Header color set to: ${color} (MOCK)`);
      document.documentElement.style.setProperty('--tg-header-color', color);
    },
    
    setBackgroundColor: (color) => {
      console.log(`📱 Background color set to: ${color} (MOCK)`);
      document.documentElement.style.setProperty('--tg-bg-color', color);
    },
    
    enableClosingConfirmation: () => {
      console.log("📱 Closing confirmation enabled (MOCK)");
    },
    
    disableClosingConfirmation: () => {
      console.log("📱 Closing confirmation disabled (MOCK)");
    },
    
    showAlert: (message, callback) => {
      console.log(`📱 Telegram Alert: ${message} (MOCK)`);
      window.alert(`🤖 Telegram Alert:\n${message}`);
      if (callback) callback();
    },
    
    showConfirm: (message, callback) => {
      console.log(`📱 Telegram Confirm: ${message} (MOCK)`);
      const result = window.confirm(`🤖 Telegram Confirm:\n${message}`);
      if (callback) callback(result);
    },
    
    showPopup: (params, callback) => {
      console.log("📱 Telegram Popup (MOCK):", params);
      window.alert(`🤖 Telegram Popup:\n${params.message}`);
      if (callback) callback();
    },

    // Haptic Feedback
    HapticFeedback: {
      impactOccurred: (style) => {
        console.log(`📳 Haptic feedback: ${style} impact (MOCK)`);
        // Visual feedback for desktop testing
        document.body.style.transform = 'scale(0.98)';
        setTimeout(() => {
          document.body.style.transform = 'scale(1)';
        }, 100);
      },
      
      notificationOccurred: (type) => {
        console.log(`📳 Haptic notification: ${type} (MOCK)`);
        // Visual feedback for desktop testing
        document.body.style.filter = 'brightness(1.1)';
        setTimeout(() => {
          document.body.style.filter = 'brightness(1)';
        }, 150);
      },
      
      selectionChanged: () => {
        console.log("📳 Haptic selection changed (MOCK)");
      }
    },

    // Back Button
    BackButton: {
      isVisible: false,
      show: () => {
        console.log("◀️ Back button shown (MOCK)");
        mockWebApp.BackButton.isVisible = true;
      },
      hide: () => {
        console.log("◀️ Back button hidden (MOCK)");
        mockWebApp.BackButton.isVisible = false;
      },
      onClick: (callback) => {
        console.log("◀️ Back button click handler set (MOCK)");
        // Simulate back button with Escape key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && mockWebApp.BackButton.isVisible) {
            callback();
          }
        });
      }
    },

    // Main Button
    MainButton: {
      text: "",
      color: "#5288c1",
      textColor: "#ffffff",
      isVisible: false,
      isActive: true,
      isProgressVisible: false,
      
      setText: (text) => {
        console.log(`🔵 Main button text: ${text} (MOCK)`);
        mockWebApp.MainButton.text = text;
      },
      
      show: () => {
        console.log("🔵 Main button shown (MOCK)");
        mockWebApp.MainButton.isVisible = true;
      },
      
      hide: () => {
        console.log("🔵 Main button hidden (MOCK)");
        mockWebApp.MainButton.isVisible = false;
      },
      
      onClick: (callback) => {
        console.log("🔵 Main button click handler set (MOCK)");
      }
    }
  };

  return mockWebApp;
};

// Initialize mock when not in Telegram
export const initTelegramMock = () => {
  if (!window.Telegram) {
    console.log("🔧 Initializing Telegram WebApp Mock for local testing");
    
    window.Telegram = {
      WebApp: createTelegramMock()
    };
    
    // Add visual indicator that we're in mock mode
    const mockIndicator = document.createElement('div');
    mockIndicator.innerHTML = '🤖 TELEGRAM MOCK MODE';
    mockIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #ff6b6b;
      color: white;
      padding: 5px 10px;
      border-radius: 15px;
      font-size: 12px;
      font-weight: bold;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    document.body.appendChild(mockIndicator);
    
    // Add keyboard shortcuts info
    console.log(`
🎮 TESTING SHORTCUTS:
- ESC: Trigger back button
- Check console for all Telegram API calls
- Alerts/confirms will show as browser dialogs
- Haptic feedback shows as visual effects
    `);
  }
};

export default createTelegramMock; 