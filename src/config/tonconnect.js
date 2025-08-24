// TON Connect configuration
export const tonConnectConfig = {
  manifestUrl: "https://raw.githubusercontent.com/Adamos123421/slotpot/main/manifest.json",
  // For development - you can use a local manifest later
  
  // Wallet adapters
  wallets: [
    {
      name: "Tonkeeper",
      image: "https://tonkeeper.com/assets/tonconnect-icon.png",
      about_url: "https://tonkeeper.com",
      universal_url: "https://app.tonkeeper.com/ton-connect",
      bridge: [
        {
          type: "sse",
          url: "https://bridge.tonapi.io/bridge"
        }
      ]
    },
    {
      name: "TonHub",
      image: "https://tonhub.com/tonconnect_logo.png", 
      about_url: "https://tonhub.com",
      universal_url: "https://tonhub.com/ton-connect",
      bridge: [
        {
          type: "sse", 
          url: "https://connect.tonhubapi.com/tonconnect"
        }
      ]
    },
    {
      name: "OpenMask",
      image: "https://raw.githubusercontent.com/OpenProduct/openmask-extension/main/public/openmask-logo-288.png",
      about_url: "https://www.openmask.app/",
      bridge: [
        {
          type: "sse",
          url: "https://tonconnect.openmask.app/bridge/"
        }
      ]
    }
  ]
};

// TON Connect UI options
export const uiOptions = {
  uiPreferences: {
    theme: "DARK",
    colorsSet: {
      [Symbol.for('DARK')]: {
        connectButton: {
          background: "#6366f1",
          foreground: "#ffffff"
        },
        accent: "#6366f1",
        telegramButton: "#0088cc",
        background: {
          primary: "#1a1b2e",
          secondary: "#131415", 
          segment: "#2a2d47"
        },
        text: {
          primary: "#ffffff",
          secondary: "#8b8fa3"
        }
      }
    }
  },
  language: "en",
  restoreConnection: true,
  actionsConfiguration: {
    twaReturnUrl: 'https://t.me/slotpot_bot/app'
  }
}; 