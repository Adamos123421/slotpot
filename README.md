# SlotPot - Decentralized Betting Frontend

A modern React frontend for a slot pot betting platform inspired by decentralized gambling applications. This is the UI/UX layer that will later be connected to TON blockchain smart contracts.

## 🎰 Features

- **Modern Dark Theme UI** - Beautiful glassmorphism design with purple accents
- **Real-time Game Interface** - Live jackpot display with countdown timer
- **Interactive Betting System** - Bet amount controls with dynamic chance calculation
- **Player Slots Grid** - Visual representation of current players and their bets
- **Live Chat System** - Real-time messaging with user levels and timestamps
- **Leaderboard & Stats** - Winner showcase and recent game statistics
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- **Animated Elements** - Smooth transitions and hover effects throughout

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone or download the project**
2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

## 🏗️ Project Structure

```
src/
├── components/
│   ├── Header.js          # Top navigation with logo and tabs
│   ├── Header.css
│   ├── GameArea.js        # Main betting interface
│   ├── GameArea.css
│   ├── PlayerSlot.js      # Individual player card component
│   ├── PlayerSlot.css
│   ├── Chat.js            # Live chat sidebar
│   ├── Chat.css
│   ├── Leaderboard.js     # Winner stats and leaderboard
│   └── Leaderboard.css
├── App.js                 # Main application component
├── App.css               
├── index.js              # React entry point
└── index.css             # Global styles
```

## 🎮 Components Overview

### Header Component
- **Navigation tabs** (Jackpot, Coinflip, Affiliates)
- **Total bets counter**
- **Weekly leaderboard badge**
- **Connect wallet button**

### Game Area Component
- **Jackpot display** with live value updates
- **Betting controls** with amount input and quick bet buttons
- **Game statistics** (jackpot value, user wager, win chance, time remaining)
- **Player slots grid** showing current participants

### Player Slot Component
- **Avatar display** (generated or custom)
- **Player information** (name, level, bet amount)
- **Win percentage** for active players
- **Waiting state** for empty slots

### Chat Component
- **Live messaging** with simulated users
- **User levels** and timestamps
- **Message input** with send functionality
- **Online user counter**

### Leaderboard Component
- **Last winner showcase** with crown animation
- **Previous round statistics**
- **Recent winners list**
- **Luck of the day** special section

## 🎨 Design Features

- **Color Scheme:** Dark background with purple (#8b5cf6) accents
- **Typography:** Inter font family for modern readability
- **Animations:** Smooth hover effects, pulsing indicators, and glow effects
- **Responsive:** Mobile-first design with grid layouts
- **Glassmorphism:** Backdrop blur effects and transparent panels

## 🔧 Customization

### Adding New Players
Edit the `players` array in `GameArea.js`:
```javascript
const players = [
  { id: 1, name: 'PlayerName', avatar: null, bet: 0.000, chance: 0 },
  // Add more players...
];
```

### Modifying Chat Messages
Update the `randomMessages` array in `Chat.js` to add new automated messages.

### Changing Color Theme
Update the CSS custom properties in `index.css` to modify the color scheme.

## 🚀 Future Integration

This frontend is designed to be easily integrated with:
- **TON Blockchain** smart contracts
- **Web3 wallets** (TonKeeper, etc.)
- **Real-time WebSocket** connections
- **Backend APIs** for user management and game logic

## 📱 Responsive Breakpoints

- **Desktop:** 1200px and above
- **Tablet:** 968px - 1199px
- **Mobile:** Below 968px

## 🛠️ Built With

- **React 18** - Frontend framework
- **Lucide React** - Icon library
- **Framer Motion** - Animation library (ready for use)
- **CSS Grid & Flexbox** - Layout systems
- **Custom CSS** - Styling without heavy frameworks

## 📝 Available Scripts

- `npm start` - Runs the app in development mode
- `npm build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm eject` - Ejects from Create React App (not recommended)

## 🎯 Next Steps

1. **Smart Contract Integration** - Connect to TON blockchain
2. **Wallet Connection** - Implement Web3 wallet connectivity
3. **Real-time Updates** - Add WebSocket support for live data
4. **User Authentication** - Add user profiles and authentication
5. **Game Logic** - Implement actual betting and winner selection logic

## 📄 License

This project is created for educational and demonstration purposes. Please ensure you comply with local gambling regulations before deploying in production. 