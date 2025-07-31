# 🎮 SlotPot Betting Simulation Guide

This guide explains how to use the backend simulation system to test the roulette wheel and winner selection functionality.

## 🚀 Quick Start

### 1. Start the Backend Server
```bash
cd backend
npm start
```

### 2. Run a Full Simulation
```bash
# In the backend directory
node test-simulation.js simulate
```

### 3. Test Winner Broadcast Only
```bash
node test-simulation.js test-winner
```

## 📡 API Endpoints

### `/api/admin/simulate-session`
Runs a complete betting simulation with multiple players.

**Method:** `POST`
**Authentication:** Requires `ADMIN_API_KEY`

**Request Body:**
```json
{
  "adminKey": "your-admin-key",
  "playerCount": 5,
  "sessionDuration": 45
}
```

**Response:**
```json
{
  "success": true,
  "message": "Betting simulation started",
  "simulation": {
    "simulationId": "sim_1234567890",
    "playerCount": 5,
    "sessionDuration": 45,
    "players": [
      {
        "username": "CryptoKing1234",
        "address": "EQDabc123..."
      }
    ],
    "status": "started"
  }
}
```

### `/api/admin/test-winner`
Broadcasts a test winner announcement.

**Method:** `POST`
**Authentication:** Requires `ADMIN_API_KEY`

## 🎯 Simulation Flow

### Phase 1: Player Generation (Instant)
- Generates realistic player data with names like "CryptoKing", "TONMaster", etc.
- Creates unique wallet addresses and Telegram IDs
- Registers players in the user service
- Generates avatar URLs using DiceBear API

### Phase 2: Betting Phase (70% of session duration)
- Players place bets at random intervals
- Bet amounts: 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 5.0, or 10.0 TON
- Each bet triggers:
  - Chat notification
  - Player joining broadcast
  - User registration
  - Socket.io events

### Phase 3: Winner Selection (30% of session duration)
- Selects random winner from participating players
- Calculates prize (95% of total jackpot)
- Broadcasts winner announcement
- Updates chat with winner message

## 🔧 Configuration

### Environment Variables
```bash
# Required for simulation
ADMIN_API_KEY=your-secret-admin-key

# Optional
SERVER_URL=https://strongly-export-anthony-prince.trycloudflare.com
PORT=5002
```

### Simulation Parameters
- **playerCount**: Number of simulated players (1-10 recommended)
- **sessionDuration**: Total simulation time in seconds (30-120 recommended)

## 🎰 Roulette Integration

The simulation is designed to work with the new three-state roulette wheel:

1. **Idle State**: Wheel moves constantly while waiting
2. **Waiting State**: Wheel stops when simulation starts betting
3. **Spinning State**: Wheel spins to winner when simulation completes

## 📊 Generated Player Data

Players are created with realistic data:

```javascript
{
  address: "EQDabc123...",           // Simulated TON address
  username: "CryptoKing1234",       // Random name + number
  firstName: "CryptoKing",          // Base name
  lastName: "Player1234",           // Player + number
  telegramId: 100001,               // Sequential ID
  avatar: "https://api.dicebear..." // Generated avatar
}
```

## 🔍 Monitoring

### Backend Logs
Watch the backend console for detailed simulation progress:
```
🎮 Starting betting simulation: 5 players, 45s duration
👥 Generated 5 simulated players
✅ Registered player: CryptoKing1234
🎰 CryptoKing1234 placed bet: 2.5 TON
🏆 Simulation winner selected: TONMaster5678 wins 9.500 TON
✅ Betting simulation completed
```

### Frontend Integration
- Players appear in the roulette wheel as they join
- Chat shows betting notifications
- Winner announcement triggers roulette spin animation
- Wheel lands precisely on the selected winner

## 🛠️ Troubleshooting

### Common Issues

**"Unauthorized" Error**
```bash
# Make sure ADMIN_API_KEY is set in your .env file
echo "ADMIN_API_KEY=your-secret-key" >> .env
```

**"Server not responding"**
```bash
# Check if backend is running
curl https://strongly-export-anthony-prince.trycloudflare.com/ping
```

**"No players visible"**
- Check Socket.io connection in browser dev tools
- Verify frontend is connected to correct backend URL
- Check for CORS issues in browser console

### Debug Endpoints

**Health Check:**
```bash
curl https://strongly-export-anthony-prince.trycloudflare.com/health
```

**Rate Limit Status:**
```bash
curl https://strongly-export-anthony-prince.trycloudflare.com/api/debug/rate-limits
```

## 🎯 Testing Scenarios

### Quick Test (5 seconds)
```bash
# Fast test with 2 players
curl -X POST https://strongly-export-anthony-prince.trycloudflare.com/api/admin/simulate-session \
  -H "Content-Type: application/json" \
  -d '{"adminKey":"your-key","playerCount":2,"sessionDuration":5}'
```

### Full Demo (2 minutes)
```bash
# Realistic demo with 5 players
curl -X POST https://strongly-export-anthony-prince.trycloudflare.com/api/admin/simulate-session \
  -H "Content-Type: application/json" \
  -d '{"adminKey":"your-key","playerCount":5,"sessionDuration":120}'
```

### Load Test (10 players)
```bash
# Stress test with many players
curl -X POST https://strongly-export-anthony-prince.trycloudflare.com/api/admin/simulate-session \
  -H "Content-Type: application/json" \
  -d '{"adminKey":"your-key","playerCount":10,"sessionDuration":60}'
```

## 📱 Frontend Expectations

When running a simulation, you should see:

1. **Chat messages** about simulation starting
2. **Players joining** the roulette wheel one by one
3. **Bet notifications** in the chat
4. **Wheel state changes** from idle → waiting → spinning
5. **Winner announcement** with celebration effects
6. **Wheel landing** precisely on the winner

## 🔄 Integration with Admin Automation

The simulation works alongside the existing admin automation:

- Respects current round timers
- Integrates with socket broadcasting
- Uses existing user service
- Follows chat message patterns
- Triggers winner detection flow

This allows you to test the complete betting and winner selection flow without needing real users or blockchain transactions! 