const { Server } = require('socket.io');

class SocketService {
  constructor(port = 5002) {
    this.port = port;
    this.io = null;
    this.connectedClients = new Set();
    this.gameState = {
      isWaitingForWinner: false,
      currentRound: null,
      timeRemaining: null,
      lastWinner: null,
      jackpotValue: 0,
      bettors: [],
      roundStartTime: null,
      roundEndTime: null,
      isPostWinnerLoading: false,
      betCount: 0,
      isActive: true,
      totalJackpot: 0
    };
  }

  initialize(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    console.log('🔌 Socket.IO service initialized');
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('👤 New client connected:', socket.id);
      this.connectedClients.add(socket.id);

      // Send current game state immediately when client connects
      console.log('📤 Sending current game state to new client:', this.gameState);
      socket.emit('gameState', this.gameState);

      // Handle explicit game state request
      socket.on('getGameState', () => {
        console.log('📤 Client requested game state:', this.gameState);
        socket.emit('gameState', this.gameState);
      });

      // Handle client events
      socket.on('placeBet', (data) => {
        console.log('💰 Bet placed:', data);
        
        // Update game state
        const bettor = {
          address: data.address,
          amount: data.amount,
          timestamp: Date.now()
        };
        
        this.gameState.bettors.push(bettor);
        this.gameState.jackpotValue += (parseFloat(data.amount) - 0.5);
        
        this.broadcastNewBet(bettor);
      });

      socket.on('disconnect', () => {
        console.log('👋 Client disconnected:', socket.id);
        this.connectedClients.delete(socket.id);
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
        this.connectedClients.delete(socket.id);
      });
    });
  }

  updateGameState(newState) {
    this.gameState = {
      ...this.gameState,
      ...newState
    };
    this.broadcastGameState();
  }

  setWaitingForWinner(isWaiting) {
    this.gameState.isWaitingForWinner = isWaiting;
    this.broadcastGameState();
  }

  broadcastGameState() {
    if (!this.io) return;
    
    this.io.emit('gameState', this.gameState);
    console.log('🎮 Broadcasting game state to', this.connectedClients.size, 'clients', 
      this.gameState.winnerAnnouncement ? '(with winner announcement)' : '(no winner announcement)');
  }

  // Enhanced winner broadcast system
  broadcastWinnerAnnouncement(winnerData) {
    if (!this.io) {
      console.error('❌ Cannot broadcast winner: Socket.io not initialized');
      return false;
    }

    const timestamp = Date.now();
    const enhancedWinnerData = {
      ...winnerData,
      timestamp: winnerData.timestamp || timestamp,
      broadcastId: `winner_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      announcementType: 'official_winner'
    };

    console.log('🎉 WINNER BROADCAST INITIATED');
    console.log(`👥 Broadcasting to ${this.connectedClients.size} connected clients`);
    console.log('🏆 Winner Details:', {
      winner: enhancedWinnerData.winner,
      prize: enhancedWinnerData.prize,
      username: enhancedWinnerData.username,
      roundNumber: enhancedWinnerData.roundNumber
    });

    // 1. Update internal game state
    console.log('🔄 Updating game state - clearing isWaitingForWinner');
    this.gameState.lastWinner = enhancedWinnerData;
    this.gameState.isWaitingForWinner = false;
    this.gameState.isPostWinnerLoading = true;
    this.gameState.winnerAnnouncement = enhancedWinnerData;
    console.log('✅ Game state updated:', {
      isWaitingForWinner: this.gameState.isWaitingForWinner,
      hasLastWinner: !!this.gameState.lastWinner,
      isPostWinnerLoading: this.gameState.isPostWinnerLoading
    });

    // 2. Broadcast via primary winner event
    this.io.emit('winner', enhancedWinnerData);
    console.log('📡 Winner broadcast sent via "winner" event');

    // 3. Broadcast game state with winner data
    this.io.emit('gameState', this.gameState);
    console.log('📡 Game state broadcast with winner data');

    // 4. Send direct winner announcements to each client
    let successfulDeliveries = 0;
    this.connectedClients.forEach(clientId => {
      const socket = this.io.sockets.sockets.get(clientId);
      if (socket && socket.connected) {
        socket.emit('winnerAnnouncement', enhancedWinnerData);
        successfulDeliveries++;
      }
    });
    console.log(`📤 Direct announcements sent to ${successfulDeliveries}/${this.connectedClients.size} clients`);

    // 5. Broadcast celebration message to chat
    const celebrationMessage = {
      id: `winner_${timestamp}`,
      type: 'winner_celebration',
      message: `🎉 WINNER! ${enhancedWinnerData.username} won ${enhancedWinnerData.prize} TON! 🏆`,
      timestamp: new Date(),
      winnerData: enhancedWinnerData
    };
    this.io.emit('chat:message', celebrationMessage);
    console.log('🎊 Celebration message broadcast to chat');

    // 6. Broadcast notification banner
    const notificationBanner = {
      type: 'winner_banner',
      title: '🏆 WE HAVE A WINNER! 🏆',
      message: `${enhancedWinnerData.username} won ${enhancedWinnerData.prize} TON!`,
      duration: 8000,
      style: 'celebration',
      winnerData: enhancedWinnerData
    };
    this.io.emit('notification:banner', notificationBanner);
    console.log('🔔 Winner notification banner broadcast');

    // 7. Clear winner announcement from game state after 12 seconds (allow full display)
    setTimeout(() => {
      console.log('🔄 Clearing winnerAnnouncement from game state to prevent duplicates');
      this.gameState.winnerAnnouncement = null;
      console.log('✅ Winner announcement cleared from game state');
    }, 12000);

    // 8. Reset post-winner state after 12 seconds (allow full display)
    setTimeout(() => {
      if (this.gameState.isPostWinnerLoading) {
        console.log('🔄 Resetting post-winner loading state');
        this.gameState.isPostWinnerLoading = false;
        this.broadcastGameState();
        console.log('✅ Post-winner state reset completed');
      }
    }, 12000);

    console.log(`✅ WINNER BROADCAST COMPLETED - ${successfulDeliveries} clients notified`);
    return true;
  }

  // Legacy method for backward compatibility
  broadcastWinner(winnerData) {
    return this.broadcastWinnerAnnouncement(winnerData);
  }

  broadcastNewRound(roundData) {
    if (!this.io) return;
    
    console.log('🎰 Broadcasting new round start:', roundData);
    console.log('🔄 Clearing all winner states for new round');
    
    this.gameState = {
      ...this.gameState,
      isWaitingForWinner: false,
      isPostWinnerLoading: false,
      bettors: [],
      jackpotValue: 0,
      lastWinner: null,
      winnerAnnouncement: null,
      currentRound: roundData.roundNumber,
      timeRemaining: roundData.timeRemaining,
      roundStartTime: Date.now(),
      roundEndTime: null
    };
    
    this.io.emit('newRound', roundData);
    this.io.emit('gameState', this.gameState);
  }

  resetGameState() {
    this.gameState = {
      ...this.gameState,
      isWaitingForWinner: false,
      bettors: [],
      jackpotValue: 0,
      lastWinner: null,
      roundStartTime: Date.now()
    };
    
    this.io.emit('roundReset');
    this.broadcastGameState();
  }

  broadcastNewBet(betData) {
    if (!this.io) return;
    
    this.io.emit('newBet', betData);
    console.log('💰 Broadcasting new bet:', betData);
  }

  broadcastTimerUpdate(timerData) {
    if (!this.io) return;
    
    this.gameState.timeRemaining = timerData.timeRemaining;
    this.gameState.currentRound = timerData.roundNumber;
    
    let gameStateChanged = false;
    
    // Only set waiting for winner if timer is 0, we're not already waiting, 
    // and there's no existing winner (to prevent resetting during new rounds)
    if (timerData.timeRemaining === 0 && !this.gameState.isWaitingForWinner && !this.gameState.lastWinner) {
      console.log('⏰ Timer ended - setting waiting for winner state');
      this.gameState.isWaitingForWinner = true;
      this.gameState.roundEndTime = Date.now();
      gameStateChanged = true;
    }
    
    // If we're in a new round (timeRemaining > 0), clear waiting states
    if (timerData.timeRemaining > 0 && this.gameState.isWaitingForWinner) {
      console.log('⏰ New round detected - clearing waiting for winner state');
      this.gameState.isWaitingForWinner = false;
      this.gameState.isPostWinnerLoading = false;
      gameStateChanged = true;
    }
    
    this.io.emit('timer', timerData);
    
    // Broadcast game state if it changed
    if (gameStateChanged) {
      this.io.emit('gameState', this.gameState);
    }
  }

  broadcastFullGameUpdate(gameData) {
    if (!this.io) return;
    
    this.gameState = {
      ...this.gameState,
      jackpotValue: gameData.jackpotValue || this.gameState.jackpotValue,
      bettors: gameData.bettors || this.gameState.bettors,
      betCount: gameData.betCount || this.gameState.betCount,
      isActive: gameData.isActive !== undefined ? gameData.isActive : this.gameState.isActive,
      totalJackpot: gameData.totalJackpot || this.gameState.totalJackpot
    };
    
    console.log('🎮 Broadcasting full game update to', this.connectedClients.size, 'clients');
    this.io.emit('fullGameUpdate', this.gameState);
    this.io.emit('gameState', this.gameState);
  }

  broadcastChatMessage(message) {
    if (!this.io) return;
    
    this.io.emit('chat:message', message);
    console.log('💬 Broadcasting chat message to', this.connectedClients.size, 'clients');
  }

  broadcastBettorsUpdate(data) {
    if (!this.io) return;
    
    this.io.emit('bettorsUpdate', data);
    console.log('💰 Broadcasting bettors update to', this.connectedClients.size, 'clients');
  }

  broadcastContractStateUpdate(enhancedState) {
    if (!this.io) return;
    
    // Update internal game state with contract data
    this.gameState = {
      ...this.gameState,
      ...enhancedState,
      // Preserve existing socket-specific states
      isWaitingForWinner: this.gameState.isWaitingForWinner,
      isPostWinnerLoading: this.gameState.isPostWinnerLoading,
      lastWinner: this.gameState.lastWinner || enhancedState.lastWinner,
      winnerAnnouncement: this.gameState.winnerAnnouncement
    };
    
    // Broadcast via multiple events for compatibility
    this.io.emit('contractStateUpdate', enhancedState);
    this.io.emit('gameState', this.gameState);
    this.io.emit('fullGameUpdate', enhancedState);
    
    console.log(`📡 Broadcasting enhanced contract state to ${this.connectedClients.size} clients:`, {
      isActive: enhancedState.isActive,
      jackpot: enhancedState.totalJackpot,
      bettors: enhancedState.betCount,
      timeRemaining: enhancedState.timer?.timeRemaining
    });
  }

  setupSocketEventHandlers(eventHandlers) {
    if (!this.io) return;
    
    this.io.on('connection', (socket) => {
      console.log('👤 Additional client connected for chat:', socket.id);
      
      // Apply any additional event handlers passed from server.js
      if (eventHandlers) {
        eventHandlers(socket);
      }
    });
  }

  getConnectedClientsCount() {
    return this.connectedClients.size;
  }

  close() {
    if (this.io) {
      this.io.close();
      console.log('Socket service closed');
    }
  }

  // Broadcast general messages to all clients
  broadcastMessage(messageData) {
    if (!this.io) return;
    
    console.log(`📡 Broadcasting message to ${this.connectedClients.size} clients:`, messageData.type);
    
    // Emit the specific event type
    this.io.emit(messageData.type, messageData);
    
    // Also emit as a general message for components that listen to all messages
    this.io.emit('message', messageData);
  }

  // Handle round reset events
  broadcastRoundReset(resetData) {
    if (!this.io) return;
    
    console.log(`🔄 Broadcasting round reset to ${this.connectedClients.size} clients`);
    
    // Update game state
    this.gameState.timeRemaining = resetData.timeRemaining;
    this.gameState.currentRound = resetData.roundNumber;
    this.gameState.isWaitingForWinner = false; // Clear waiting state on reset
    this.gameState.isPostWinnerLoading = false;
    
    // Broadcast the reset event
    this.io.emit('roundReset', resetData);
    
    // Also update game state
    this.io.emit('gameState', this.gameState);
    
    // Broadcast timer update with new time
    this.io.emit('timer', {
      timeRemaining: resetData.timeRemaining,
      timeElapsed: 0,
      roundNumber: resetData.roundNumber,
      isActive: true
    });
  }
}

// Create singleton instance
const socketService = new SocketService();
module.exports = socketService; 