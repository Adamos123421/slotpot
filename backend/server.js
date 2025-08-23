require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const adminAutomation = require('./services/adminAutomation');
const contractService = require('./services/contractService');
const socketService = require('./services/socketService');
const userService = require('./services/userService');
const statsService = require('./services/statsService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5002;

// Configure CORS for both Express and Socket.io
const corsOptions = {
  origin: [
    "http://localhost:3000", 
    "http://localhost:3001",
    process.env.FRONTEND_URL,
    process.env.REACT_APP_BACKEND_URL,
    // Allow specific Vercel deployment
    "https://slotpot-pofq4gtma-adams-projects-21612ba2.vercel.app",
    // Allow all Vercel deployments
    /^https:\/\/.*\.vercel\.app$/,
    // Allow Cloudflare tunnels
    /^https:\/\/.*\.trycloudflare\.com$/,
    "https://crops-fragrance-muscles-deposit.trycloudflare.com",
    // Allow connections from your local network
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
    /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/
  ].filter(Boolean),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  optionsSuccessStatus: 200
};

// Initialize the socket service with the HTTP server
socketService.initialize(server);
console.log('🔌 Socket service initialized with HTTP server');

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Add request logging middleware
app.use('/api', (req, res, next) => {
  // Only log important endpoints to reduce noise
  if (req.path.includes('/bet-notification') || req.path.includes('/stats')) {
    console.log(`🌐 API REQUEST: ${req.method} ${req.path} - Body:`, req.body);
  }
  next();
});

// In-memory storage for chat (replace with database in production)
let chatMessages = [];
let connectedUsers = new Map();

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
}

// Simple rate limiting middleware for specific endpoints
const rateLimiters = new Map();

function rateLimitMiddleware(endpoint, maxRequests = 50, windowMs = 60000) {
  return (req, res, next) => {
    const key = `${req.ip}-${endpoint}`;
    const now = Date.now();
    
    if (!rateLimiters.has(key)) {
      rateLimiters.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const limiter = rateLimiters.get(key);
    
    if (now > limiter.resetTime) {
      // Reset the limiter
      limiter.count = 1;
      limiter.resetTime = now + windowMs;
      return next();
    }
    
    if (limiter.count >= maxRequests) {
      console.log(`🚦 Rate limited ${endpoint} for IP ${req.ip} (${limiter.count}/${maxRequests} requests in ${windowMs/1000}s window)`);
      return res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter: Math.ceil((limiter.resetTime - now) / 1000),
        maxRequests: maxRequests,
        windowSeconds: windowMs / 1000,
        message: `Rate limit exceeded for ${endpoint}. Try again in ${Math.ceil((limiter.resetTime - now) / 1000)} seconds.`
      });
    }
    
    limiter.count++;
    next();
  };
}

// ======================
// CONTRACT API ROUTES
// ======================

// CONTRACT API ROUTES REMOVED - ALL DATA NOW BROADCAST VIA SOCKET

// ======================
// HEALTH CHECK ENDPOINT
// ======================

app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      contractPolling: getPollingStatus(),
      adminAutomation: adminAutomation.getStatus(),
      socketIO: socketService.getStatus ? socketService.getStatus() : { status: 'active' },
      chatMessages: chatMessages.length,
      connectedUsers: connectedUsers.size
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
    }
  };

  res.status(200).json(healthStatus);
});

