# TON Smart Contract Integration Guide

This guide explains how to configure and use the SlotPot frontend with your deployed TON smart contract.

## 🚀 Quick Setup

### 1. Environment Configuration

Create a `.env` file in your project root with the following variables:

```bash
# TON Smart Contract Configuration
REACT_APP_CONTRACT_ADDRESS=EQD__________YourContractAddressHere__________
REACT_APP_ADMIN_ADDRESS=EQA__________YourAdminAddressHere__________
REACT_APP_TON_ENDPOINT=https://testnet.toncenter.com/api/v2/jsonRPC
REACT_APP_TON_API_KEY=your_api_key_here
```

### 2. Deploy Your Smart Contract

Deploy the provided Tact smart contract to the TON network and update the contract address in your `.env` file.

### 3. Start the Application

```bash
npm install
npm start
```

## 📋 Contract Integration Features

### ✅ Implemented Features

- **Real-time Contract Data**: Fetches live jackpot amount, bet count, and contract status
- **Bet Placement**: Send TON transactions to place bets via TON Connect
- **Admin Functions**: Start/end jackpot rounds (admin wallet only)
- **User Statistics**: Display individual bet amounts and win probabilities
- **Contract State Monitoring**: Auto-refresh contract data every 10 seconds
- **Error Handling**: Comprehensive error handling for failed transactions
- **Mobile Support**: Full mobile interface for all contract functions

### 🎯 Core Contract Methods

#### User Functions
- `placeBet()` - Place a bet in the current jackpot round
- `getBettorAmount()` - Get your total bet amount
- `getWinningProbability()` - Calculate your win chance percentage

#### Admin Functions (Requires Admin Wallet)
- `startJackpot()` - Start a new jackpot round
- `endJackpot()` - End current round and select winner

#### Contract Getters
- `getTotalJackpot()` - Current jackpot amount
- `isJackpotActive()` - Whether betting is active
- `getBetCount()` - Number of bets placed
- `getLastWinner()` - Previous round winner
- `getLastPrizeAmount()` - Previous prize amount
- `getContractBalance()` - Contract TON balance

## 🔧 Configuration Details

### Contract Message Op Codes

Update these in `src/services/jackpotContract.js` to match your contract:

```javascript
export const ContractMessages = {
  startJackpot: (queryId = 0) => {
    return beginCell()
      .storeUint(0x12345678, 32) // Replace with your start op code
      .storeUint(queryId, 64)
      .endCell();
  },
  // ... other messages
};
```

### Network Configuration

- **Testnet**: `https://testnet.toncenter.com/api/v2/jsonRPC`
- **Mainnet**: `https://toncenter.com/api/v2/jsonRPC`

Get API keys from [TON Center](https://toncenter.com/) for higher rate limits.

### Admin Configuration

Set `REACT_APP_ADMIN_ADDRESS` to your admin wallet address. Users with this address will see:
- Admin panel tab in navigation
- Start/End jackpot buttons
- Enhanced contract statistics
- Admin badge in UI

## 🎮 User Interface

### Desktop Layout
- **Left Sidebar**: Live chat
- **Center Panel**: Game area with betting interface
- **Right Sidebar**: Leaderboard and statistics
- **Header**: Navigation, wallet connection, admin controls

### Mobile Layout
- **Tab Navigation**: Jackpot, Chat, Stats, Admin (if admin)
- **Swipe Interface**: Easy navigation between sections
- **Bottom Bar**: Quick stats and game information

### Betting Interface
- **Amount Input**: Select bet amount (0.1 - 10 TON)
- **Place Bet Button**: Send transaction to contract
- **User Stats**: Your bet amount and win probability
- **Contract Info**: Total jackpot, active status, bet count

## 🔐 Security Considerations

### Environment Variables
- **Never commit** your `.env` file to version control
- Store admin mnemonics securely (consider using secure vaults in production)
- Use different addresses for testnet and mainnet

### Contract Security
- Verify contract address before deployment
- Test thoroughly on testnet before mainnet
- Monitor contract balance and admin functions

### User Safety
- Clear error messages for failed transactions
- Minimum bet enforcement (0.1 TON)
- Transaction confirmation before sending
- Wallet connection status indicators

## 🛠️ Development

### File Structure
```
src/
├── services/
│   └── jackpotContract.js    # Contract interaction logic
├── hooks/
│   ├── useJackpotContract.js # React hook for contract state
│   └── useTonConnect.js      # TON Connect wallet integration
├── components/
│   ├── AdminPanel.js         # Admin interface
│   ├── GameArea.js           # Main betting interface
│   └── WalletConnection.js   # Wallet connect/disconnect
└── config/
    └── tonconnect.js         # TON Connect configuration
```

### Key React Hooks

#### `useJackpotContract()`
```javascript
const {
  contractState,      // Contract data (jackpot, bets, status)
  userStats,          // User-specific stats
  placeBet,           // Function to place bets
  startJackpot,       // Admin: start round
  endJackpot,         // Admin: end round
  isAdmin,            // Whether user is admin
  isConnected         // Wallet connection status
} = useJackpotContract();
```

#### `useTonConnect()`
```javascript
const {
  isConnected,        // Connection status
  address,            // User wallet address
  sendTransaction,    // Send any transaction
  connectWallet,      // Connect wallet
  disconnectWallet    // Disconnect wallet
} = useTonConnect();
```

## 🧪 Testing

### Local Testing
```bash
npm run test-local      # Start with simulated data
npm run test-simple     # Start normally
```

### Testnet Testing
1. Get testnet TON from [TON Testnet Faucet](https://testnet.tonwhales.com/faucet)
2. Deploy contract to testnet
3. Update `REACT_APP_CONTRACT_ADDRESS` with testnet address
4. Connect testnet wallet and place test bets

## 📱 Telegram Integration

The app includes Telegram Web App integration:

```bash
npm run test-telegram   # Test Telegram interface
```

### Telegram Features
- User data from Telegram profile
- Haptic feedback for interactions
- Native alert dialogs
- Optimized mobile interface

## ❓ Troubleshooting

### Common Issues

**Contract Not Found**
- Verify `REACT_APP_CONTRACT_ADDRESS` is correct
- Check network (testnet vs mainnet)
- Ensure contract is deployed

**Transaction Failures**
- Check wallet has sufficient TON balance
- Verify jackpot is active before betting
- Confirm minimum bet amount (0.1 TON)

**Admin Functions Not Working**
- Verify `REACT_APP_ADMIN_ADDRESS` matches your wallet
- Ensure you're connected with admin wallet
- Check contract permissions

### Debug Mode
Enable console logging by opening browser dev tools. Contract interactions are logged with emojis:
- 📊 Contract state updates
- 👤 User stats updates
- 🎰 Bet placements
- 🚀 Admin actions

## 🔄 Contract Updates

When updating your smart contract:

1. Deploy new contract version
2. Update `REACT_APP_CONTRACT_ADDRESS`
3. Update op codes in `ContractMessages` if changed
4. Test all functions with new contract
5. Update users about new contract address

## 🎯 Production Deployment

### Checklist
- [ ] Contract deployed to mainnet
- [ ] Environment variables configured for production
- [ ] Admin address secured
- [ ] API keys configured
- [ ] Error handling tested
- [ ] Mobile interface tested
- [ ] Security review completed

### Performance
- Contract state cached for 10 seconds
- User stats refreshed on wallet connection
- Automatic retry for failed API calls
- Optimized mobile experience

---

**Need Help?** Check the console for detailed error messages and transaction logs. 