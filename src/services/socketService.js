import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.eventHandlers = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.gameState = {
      isWaitingForWinner: false,
      currentRound: null,
      timeRemaining: null,
      lastWinner: null,
      jackpotValue: 0,
      bettors: []
    };
  }

  connect() {
    // Prevent multiple connections - return if already connected or connecting
    if (this.socket?.connected || this.socket?.connecting) {
      console.log('🔌 Socket already connected/connecting, skipping duplicate connection');
      return;
    }

    const socketUrl = "http://localhost:5002";
    
    // Creating socket connection
    this.socket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      transports: ['websocket'],
      withCredentials: true
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      // Connected to socket server
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Request current game state on connect (with null check)
      if (this.socket && this.socket.connected) {
        this.socket.emit('getGameState');
      }
    });

    this.socket.on('disconnect', () => {
      // Disconnected from socket server
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.log('🚫 Connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('❌ Max reconnection attempts reached');
        this.socket.disconnect();
      }
    });

    // Game specific events
    this.socket.on('gameState', (data) => {
      this.gameState = {
        ...this.gameState,
        ...data
      };
      
      // If joining when timer is 0 and no winner yet, show waiting state
      if (data.timeRemaining === 0 && !data.lastWinner) {
        this.gameState.isWaitingForWinner = true;
        this.emit('waitingForWinner', true);
      }
      
      this.emit('gameState', this.gameState);
    });

    this.socket.on('winner', (data) => {
      console.log('🏆 Winner announced:', data);
      this.gameState.lastWinner = data;
      this.gameState.isWaitingForWinner = false;
      this.emit('winner', data);
    });

    // Handle direct winner announcements (reliable delivery)
    this.socket.on('winnerAnnouncement', (data) => {
      console.log('🎯 Direct winner announcement received:', data);
      this.gameState.lastWinner = data;
      this.gameState.isWaitingForWinner = false;
      this.gameState.winnerAnnouncement = data;
      this.emit('winnerAnnouncement', data);
    });

    this.socket.on('newBet', (data) => {
      // Update local game state with new bet
      if (!this.gameState.bettors.find(b => b.address === data.address)) {
        this.gameState.bettors.push(data);
      }
              this.gameState.jackpotValue += (parseFloat(data.amount) - 0.05); // Account for fee
      this.emit('newBet', data);
    });

    this.socket.on('timer', (data) => {
      // SAFETY: Ensure data exists and has required properties
      if (!data || typeof data !== 'object') {
        return;
      }
      
      // Extract timer properties safely
      const timeRemaining = typeof data.timeRemaining === 'number' ? data.timeRemaining : 0;
      const roundNumber = typeof data.roundNumber === 'number' ? data.roundNumber : this.gameState.currentRound;
      
      this.gameState.timeRemaining = timeRemaining;
      this.gameState.currentRound = roundNumber;
      
      // If timer hits 0 and we weren't already waiting, set waiting state
      if (timeRemaining === 0 && !this.gameState.isWaitingForWinner) {
        this.gameState.isWaitingForWinner = true;
        this.emit('waitingForWinner', true);
      }
      
      // Emit with safe data structure
      this.emit('timer', {
        timeRemaining,
        roundNumber,
        timeElapsed: typeof data.timeElapsed === 'number' ? data.timeElapsed : 0,
        isActive: Boolean(data.isActive)
      });
    });

    // Handle round reset
    this.socket.on('roundReset', (data) => {
      //console.log('🔄 Round reset:', data);
      
      // SAFETY: Ensure data exists
      const resetData = data || {};
      const timeRemaining = typeof resetData.timeRemaining === 'number' ? resetData.timeRemaining : 30;
      const roundNumber = typeof resetData.roundNumber === 'number' ? resetData.roundNumber : this.gameState.currentRound;
      
      this.gameState = {
        ...this.gameState,
        isWaitingForWinner: false,
        bettors: [],
        jackpotValue: 0,
        lastWinner: null,
        timeRemaining,
        currentRound: roundNumber
      };
      
      this.emit('roundReset', {
        timeRemaining,
        roundNumber,
        message: resetData.message || 'Round reset'
      });
    });

    // Handle new round start
    this.socket.on('newRound', (data) => {
      console.log('🎰 New round started:', data);
      
      // SAFETY: Ensure data exists and has required properties
      if (!data || typeof data !== 'object') {
        console.warn('⚠️ Invalid newRound data received:', data);
        return;
      }
      
      const timeRemaining = typeof data.timeRemaining === 'number' ? data.timeRemaining : 30;
      const roundNumber = typeof data.roundNumber === 'number' ? data.roundNumber : (this.gameState.currentRound + 1);
      
      this.gameState = {
        ...this.gameState,
        isWaitingForWinner: false,
        isPostWinnerLoading: false,
        bettors: [],
        jackpotValue: 0,
        lastWinner: null,
        currentRound: roundNumber,
        timeRemaining: timeRemaining
      };
      
      this.emit('newRound', {
        roundNumber,
        timeRemaining,
        isActive: true
      });
      this.emit('gameState', this.gameState);
    });

    // Handle comprehensive game data updates
    this.socket.on('fullGameUpdate', (data) => {
      //console.log('🎮 Full game data update:', data);
      this.gameState = {
        ...this.gameState,
        ...data
      };
      this.emit('fullGameUpdate', data);
      this.emit('gameState', this.gameState);
    });

    // Handle legacy bettors update for backwards compatibility
    this.socket.on('bettorsUpdate', (data) => {
      console.log('💰 Bettors update:', data);
      this.gameState.bettors = data.bettors || [];
      this.gameState.jackpotValue = data.totalPot || 0;
      this.gameState.betCount = data.betCount || 0;
      this.emit('bettorsUpdate', data);
      this.emit('gameState', this.gameState);
    });
  }

  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    
    const handlers = this.eventHandlers.get(event);
    
    // Prevent duplicate handlers
    if (handlers.has(callback)) {
      console.warn(`🔌 Duplicate listener for '${event}' event prevented`);
      return;
    }
    
    handlers.add(callback);
    console.log(`🔌 Added listener for '${event}' event (${handlers.size} total)`);
  }

  off(event, callback) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const wasDeleted = handlers.delete(callback);
      if (wasDeleted) {
        console.log(`🔌 Removed listener for '${event}' event (${handlers.size} remaining)`);
      }
    }
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`🚫 Error in ${event} handler:`, error);
          console.error('Data that caused error:', data);
        }
      });
    }
  }

  placeBet(betData) {
    if (!this.socket?.connected) {
      console.error('Cannot place bet: Socket not connected');
      return;
    }
    this.socket.emit('placeBet', betData);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  reconnect() {
    this.disconnect();
    this.connect();
  }

  getGameState() {
    return this.gameState;
  }

  isWaitingForWinner() {
    return this.gameState.isWaitingForWinner;
  }

  isPostWinnerLoading() {
    return this.gameState.isPostWinnerLoading || false;
  }

  getCurrentRound() {
    return this.gameState.currentRound;
  }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService; 