// Simple ping endpoint for basic monitoring
app.get('/ping', (req, res) => {
  res.status(200).json({ 
    message: 'pong',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ======================
// ADMIN API ROUTES
// ======================

app.get('/api/admin/status', rateLimitMiddleware('admin-status', 10, 30000), (req, res) => {
  // Log the request for debugging
  console.log(`📊 Admin status requested from ${req.ip} at ${new Date().toISOString()}`);
  
  const status = adminAutomation.getStatus();
  res.json(status);
});

app.post('/api/admin/settings', (req, res) => {
  try {
    const { roundDuration, minBetsToEnd } = req.body;
    
    if (roundDuration) {
      adminAutomation.setRoundDuration(roundDuration);
    }
    
    if (minBetsToEnd) {
      adminAutomation.setMinBetsToEnd(minBetsToEnd);
    }
    
    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Emergency admin controls (require admin key)
app.post('/api/admin/force-start', (req, res) => {
  const { adminKey } = req.body;
  
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    adminAutomation.forceStartRound();
    res.json({ success: true, message: 'Round force started' });
  } catch (error) {
    console.error('Error force starting round:', error);
    res.status(500).json({ error: 'Failed to force start round' });
  }
});

app.post('/api/admin/force-end', (req, res) => {
  const { adminKey } = req.body;
  
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    adminAutomation.forceEndRound();
    res.json({ success: true, message: 'Round force ended' });
  } catch (error) {
    console.error('Error force ending round:', error);
    res.status(500).json({ error: 'Failed to force end round' });
  }
});

// Test winner broadcast endpoint
app.post('/api/admin/test-winner', (req, res) => {
  const { adminKey } = req.body;
  
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const result = adminAutomation.testWinnerBroadcast();
    res.json({ 
      success: true, 
      message: 'Test winner broadcast sent',
      broadcasted: result
    });
  } catch (error) {
    console.error('Error sending test winner broadcast:', error);
    res.status(500).json({ error: 'Failed to send test winner broadcast' });
  }
});

// Simulate a complete betting session with players and winner
app.post('/api/admin/simulate-session', async (req, res) => {
  const { adminKey, playerCount = 3, sessionDuration = 30 } = req.body;
  
 
  
  try {
    console.log(`🎮 Starting simulation with ${playerCount} players for ${sessionDuration} seconds`);
    
    // Start the simulation
    const simulationResult = await startBettingSimulation(playerCount, sessionDuration);
    
    res.json({ 
      success: true, 
      message: 'Betting simulation started',
      simulation: simulationResult
    });
  } catch (error) {
    console.error('Error starting betting simulation:', error);
    res.status(500).json({ error: 'Failed to start betting simulation' });
  }
});

// Clear simulated bettors
app.post('/api/admin/clear-simulation', async (req, res) => {
  const { adminKey } = req.body;
  
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    contractService.clearSimulatedBettors();
    
    // Broadcast updated (empty) bettors list
    const currentBettors = contractService.getCurrentBettors();
    socketService.broadcastMessage({
      type: 'bettorsUpdate',
      bettors: currentBettors,
      simulation: false
    });
    
    broadcastAutomationEvent('🗑️ Simulation cleared - all simulated players removed', 'simulation');
    
    res.json({ 
      success: true, 
      message: 'Simulated bettors cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing simulation:', error);
    res.status(500).json({ error: 'Failed to clear simulation' });
  }
});

// ======================
// USER API ROUTES
// ======================

// Register or update user information
app.post('/api/user/register', async (req, res) => {
  try {
    const { address, username, firstName, lastName, telegramId } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    const userData = {
      username: username || `Player_${address.slice(-4)}`,
      firstName: firstName || '',
      lastName: lastName || '',
      telegramId: telegramId || null
    };
    
    const success = await userService.registerUser(address, userData);
    
    if (success) {
      const userInfo = userService.getUserInfo(address);
      res.json({ 
        success: true, 
        message: 'User registered successfully',
        user: userInfo
      });
    } else {
      res.status(500).json({ error: 'Failed to register user' });
    }
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Get user information by address
app.get('/api/user/:address', (req, res) => {
  try {
    const { address } = req.params;
    const userInfo = userService.getUserInfo(address);
    
    if (userInfo) {
      res.json(userInfo);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Update username for an address
app.post('/api/user/update-username', async (req, res) => {
  try {
    const { address, username } = req.body;
    
    if (!address || !username) {
      return res.status(400).json({ error: 'Address and username are required' });
    }
    
    const success = await userService.registerUser(address, { username });
    
    if (success) {
      const userInfo = userService.getUserInfo(address);
      res.json({ 
        success: true, 
        message: 'Username updated successfully',
        user: userInfo
      });
    } else {
      res.status(500).json({ error: 'Failed to update username' });
    }
  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// Get all registered users (admin only)
app.get('/api/admin/users', (req, res) => {
  try {
    const users = userService.getAllUsers();
    const stats = userService.getStats();
    
    res.json({
      users: users,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Ensure user is registered (for any wallet connection)
app.post('/api/user/ensure-registered', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    // Always register user, even with minimal data
    const userData = {
      username: `Player_${address.slice(-4)}`,
      firstName: '',
      lastName: '',
      telegramId: null
    };
    
    const success = await userService.registerUser(address, userData);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'User ensured registered',
        address: address
      });
    } else {
      res.status(500).json({ error: 'Failed to register user' });
    }
  } catch (error) {
    console.error('Error ensuring user registration:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// ======================
// CHAT API ROUTES
// ======================

// Get chat history
app.get('/api/chat/messages', (req, res) => {
  res.json({
    messages: chatMessages.slice(-50), // Last 50 messages
    totalUsers: connectedUsers.size
  });
});

// Get game state (combined with contract data)
app.get('/api/game/state', async (req, res) => {
  try {
    const contractState = await contractService.getContractState();
    const adminStatus = adminAutomation.getStatus();
    
    res.json({
      ...contractState,
      // Add timer information directly to game state
      currentRound: adminStatus.currentRound,
      roundDuration: adminStatus.roundDuration,
      timer: {
        isActive: adminStatus.currentRound.isActive,
        timeRemaining: adminStatus.currentRound.timeRemaining,
        timeElapsed: adminStatus.currentRound.timeElapsed,
        roundNumber: adminStatus.currentRound.roundNumber
      },
      players: [] // This could be populated from connected users or contract data
    });
  } catch (error) {
    console.error('Error fetching game state:', error);
    res.status(500).json({ error: 'Failed to fetch game state' });
  }
});

// Notify about bet placement
app.post('/api/game/bet-notification', async (req, res) => {
  try {
    console.log(`🔔 BET NOTIFICATION API CALLED! Full request body:`, req.body);
    const { amount, address, username, telegramId, firstName, lastName, referralCode } = req.body;
    console.log(`📋 Extracted data: address="${address}", username="${username}", telegramId="${telegramId}", referralCode="${referralCode}"`);
    
    // Register/update user with full Telegram data if available
    if (address && username) {
      // Use WebApp photoUrl first, fallback to Bot API
      let telegramPhotoUrl = req.body.photoUrl || null;
      
      if (!telegramPhotoUrl && telegramId) {
        try {
          console.log(`📸 BET NOTIFICATION: WebApp photoUrl not available, fetching via Bot API for ${username} (ID: ${telegramId})`);
          telegramPhotoUrl = await userService.fetchTelegramProfilePicture(telegramId);
          if (telegramPhotoUrl) {
            console.log(`✅ BET NOTIFICATION: Successfully fetched profile picture via Bot API: ${telegramPhotoUrl.substring(0, 50)}...`);
          } else {
            console.log(`❌ BET NOTIFICATION: Failed to fetch profile picture for ${username}`);
          }
        } catch (error) {
          console.error(`❌ BET NOTIFICATION: Error fetching profile picture:`, error.message);
        }
      } else if (telegramPhotoUrl) {
        console.log(`✅ BET NOTIFICATION: Using WebApp photoUrl for ${username}`);
      }

      const userData = {
        username,
        telegramId,
        firstName,
        lastName,
        telegramPhotoUrl // Include the fetched photo URL
      };
      console.log(`🔔 BET NOTIFICATION: Registering user ${username} (${address.slice(0,8)}...) with Telegram ID: ${telegramId}`);
      await userService.registerUser(address, userData);
      
      // Save username and photo in contract service dictionary for immediate use
      const photoUrl = telegramPhotoUrl || req.body.photoUrl || null;
      contractService.saveUsername(address, username, photoUrl);
      console.log(`✅ BET NOTIFICATION: User registration completed for ${username}`);
      console.log(`💾 BET NOTIFICATION: User data saved in contract service dict: username=${username}, photo=${photoUrl ? 'yes' : 'no'}`);
      
      // Handle referral registration if this is a new user with a referral code
      if (referralCode && referralCode !== address) {
        try {
          console.log(`🎯 BET NOTIFICATION: Processing referral for new user ${address.slice(0,8)}... with code ${referralCode.slice(0,8)}...`);
          
          // Check if user already has activity
          const existingPlayer = await statsService.getPlayerStats(address);
          if (!existingPlayer || (existingPlayer.totalBets === 0 && existingPlayer.totalWins === 0)) {
            // Check if referrer exists and has activity
            const referrerStats = await statsService.getPlayerStats(referralCode);
            if (referrerStats && (referrerStats.totalBets > 0 || referrerStats.totalWins > 0)) {
              const result = await statsService.registerReferral({ address, referrer: referralCode });
              if (result.success) {
                console.log(`✅ BET NOTIFICATION: Referral registered successfully for ${address.slice(0,8)}... referred by ${referralCode.slice(0,8)}...`);
              } else {
                console.log(`❌ BET NOTIFICATION: Referral registration failed: ${result.error}`);
              }
            } else {
              console.log(`❌ BET NOTIFICATION: Referrer ${referralCode.slice(0,8)}... has no activity, skipping referral`);
            }
          } else {
            console.log(`❌ BET NOTIFICATION: User ${address.slice(0,8)}... already has activity, skipping referral`);
          }
        } catch (error) {
          console.error(`❌ BET NOTIFICATION: Error processing referral:`, error.message);
        }
      }
    }
    
    // Calculate net amount after 0.05 TON fee
    const netAmount = Math.max(0, parseFloat(amount) - 0.05);
    
    // Use the username that was sent from the frontend, or get from contract service dictionary as fallback
    const actualUsername = username || (address ? contractService.getUsername(address) : 'Unknown Player');
    
    // Create bet notification message with net amount
    const betMessage = {
      id: uuidv4(),
      username: 'system',
      message: `🎰 ${actualUsername} placed a bet of ${amount} TON (${netAmount.toFixed(3)} TON to jackpot)!`,
      timestamp: new Date(),
      type: 'bet'
    };

    // Add to chat history
    chatMessages.push(betMessage);
    
    // Keep only last 100 messages
    if (chatMessages.length > 100) {
      chatMessages = chatMessages.slice(-100);
    }

    // Broadcast to all connected users
    socketService.broadcastChatMessage(betMessage);
    
    console.log(`🎰 Bet notification: ${actualUsername} - ${amount} TON (${netAmount.toFixed(3)} TON net)`);
    
    res.json({ success: true, message: 'Bet notification sent', username: actualUsername });
  } catch (error) {
    console.error('Error sending bet notification:', error);
    res.status(500).json({ error: 'Failed to send bet notification' });
  }
});

// Clear user cache (for testing)
app.post('/api/admin/clear-user', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    
    const cleared = userService.clearUser(address);
    res.json({ success: true, cleared, message: `User cache cleared for ${address.slice(0,8)}...` });
  } catch (error) {
    console.error('Error clearing user cache:', error);
    res.status(500).json({ error: 'Failed to clear user cache' });
  }
});

// Health check endpoint with rate limiting status
app.get('/api/health', (req, res) => {
  const adminStatus = adminAutomation.getStatus();
  const contractCacheStatus = contractService.getCacheStatus();
  const pollingStatus = getPollingStatus();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    admin: {
      isInitialized: adminStatus.isInitialized,
      isHealthy: adminAutomation.isHealthy(),
      totalRoundsStarted: adminStatus.stats.roundsStarted,
      totalRoundsEnded: adminStatus.stats.roundsEnded,
      totalErrors: adminStatus.stats.errors
    },
    contract: {
      cacheStatus: contractCacheStatus,
      endpoint: process.env.TON_ENDPOINT,
      hasApiKey: !!process.env.TON_API_KEY
    },
    polling: pollingStatus,
    settings: {
      requestDelay: adminStatus.requestDelay,
      cacheExpiry: contractCacheStatus.cacheExpiry
    }
  });
});

// Get polling status endpoint
app.get('/api/contract/polling-status', (req, res) => {
  const status = getPollingStatus();
  res.json({
    success: true,
    ...status,
    dataFreshness: status.hasData ? 
      (status.dataAge < 10000 ? 'fresh' : 
       status.dataAge < 30000 ? 'stale' : 'old') : 'none'
  });
});

// Manual polling trigger (admin only)
app.post('/api/contract/force-poll', (req, res) => {
  const { adminKey } = req.body;
  
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Trigger immediate poll
  pollContractState()
    .then(() => {
      res.json({ 
        success: true, 
        message: 'Manual poll triggered',
        status: getPollingStatus()
      });
    })
    .catch((error) => {
      res.status(500).json({ 
        success: false, 
        error: error.message,
        status: getPollingStatus()
      });
    });
});

// Rate limiting status endpoint
app.get('/api/admin/rate-limit-status', (req, res) => {
  try {
    const adminStatus = adminAutomation.getStatus();
    const contractStatus = contractService.getCacheStatus();
    
    res.json({
      success: true,
      data: {
        automation: {
          rateLimitErrors: adminStatus.stats.rateLimitErrors,
          totalErrors: adminStatus.stats.errors,
          lastError: adminStatus.stats.lastError,
          isHealthy: adminAutomation.isHealthy(),
          cache: adminStatus.cacheStatus
        },
        contractService: contractStatus,
        recommendations: {
          increaseInterval: adminStatus.stats.rateLimitErrors > 10,
          increaseDelay: adminStatus.stats.rateLimitErrors > 5,
          getApiKey: !process.env.TON_API_KEY && adminStatus.stats.rateLimitErrors > 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear caches endpoint
app.post('/api/admin/clear-cache', (req, res) => {
  try {
    adminAutomation.clearCache();
    contractService.clearCache();
    
    res.json({
      success: true,
      message: 'All caches cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to check registered users
app.get('/api/debug/users', (req, res) => {
  const users = userService.getAllUsers();
  res.json({
    totalUsers: users.length,
    users: users.map(user => ({
      address: user.address.slice(0, 8) + '...',
      username: user.username,
      telegramId: user.telegramId,
      hasPhoto: !!user.telegramPhotoUrl,
      lastSeen: user.lastSeen
    }))
  });
});

// ======================
// STATS API ROUTES
// ======================

// Get player statistics
app.get('/api/stats/player/:address', async (req, res) => {
  try {
    const { address } = req.params;
    console.log(`📊 Stats requested for player: ${address}`);
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const stats = await statsService.getPlayerStats(address);
    console.log(`📊 Player stats result:`, stats);
    
    if (!stats) {
      // Return empty stats instead of null
      const emptyStats = {
        address,
        totalBets: 0,
        totalAmountBet: 0,
        totalPrize: 0,
        totalWins: 0,
        referralCount: 0,
        referralEarnings: 0,
        referrer: null,
        firstSeen: null,
        lastSeen: null
      };
      console.log(`📊 No stats found, returning empty stats for ${address}`);
      return res.json(emptyStats);
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

// Get overall stats summary
app.get('/api/stats/summary', async (req, res) => {
  try {
    const summary = await statsService.getSummary();
    res.json(summary || {
      totalPlayers: 0,
      totalBets: 0,
      totalVolume: 0,
      totalPrizes: 0
    });
  } catch (error) {
    console.error('Error fetching stats summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Get recent games
app.get('/api/stats/recent-games', async (req, res) => {
  try {
    const games = await statsService.getRecentGames();
    
    // Enhance games with current usernames (fast synchronous lookup)
    const enhancedGames = (games || []).map(game => {
      if (game.winnerAddress) {
        const currentUserInfo = userService.getUserInfo(game.winnerAddress);
        return {
          ...game,
          currentUsername: currentUserInfo.username,
          displayName: currentUserInfo.username || game.username,
          avatar: currentUserInfo.telegramPhotoUrl || null, // Use cached photo only
          winnerAddress: game.winnerAddress // Include for frontend avatar generation
        };
      }
      return game;
    });
    
    res.json(enhancedGames);
  } catch (error) {
    console.error('Error fetching recent games:', error);
    res.status(500).json({ error: 'Failed to fetch recent games' });
  }
});

// Get leaderboard
app.get('/api/stats/leaderboard', async (req, res) => {
  try {
    const { by = 'totalPrize', limit = 10 } = req.query;
    const leaderboard = await statsService.getLeaderboard({ by, limit: parseInt(limit) });
    res.json(leaderboard || []);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ======================
// REFERRAL API ROUTES
// ======================

// Register referral relationship
app.post('/api/referral/register', async (req, res) => {
  try {
    const { address, referrer, telegramId, username } = req.body;
    
    console.log(`🎯 MANUAL REFERRAL REGISTRATION API CALLED!`, {
      address: address?.slice(0, 8) + '...',
      referrer: referrer?.slice(0, 8) + '...',
      telegramId,
      username,
      fullBody: req.body
    });

    if (!address || !referrer) {
      console.log(`❌ Referral rejected: Missing address or referrer`);
      return res.status(400).json({ 
        success: false, 
        error: 'Both address and referrer are required' 
      });
    }

    // Always attempt referral registration - let the service decide
    console.log(`🎯 Attempting referral registration: ${address.slice(0, 8)}... referred by ${referrer.slice(0, 8)}...`);
    
    const result = await statsService.registerReferral({ address, referrer });
    
    if (result.success) {
      console.log(`✅ MANUAL REFERRAL SUCCESS: ${address.slice(0, 8)}... referred by ${referrer.slice(0, 8)}...`);
      
      // Register user with Telegram data if provided
      if (telegramId || username) {
        await userService.registerUser(address, {
          telegramId,
          username,
          firstName: username,
          lastName: ''
        });
      }
      
      res.json({
        success: true,
        message: 'Referral registered successfully',
        referralCode: referrer,
        botLink: 'https://t.me/SniffThePotBot_bot/sloot'
      });
    } else {
      console.log(`❌ MANUAL REFERRAL FAILED: ${result.error}`);
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error registering referral:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to register referral' 
    });
  }
});

// Get referral info for a user
app.get('/api/referral/info/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    console.log(`📊 REFERRAL INFO API CALLED for address: ${address?.slice(0, 8)}...`);
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const stats = await statsService.getPlayerStats(address);
    console.log('📊 Referral info - stats from getPlayerStats:', stats);
    
    if (!stats) {
      return res.json({
        address,
        referrer: null,
        referralCount: 0,
        referralEarnings: 0,
        canRefer: true,
        referralCode: address,
        botLink: 'https://t.me/SniffThePotBot_bot/sloot'
      });
    }

    const response = {
      address,
      referrer: stats.referrer,
      referralCount: stats.referralCount || 0,
      referralEarnings: stats.referralEarnings || 0,
      canRefer: true,
      referralCode: address,
      botLink: 'https://t.me/SniffThePotBot_bot/sloot'
    };
    
    console.log('📊 Referral info - response:', response);
    res.json(response);
  } catch (error) {
    console.error('Error fetching referral info:', error);
    res.status(500).json({ error: 'Failed to fetch referral info' });
  }
});

// Get referral leaderboard (top referrers)
app.get('/api/referral/leaderboard', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    if (!statsService.isReady()) {
      return res.json([]);
    }

    const leaderboard = await statsService.collections.players
      .find({ referralCount: { $gt: 0 } })
      .sort({ referralEarnings: -1, referralCount: -1 })
      .limit(parseInt(limit))
      .project({ 
        address: 1, 
        referralCount: 1, 
        referralEarnings: 1, 
        usernameSnapshot: 1,
        _id: 0 
      })
      .toArray();

    // Enhance with current usernames
    const enhancedLeaderboard = leaderboard.map(entry => {
      const currentUserInfo = userService.getUserInfo(entry.address);
      return {
        ...entry,
        username: currentUserInfo.username || entry.usernameSnapshot || `Player ${entry.address.slice(0, 6)}...`,
        avatar: currentUserInfo.telegramPhotoUrl
      };
    });

    res.json(enhancedLeaderboard);
  } catch (error) {
    console.error('Error fetching referral leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch referral leaderboard' });
  }
});

// Test endpoint to manually test referral system
app.post('/api/referral/test', async (req, res) => {
  try {
    const { referrer, newUser } = req.body;
    
    if (!referrer || !newUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both referrer and newUser addresses are required' 
      });
    }

    console.log(`🧪 TESTING REFERRAL: ${referrer.slice(0,8)}... referring ${newUser.slice(0,8)}...`);

    // Check if referrer exists and has activity
    const referrerStats = await statsService.getPlayerStats(referrer);
    if (!referrerStats || (referrerStats.totalBets === 0 && referrerStats.totalWins === 0)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Referrer must have betting activity' 
      });
    }

    // Check if new user has no activity
    const newUserStats = await statsService.getPlayerStats(newUser);
    if (newUserStats && (newUserStats.totalBets > 0 || newUserStats.totalWins > 0)) {
      return res.status(400).json({ 
        success: false, 
        error: 'New user already has betting activity' 
      });
    }

    // Register the referral
    const result = await statsService.registerReferral({ address: newUser, referrer });
    
    if (result.success) {
      console.log(`✅ TEST SUCCESS: Referral registered for ${newUser.slice(0,8)}...`);
      res.json({
        success: true,
        message: 'Test referral registered successfully',
        referrer,
        newUser
      });
    } else {
      console.log(`❌ TEST FAILED: ${result.error}`);
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error testing referral:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to test referral' 
    });
  }
});

// ======================
// SOCKET.IO CHAT FUNCTIONALITY
// ======================

socketService.setupSocketEventHandlers((socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // Handle user joining
  socket.on('user:join', (userData) => {
    const user = {
      id: socket.id,
      username: userData.username || `User${Math.floor(Math.random() * 1000)}`,
      avatar: userData.avatar || '👤',
      joinedAt: new Date(),
      isOnline: true
    };
    
    connectedUsers.set(socket.id, user);
    
    // Notify others about new user
    socket.broadcast.emit('user:joined', {
      username: user.username,
      totalUsers: connectedUsers.size
    });

    // Send current chat history to new user
    socket.emit('chat:history', chatMessages.slice(-50));
    
    console.log(`👤 ${user.username} joined the chat`);
  });

  // Handle chat messages
  socket.on('chat:message', (data) => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    const message = {
      id: uuidv4(),
      username: user.username,
      message: data.message.trim(),
      timestamp: new Date(),
      type: 'user',
      avatar: user.avatar
    };

    // Add to chat history
    chatMessages.push(message);
    
    // Keep only last 100 messages
    if (chatMessages.length > 100) {
      chatMessages = chatMessages.slice(-100);
    }

    // Broadcast to all users
    socketService.broadcastChatMessage(message);

    console.log(`💬 ${user.username}: ${message.message}`);
  });

  // Handle betting notifications (when user places bet)
  socket.on('game:bet', async (data) => {
    // Use username from bet data (from wallet registration) or fallback to chat user
    const chatUser = connectedUsers.get(socket.id);
    const username = data.username || chatUser?.username || 'Anonymous Player';
    
    console.log(`🎰 ${username} placed bet: ${data.amount} TON (from address: ${data.address?.slice(0, 8)}...)`);
    
    // Register user with full Telegram data if available
    if (data.address && data.username) {
      const userData = {
        username: data.username,
        telegramId: data.telegramId,
        firstName: data.firstName,
        lastName: data.lastName
      };
      console.log(`🎰 SOCKET BET: Registering user ${data.username} (${data.address?.slice(0,8)}...) with Telegram ID: ${data.telegramId}`);
      await userService.registerUser(data.address, userData);
      console.log(`✅ SOCKET BET: User registration completed for ${data.username}`);
    }
    
    // Broadcast bet notification using the actual username
    const betMessage = {
      id: uuidv4(),
      username: 'system',
      message: `🎰 ${username} placed a bet of ${data.amount} TON!`,
      timestamp: new Date(),
      type: 'bet'
    };

    chatMessages.push(betMessage);
    socketService.broadcastChatMessage(betMessage);
  });

  // Handle typing indicators
  socket.on('chat:typing', (isTyping) => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    socket.broadcast.emit('user:typing', {
      username: user.username,
      isTyping
    });
  });

  // Handle online count request
  socket.on('getOnlineCount', () => {
    socket.emit('onlineCount', {
      count: connectedUsers.size
    });
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.delete(socket.id);
      
      // Notify others about user leaving
      socket.broadcast.emit('user:left', {
        username: user.username,
        totalUsers: connectedUsers.size
      });

      console.log(`👋 ${user.username} left the chat`);
    }
  });
});

// ======================
// AUTOMATION EVENTS TO CHAT
// ======================

// Function to broadcast automation events to chat
function broadcastAutomationEvent(message, type = 'system') {
  const systemMessage = {
    id: uuidv4(),
    username: 'system',
    message: message,
    timestamp: new Date(),
    type: type
  };

  chatMessages.push(systemMessage);
  socketService.broadcastChatMessage(systemMessage);
}

// Listen for automation events (you can call these from adminAutomation service)
global.broadcastToChat = broadcastAutomationEvent;

// ======================
// BETTOR TRACKING - REMOVED (USING CONTRACT DATA ONLY)
// ======================

// All bettor data now comes from the contract via contractService.getAllBettors()
// All jackpot data now comes from the contract via contractService.getContractState()

// Calculate winner prize (95% of total jackpot)
function calculateWinnerPrize(totalJackpot) {
  return totalJackpot * 0.95; // Winner gets 95%, 5% is fee
}

// ======================
// BETTOR API ROUTES - REMOVED (ALL DATA NOW BROADCAST VIA SOCKET)
// ======================

// Make utility functions globally available for admin automation
global.calculateWinnerPrize = calculateWinnerPrize;
global.getCachedBettors = getCachedBettors;
global.getCachedContractState = getCachedContractState;

// ======================
// GLOBAL STATE MANAGER - POLLS CONTRACT EVERY 6 SECONDS
// ======================

let globalContractState = {
  contractState: null,
  bettors: [],
  lastUpdate: 0,
  isPolling: false,
  pollInterval: 6000, // 6 seconds
  errors: 0,
  consecutiveErrors: 0
};

// Background polling function
async function pollContractState() {
  if (globalContractState.isPolling) {
    console.log('⏳ Contract polling already in progress, skipping...');
    return;
  }

  globalContractState.isPolling = true;
  
  try {
    console.log('🔄 Polling contract state and bettors...');
    
    // Fetch contract state and bettors concurrently
    const [contractState, allBettors] = await Promise.all([
      contractService.getContractState(),
      contractService.getAllBettors()
    ]);
    
    // Include simulated bettors in the bettors list
    const currentBettors = contractService.getCurrentBettors();
    // During simulation, always prioritize simulated bettors
    const finalBettors = (adminAutomation.isSimulationRunning && currentBettors.length > 0) ? 
      currentBettors : 
      (currentBettors.length > 0 ? currentBettors : allBettors);
    
    // Detect new bets and record them to stats
    const previousBettors = globalContractState.bettors || [];
    const newBets = finalBettors.filter(current => 
      !previousBettors.find(prev => 
        prev.fullAddress === current.fullAddress && 
        prev.amount === current.amount
      )
    );
    
    // Record new bets to stats
    if (newBets.length > 0) {
      console.log(`📊 Detected ${newBets.length} new bets, recording to stats...`);
      for (const bet of newBets) {
        try {
          await statsService.recordBet({
            address: bet.fullAddress,
            amount: bet.amount,
            roundNumber: adminAutomation.getStatus()?.currentRound?.roundNumber || null,
            username: bet.username || bet.displayName,
            timestamp: bet.timestamp || Date.now()
          });
          console.log(`✅ Recorded bet to stats: ${bet.username || bet.fullAddress} - ${bet.amount} TON`);
        } catch (error) {
          console.error(`❌ Failed to record bet for ${bet.username}:`, error.message);
        }
      }
    }
    
    // Update global state
    globalContractState.contractState = contractState;
    globalContractState.bettors = finalBettors;
    globalContractState.lastUpdate = Date.now();
    globalContractState.consecutiveErrors = 0; // Reset error counter on success
    
    console.log(`✅ Contract state updated: ${finalBettors.length} bettors (${currentBettors.length} simulated), jackpot: ${contractState.totalJackpot} TON`);
    
    // Get admin status for timer information
    const adminStatus = adminAutomation.getStatus();
    
    // Create enhanced contract state with all necessary data
    const enhancedContractState = {
      // Contract data
      ...contractState,
      totalJackpot: parseFloat((contractState.totalJackpot || 0).toFixed(3)),
      betCount: finalBettors.length,
      bettors: finalBettors,
      
      // Timer data from admin automation
      currentRound: adminStatus.currentRound,
      roundDuration: adminStatus.roundDuration,
      timer: {
        isActive: adminStatus.currentRound.isActive,
        timeRemaining: adminStatus.currentRound.timeRemaining,
        timeElapsed: adminStatus.currentRound.timeElapsed,
        roundNumber: adminStatus.currentRound.roundNumber
      },
      
      // Metadata
      timestamp: globalContractState.lastUpdate,
      source: 'contract-polling',
      
      // Handle inactive state - zero everything if not active
      ...(contractState.isActive === false && {
        totalJackpot: 0,
        betCount: 0,
        bettors: [],
        userBettorData: null
      })
    };
    
    console.log(`📡 Broadcasting enhanced contract state: active=${enhancedContractState.isActive}, jackpot=${enhancedContractState.totalJackpot}, bettors=${enhancedContractState.betCount}`);
    
    // Skip broadcasting during winner celebration to prevent interference
    if (global.isWinnerCelebrationActive) {
      console.log('🎬 Skipping contract state broadcast - winner celebration in progress');
      return;
    }
    
    // Broadcast complete state to all connected clients
    socketService.broadcastContractStateUpdate(enhancedContractState);
    
  } catch (error) {
    globalContractState.errors++;
    globalContractState.consecutiveErrors++;
    console.error('❌ Error polling contract state:', error);
    
    // If too many consecutive errors, increase polling interval
    if (globalContractState.consecutiveErrors >= 3) {
      globalContractState.pollInterval = Math.min(globalContractState.pollInterval * 1.5, 30000); // Max 30 seconds
      console.log(`⚠️ Too many errors, increasing poll interval to ${globalContractState.pollInterval}ms`);
    }
  } finally {
    globalContractState.isPolling = false;
  }
}

// Start background polling
function startContractPolling() {
  console.log(`🚀 Starting contract polling every ${globalContractState.pollInterval}ms`);
  
  // Initial poll
  pollContractState();
  
  // Set up interval
  const pollingInterval = setInterval(() => {
    pollContractState();
  }, globalContractState.pollInterval);
  
  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('⏹️ Stopping contract polling...');
    clearInterval(pollingInterval);
  });
  
  process.on('SIGINT', () => {
    console.log('⏹️ Stopping contract polling...');
    clearInterval(pollingInterval);
  });
  
  return pollingInterval;
}

// Get current cached contract state
function getCachedContractState() {
  return globalContractState.contractState;
}

// Get current cached bettors
function getCachedBettors() {
  return globalContractState.bettors;
}

// Get polling status
function getPollingStatus() {
  return {
    lastUpdate: globalContractState.lastUpdate,
    isPolling: globalContractState.isPolling,
    pollInterval: globalContractState.pollInterval,
    errors: globalContractState.errors,
    consecutiveErrors: globalContractState.consecutiveErrors,
    dataAge: Date.now() - globalContractState.lastUpdate,
    hasData: !!globalContractState.contractState
  };
}

// ======================
// EXISTING MIDDLEWARE AND SETUP
// ======================

// Serve React app for any non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💬 Socket.io: Ready for real-time chat`);
  console.log(`🎰 Contract API: Ready`);
  console.log(`🔧 Admin Service: Initializing...`);
  
  // Initialize services
  adminAutomation.initialize()
    .then(async () => {
      console.log('✅ Admin automation initialized');
      
      // Initialize stats service
      try {
        await statsService.initialize();
        console.log('✅ Stats service initialized');
      } catch (error) {
        console.warn('⚠️ Stats service initialization failed:', error.message);
      }
      
      // Inject socket service into admin automation for winner broadcasting
      adminAutomation.setSocketService(socketService);
      console.log('🔌 Socket service integrated with admin automation for winner broadcasting');
      
      // Start contract polling after admin automation is ready
      startContractPolling();
      console.log('📡 Contract state polling started');
    })
    .catch(error => {
      console.error('❌ Failed to initialize admin automation:', error);
      
      // Start polling anyway, even if admin automation fails
      startContractPolling();
      console.log('📡 Contract state polling started (admin automation failed)');
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⏹️ SIGTERM received, shutting down gracefully...');
  broadcastAutomationEvent('🔴 Server is shutting down for maintenance', 'system');
  adminAutomation.stop();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⏹️ SIGINT received, shutting down gracefully...');
  broadcastAutomationEvent('🔴 Server is shutting down', 'system');
  adminAutomation.stop();
  server.close(() => {
    process.exit(0);
  });
});

// Debug endpoint to show rate limiting status
app.get('/api/debug/rate-limits', (req, res) => {
  const now = Date.now();
  const limits = {};
  
  for (const [key, limiter] of rateLimiters.entries()) {
    const timeRemaining = Math.max(0, limiter.resetTime - now);
    limits[key] = {
      count: limiter.count,
      timeRemaining: Math.ceil(timeRemaining / 1000),
      resetTime: new Date(limiter.resetTime).toISOString()
    };
  }
  
  res.json({
    currentTime: new Date().toISOString(),
    rateLimiters: limits,
    totalLimiters: rateLimiters.size
  });
}); 

// ======================
// BETTING SIMULATION FUNCTIONS
// ======================

// Generate realistic player data
function generateSimulatedPlayer(index) {
  const names = [
    'CryptoKing', 'TONMaster', 'DiamondHands', 'MoonWalker', 'DeFiLegend',
    'BlockchainBoss', 'TokenTrader', 'CoinCollector', 'MetaGamer', 'Web3Warrior',
    'SatoshiFan', 'EtherExplorer', 'TONEnthusiast', 'CryptoPioneer', 'DigitalNomad'
  ];
  
  const randomName = names[Math.floor(Math.random() * names.length)];
  const playerNumber = Math.floor(Math.random() * 9999);
  
  return {
    address: `EQD${Math.random().toString(36).substr(2, 40)}`,
    username: `${randomName}${playerNumber}`,
    firstName: randomName,
    lastName: `Player${playerNumber}`,
    telegramId: 100000 + index,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomName}${playerNumber}`
  };
}

// Generate random bet amount
function generateBetAmount() {
  const amounts = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 5.0, 10.0];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

// Main simulation function
async function startBettingSimulation(playerCount = 3, sessionDuration = 30) {
  console.log(`🎮 Starting betting simulation: ${playerCount} players, ${sessionDuration}s duration`);
  
  const simulationId = `sim_${Date.now()}`;
  const players = [];
  const simulationResult = {
    id: simulationId,
    playerCount,
    sessionDuration,
    players: []
  };
  
  // Generate simulated players
  for (let i = 0; i < playerCount; i++) {
    players.push(generateSimulatedPlayer(i));
  }
  
  console.log(`👥 Generated ${players.length} simulated players`);
  
  // Register all players
  for (const player of players) {
    try {
      await userService.registerUser(player.address, {
        username: player.username,
        firstName: player.firstName,
        lastName: player.lastName,
        telegramId: player.telegramId
      });
      console.log(`✅ Registered player: ${player.username}`);
    } catch (error) {
      console.error(`❌ Failed to register player ${player.username}:`, error);
    }
  }
  
  // Clear any existing simulated bettors first
  contractService.clearSimulatedBettors();
  
  // Clear simulation flags
  global.winnerAlreadySelected = false;
  global.timerExpiryHandled = false;
  global.timerExpirySetup = false;
  
  // Broadcast simulation start
  broadcastAutomationEvent(`🎮 Simulation started: ${playerCount} players joining the game!`, 'simulation');
  
  // Step 1: Start a simulated round with proper timer
  console.log('🎲 Step 1: Starting simulated round...');
  const shortRoundDuration = Math.min(sessionDuration, 20); // Max 20 seconds for demo
  
  // Store original settings for restoration
  const originalRoundDuration = adminAutomation.roundDuration;
  const originalAutoStartEnabled = adminAutomation.autoStartEnabled;
  let originalPollInterval = globalContractState.pollInterval;
  
  adminAutomation.roundDuration = shortRoundDuration;
  adminAutomation.autoStartEnabled = false; // Disable auto-start during simulation
  
  // Add a simulation flag to prevent all admin automation interference
  adminAutomation.isSimulationRunning = true;
  global.adminAutomation = adminAutomation; // Make accessible to contract service
  global.isSimulationRunning = true; // Global flag for all systems
  
  // Also stop the admin automation check interval completely
  if (adminAutomation.checkInterval) {
    clearInterval(adminAutomation.checkInterval);
    adminAutomation.checkInterval = null;
    console.log('🛑 Admin automation check interval stopped');
  }
  
  // Also stop contract polling immediately to prevent interference
  globalContractState.isPolling = true;
  console.log('🛑 Contract polling stopped at simulation start');
  
  console.log('🚫 Auto-start disabled during simulation');
  console.log('🚫 Admin automation checks disabled during simulation');
  console.log('🎮 Simulation flag set on admin automation:', adminAutomation.isSimulationRunning);
  
  // Set up a simulated active round
  adminAutomation.currentRound = {
    startTime: Date.now(),
    endTime: null,
    roundNumber: (adminAutomation.currentRound?.roundNumber || 0) + 1,
    endingInProgress: false,
    lastEndAttempt: null,
    endAttempts: 0,
    winnerProcessed: false,
    emptyRoundCount: 0,
    lastResetTime: null
  };
  
  // Broadcast round start
  broadcastAutomationEvent(
    `🎲 SIMULATION ROUND #${adminAutomation.currentRound.roundNumber} STARTED! ` +
    `Duration: ${shortRoundDuration} seconds`, 
    'round'
  );
  
  // Broadcast initial timer update for simulation
  if (socketService) {
    const timerData = {
      timeRemaining: shortRoundDuration,
      timeElapsed: 0,
      roundNumber: adminAutomation.currentRound.roundNumber,
      isActive: true
    };
    socketService.broadcastTimerUpdate(timerData);
    console.log(`⏰ Initial timer broadcasted: ${shortRoundDuration}s remaining`);
  }
  
  // Step 2: Players join and place bets over time
  const bettingPhase = Math.floor(shortRoundDuration * 0.6); // 60% of time for betting
  const betInterval = Math.floor((bettingPhase * 1000) / playerCount); // Spread bets evenly
  
  console.log(`💰 Step 2: Betting phase: ${bettingPhase}s, interval: ${betInterval}ms`);
  
  // Schedule bets
  const betPromises = players.map((player, index) => {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const betAmount = generateBetAmount();
        
        try {
          // Add player to contract service cache first (so they show in roulette)
          const bettorData = {
            address: player.address,
            username: player.username,
            amount: betAmount,
            avatar: player.avatar
          };
          contractService.addSimulatedBettor(bettorData);
          
          // Simulate bet notification
          const betResponse = await fetch(`http://localhost:${PORT}/api/game/bet-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: betAmount,
              address: player.address,
              username: player.username,
              telegramId: player.telegramId,
              firstName: player.firstName,
              lastName: player.lastName
            })
          });
          
          if (betResponse.ok) {
            console.log(`🎰 ${player.username} placed bet: ${betAmount} TON`);
            
            // Broadcast player joining
            socketService.broadcastMessage({
              type: 'playerJoined',
              player: {
                address: player.address,
                username: player.username,
                avatar: player.avatar,
                bet: betAmount,
                isRealPlayer: true
              },
              simulation: true
            });
            
            // Broadcast updated bettors list
            const currentBettors = contractService.getCurrentBettors();
            socketService.broadcastMessage({
              type: 'bettorsUpdate',
              bettors: currentBettors,
              simulation: true
            });
            
          } else {
            console.error(`❌ Failed to place bet for ${player.username}`);
          }
        } catch (error) {
          console.error(`❌ Error placing bet for ${player.username}:`, error);
        }
        
        resolve();
      }, index * betInterval + Math.random() * 2000); // Add some randomness
    });
  });
  
  // Step 3: Wait for all bets to complete
  await Promise.all(betPromises);
  console.log('✅ Step 3: All simulated bets placed');
  
  // Prevent multiple timer expiry setups
  if (global.timerExpirySetup) {
    console.log('🚫 Timer expiry already setup, skipping duplicate setup');
    return simulationResult;
  }
  global.timerExpirySetup = true;
  
  // Step 4: Wait for the round timer to naturally expire, then force the waiting state
  const waitTime = Math.max(0, (shortRoundDuration - bettingPhase - 2) * 1000); // Leave 2 seconds buffer
  console.log(`⏳ Step 4: Waiting ${waitTime}ms for round timer to expire...`);
  
  setTimeout(async () => {
    // Prevent multiple timer expiry handling
    if (global.timerExpiryHandled) {
      console.log('🚫 Timer expiry already handled, skipping duplicate');
      return;
    }
    global.timerExpiryHandled = true;
    
    console.log('⏰ Step 5: Round timer expired - triggering waiting for winner state...');
    
    // Force the round timer to expire by setting start time in the past
    adminAutomation.currentRound.startTime = Date.now() - (shortRoundDuration * 1000);
    
          // Trigger the waiting for winner state
      if (socketService) {
        socketService.setWaitingForWinner(true);
        
        // Broadcast waiting for winner state
        socketService.broadcastMessage({
          type: 'waitingForWinner',
          isWaiting: true,
          roundNumber: adminAutomation.currentRound.roundNumber,
          message: 'Round ended - selecting winner...'
        });
        
        // Also broadcast game state update with waiting state
        socketService.broadcastMessage({
          type: 'gameStateUpdate',
          gameState: {
            isWaitingForWinner: true,
            isSpinning: true, // This should trigger the roulette to stop
            currentRound: {
              isActive: false,
              timeRemaining: 0,
              timeElapsed: shortRoundDuration,
              roundNumber: adminAutomation.currentRound.roundNumber
            },
            timeRemaining: 0,
            jackpotValue: 0
          }
        });
        
        console.log('🎯 Waiting for winner state broadcasted');
        console.log('🎯 Game state updated to waiting for winner');
      }
    
    // Wait 10 seconds for the roulette to fully stop, then select winner
    setTimeout(async () => {
      // Prevent multiple winner selections
      if (global.winnerAlreadySelected) {
        console.log('🚫 Winner already selected, skipping duplicate selection');
        return;
      }
      global.winnerAlreadySelected = true;
      
      console.log('🎯 Step 6: Selecting winner from simulated players...');
      
      // Select random winner from the simulated bettors
      const currentBettors = contractService.getCurrentBettors();
      
      if (currentBettors.length === 0) {
        console.error('❌ No bettors available for winner selection - simulation failed');
        broadcastAutomationEvent('❌ Simulation failed: No bettors available for winner selection', 'error');
        
        // Restore settings and exit
        adminAutomation.roundDuration = originalRoundDuration;
        adminAutomation.autoStartEnabled = originalAutoStartEnabled;
        adminAutomation.isSimulationRunning = false;
        globalContractState.isPolling = false;
        global.isWinnerCelebrationActive = false;
        return;
      }
      
      const winner = currentBettors[Math.floor(Math.random() * currentBettors.length)];
      const totalJackpot = currentBettors.reduce((sum, bettor) => sum + bettor.amount, 0);
      const prize = (totalJackpot * 0.95).toFixed(3); // 95% to winner
      
      console.log(`🎯 Selected winner: ${winner.username} from ${currentBettors.length} bettors`);
      
      const winnerData = {
        winner: winner.address,
        fullAddress: winner.fullAddress,
        winnerAddress: winner.fullAddress, // Add alternative field name
        winnerName: winner.username,
        prize: prize,
        username: winner.username,
        betAmount: winner.amount,
        timestamp: Date.now(),
        roundNumber: adminAutomation.currentRound.roundNumber,
        totalBettors: currentBettors.length,
        isSimulation: true,
        // Add more matching fields for frontend compatibility
        contractWinner: {
          winner: winner.address,
          fullAddress: winner.fullAddress,
          username: winner.username,
          winnerName: winner.username,
          prize: prize
        }
      };
      
      console.log(`🏆 Simulation winner selected: ${winner.username} wins ${prize} TON`);
      
      // Clear waiting for winner state
      if (socketService) {
        socketService.setWaitingForWinner(false);
        console.log('🎯 Cleared waiting for winner state - roulette should spin to winner');
      }
      
      // Completely stop contract polling during winner celebration to prevent interference
      originalPollInterval = globalContractState.pollInterval;
      globalContractState.isPolling = true; // Block all polling
      console.log('🛑 Contract polling completely stopped during winner celebration');
      
      // Set a flag to prevent any game state broadcasts during winner celebration
      global.isWinnerCelebrationActive = true;
      
      // Broadcast winner with proper data for roulette landing
      socketService.broadcastWinnerAnnouncement(winnerData);
      console.log('📡 Winner announcement broadcasted to frontend');
      console.log('🏆 Winner data sent:', JSON.stringify({
        winner: winnerData.winner,
        fullAddress: winnerData.fullAddress,
        username: winnerData.username,
        prize: winnerData.prize
      }, null, 2));
      console.log('🎬 Winner celebration period started - no game state updates will be sent');
      
      // Broadcast to chat
      broadcastAutomationEvent(
        `🏆 SIMULATION WINNER: ${winner.username} won ${prize} TON! 🎉`,
        'winner'
      );
      
              // Restore original settings
        adminAutomation.roundDuration = originalRoundDuration;
      
      // Keep winner state active for 20 seconds to allow animation to complete
      setTimeout(() => {
        console.log('⏳ Step 7: 20 second cooldown period after winner...');
        broadcastAutomationEvent('⏳ Cooldown period - winner celebration in progress', 'simulation');
        
        // IMPORTANT: Keep the round inactive during cooldown to prevent new round detection
        adminAutomation.currentRound = {
          startTime: null,
          endTime: Date.now(), // Mark as ended
          roundNumber: adminAutomation.currentRound.roundNumber,
          endingInProgress: false,
          lastEndAttempt: null,
          endAttempts: 0,
          winnerProcessed: true,
          emptyRoundCount: 0,
          lastResetTime: Date.now()
        };
        
        // Broadcast inactive state to prevent frontend from detecting new round
        if (socketService) {
          socketService.broadcastMessage({
            type: 'gameStateUpdate',
            gameState: {
              isWaitingForWinner: false,
              currentRound: {
                isActive: false,
                timeRemaining: 0,
                timeElapsed: shortRoundDuration,
                roundNumber: adminAutomation.currentRound.roundNumber
              },
              timeRemaining: 0,
              jackpotValue: 0,
              isActive: false
            }
          });
        }
        
        // Wait 30 seconds before allowing new rounds (longer to prevent interference)
        setTimeout(() => {
          console.log('✅ Step 8: Extended cooldown finished - cleaning up simulation');
          
          // Clear simulated bettors first
          contractService.clearSimulatedBettors();
          
          // Broadcast updated (empty) bettors list
          const currentBettors = contractService.getCurrentBettors();
          socketService.broadcastMessage({
            type: 'bettorsUpdate',
            bettors: currentBettors,
            simulation: false
          });
          
          // Reset round to completely inactive state
          adminAutomation.currentRound = {
            startTime: null,
            endTime: null,
            roundNumber: adminAutomation.currentRound.roundNumber,
            endingInProgress: false,
            lastEndAttempt: null,
            endAttempts: 0,
            winnerProcessed: false,
            emptyRoundCount: 0,
            lastResetTime: null
          };
          
          // Wait another 10 seconds before restoring automation
          setTimeout(() => {
            // Restore original polling interval and re-enable polling
            globalContractState.pollInterval = originalPollInterval;
            globalContractState.isPolling = false; // Re-enable polling
            console.log('▶️ Contract polling restored and re-enabled');
            
            // Clear winner celebration flag to allow game state updates
            global.isWinnerCelebrationActive = false;
            global.winnerAlreadySelected = false;
            global.timerExpiryHandled = false;
            global.timerExpirySetup = false;
            console.log('🎬 Winner celebration period ended - game state updates resumed');
            console.log('🔄 Simulation flags cleared');
            
            // Restore original auto-start setting
            adminAutomation.autoStartEnabled = originalAutoStartEnabled;
            adminAutomation.isSimulationRunning = false; // Re-enable admin automation
            global.isSimulationRunning = false; // Clear global flag
            
            // Restart the admin automation check interval
            if (!adminAutomation.checkInterval) {
              adminAutomation.checkInterval = setInterval(() => {
                adminAutomation.checkAndStartRound();
              }, 5000); // Check every 5 seconds
              console.log('▶️ Admin automation check interval restarted');
            }
            
            console.log('✅ Auto-start re-enabled after extended simulation cooldown');
            console.log('✅ Admin automation checks re-enabled');
            
            broadcastAutomationEvent('🎮 Simulation completed successfully! Ready for new round.', 'simulation');
            console.log('✅ Betting simulation completed - extended cooldown finished');
          }, 10000); // Additional 10 seconds
          
        }, 30000); // 30 second delay instead of 20
        
      }, 3000);
      
    }, 10000); // Wait 10 seconds for roulette to fully stop
    
  }, waitTime);
  
  return {
    simulationId,
    playerCount: players.length,
    sessionDuration,
    players: players.map(p => ({ username: p.username, address: p.address })),
    status: 'started'
  };
}

// Export for Vercel
module.exports = app; 