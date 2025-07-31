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
    // Allow connections from your local network
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
    /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/
  ].filter(Boolean),
  methods: ["GET", "POST"],
  credentials: true
};

// Initialize the socket service with the HTTP server
socketService.initialize(server);
console.log('🔌 Socket service initialized with HTTP server');

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

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
      username: username,
      firstName: firstName,
      lastName: lastName,
      telegramId: telegramId
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
    const { amount, address, username, telegramId, firstName, lastName } = req.body;
    
    // Register/update user with full Telegram data if available
    if (address && username) {
      const userData = {
        username,
        telegramId,
        firstName,
        lastName
      };
      await userService.registerUser(address, userData);
    }
    
    // Calculate net amount after 0.5 TON fee
    const netAmount = Math.max(0, parseFloat(amount) - 0.5);
    
    // Get the actual username from user service (or fallback)
    const actualUsername = address ? userService.getUsername(address) : 'Unknown Player';
    
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
      await userService.registerUser(data.address, userData);
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
    .then(() => {
      console.log('✅ Admin automation initialized');
      
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