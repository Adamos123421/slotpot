const { mnemonicToWalletKey } = require('@ton/crypto');
const { TonClient, WalletContractV4, internal, Cell, beginCell } = require('@ton/ton');
const contractService = require('./contractService');

class AdminService {
  constructor() {
    // Prevent multiple instances from running
    if (AdminService.instance) {
      console.log('⚠️ AdminService instance already exists - returning existing instance');
      return AdminService.instance;
    }
    
    this.client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: "cb6a181146fafbe2adc51d3a21d27341aa8a93cbf581e03a80e9e7203a3abd65"
    });
    
    // Initialize contract service reference
    this.contractService = contractService;
    
    this.adminMnemonic = "cabin flame border diary parent web extend stable hungry cabin alley cable bulk nasty learn toe recipe pluck memory twist wheel boost execute caution".split(' ').filter(word => word.trim() !== '') || [];
    this.adminWallet = null;
    this.isInitialized = false;
    this.autoStartEnabled = true;
    
    // Global process locking to prevent overlapping operations
    this.isProcessingRound = false;
    this.isStartingRound = false;
    this.isEndingRound = false;
    this.lastOperationTime = null;
    this.operationTimeout = 60000; // 60 seconds timeout
    
    // Transaction locking
    this.isProcessingTransaction = false;
    this.lastTransactionTime = null;
    this.transactionTimeout = 30000; // 30 seconds timeout
    this.pendingEndRound = false;
    
    // Round configuration
    this.roundDuration = parseInt(process.env.ROUND_DURATION) || 5 * 60; // 5 minutes in seconds
    this.requestDelay = parseInt(process.env.REQUEST_DELAY) || 3000;
    this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
    
    // Current round tracking
    this.currentRound = {
      startTime: null,
      endTime: null,
      roundNumber: 0,
      endingInProgress: false,
      lastEndAttempt: null, // Track when we last tried to end the round
      endAttempts: 0, // Track number of end attempts
      winnerProcessed: false,
      emptyRoundCount: 0,
      lastResetTime: null
    };
    
    // Statistics
    this.stats = {
      roundsStarted: 0,
      roundsEnded: 0,
      errors: 0,
      rateLimitErrors: 0,
      lastError: null,
      uptime: Date.now()
    };
    
    // Auto-start check interval
    this.checkInterval = null;
    
    // Socket service reference
    this.socketService = null;
    
    console.log('🔧 Admin Service created');
    console.log(`⏰ Round duration: ${this.roundDuration}s (${this.roundDuration/60} minutes)`);
    console.log(`🚦 Request delay: ${this.requestDelay}ms`);
    console.log(`🔑 Mnemonic words count: ${this.adminMnemonic.length}`);
    
    // Set singleton instance
    AdminService.instance = this;
  }

  // Set socket service reference
  setSocketService(socketService) {
    this.socketService = socketService;
    console.log('🔌 Socket service integrated with admin automation');
  }

  // Helper function to broadcast to chat
  broadcastToChat(message, type = 'system') {
    if (typeof global.broadcastToChat === 'function') {
      global.broadcastToChat(message, type);
    }
  }

  // Broadcast timer updates via socket
  broadcastTimerUpdate() {
    if (!this.socketService) return;
    
    const now = Date.now();
    const timeElapsed = this.currentRound.startTime ? 
      Math.floor((now - this.currentRound.startTime) / 1000) : 0;
    const timeRemaining = this.currentRound.startTime ? 
      Math.max(0, this.roundDuration - timeElapsed) : 0;
    
    const timerData = {
      timeRemaining,
      timeElapsed,
      roundNumber: this.currentRound.roundNumber,
      isActive: !!this.currentRound.startTime
    };
    
    this.socketService.broadcastTimerUpdate(timerData);
  }

  // Sleep function for delays
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async initialize() {
    try {
      console.log('🔄 Initializing admin service...');
      console.log(`🔑 Mnemonic check: ${this.adminMnemonic ? 'provided' : 'not provided'}`);
      console.log(`🔑 Mnemonic length: ${this.adminMnemonic ? this.adminMnemonic.length : 0}`);
      
      // Check if mnemonic is provided and valid
      if (!this.adminMnemonic || this.adminMnemonic.length === 0) {
        console.log('⚠️ No admin mnemonic provided - admin functions disabled');
        this.broadcastToChat('⚠️ Admin functions disabled - no mnemonic configured', 'warning');
        return false;
      }
      
      if (this.adminMnemonic.length !== 24) {
        console.log(`⚠️ Invalid admin mnemonic length: ${this.adminMnemonic.length} (expected 24) - admin functions disabled`);
        this.broadcastToChat('⚠️ Admin functions disabled - invalid mnemonic format', 'warning');
        return false;
      }

      console.log('✅ Mnemonic validation passed - creating wallet...');

      // Create wallet from mnemonic
      const keyPair = await mnemonicToWalletKey(this.adminMnemonic);
      this.adminWallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey
      });

      this.isInitialized = true;
      console.log('✅ Admin wallet initialized:', this.adminWallet.address.toString());
      this.broadcastToChat('✅ Admin service ready - automatic round management enabled', 'system');
      
      // Start auto-checking for rounds
      if (this.autoStartEnabled) {
        this.startAutoStartChecking();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize admin service:', error);
      this.stats.errors++;
      this.stats.lastError = error.message;
      this.broadcastToChat('❌ Admin service failed to initialize', 'error');
      return false;
    }
  }

  // Start automatic round checking
  startAutoStartChecking() {
    console.log('🔄 Starting auto-management...');
    
    // Initial check after 5 seconds
    setTimeout(() => {
      this.checkAndStartRound();
    }, 5000);
    
    // Then check every 5 seconds for responsive timer management
    this.checkInterval = setInterval(() => {
      this.checkAndStartRound();
    }, 5000); // Check every 5 seconds for timer precision
    
    console.log('✅ Auto-management enabled (every 5s)');
  }

  // Add transaction locking methods
  async acquireTransactionLock() {
    if (this.isProcessingTransaction) {
      // Check if previous transaction has timed out
      if (this.lastTransactionTime && (Date.now() - this.lastTransactionTime > this.transactionTimeout)) {
        console.log('⚠️ Previous transaction timed out - releasing lock');
        this.isProcessingTransaction = false;
      } else {
        return false;
      }
    }
    this.isProcessingTransaction = true;
    this.lastTransactionTime = Date.now();
    return true;
  }

  releaseTransactionLock() {
    this.isProcessingTransaction = false;
    this.lastTransactionTime = null;
  }

  // Add round operation locking methods
  async acquireRoundOperationLock(operation) {
    // Check if any round operation is in progress
    if (this.isProcessingRound || this.isStartingRound || this.isEndingRound) {
      // Check if operation has timed out
      if (this.lastOperationTime && (Date.now() - this.lastOperationTime > this.operationTimeout)) {
        console.log(`⚠️ Previous ${operation} operation timed out - releasing locks`);
        this.releaseAllRoundLocks();
      } else {
        console.log(`⏳ ${operation} blocked - another round operation in progress`);
        return false;
      }
    }
    
    // Acquire specific operation lock
    this.isProcessingRound = true;
    this.lastOperationTime = Date.now();
    
    if (operation === 'start') {
      this.isStartingRound = true;
      console.log('🔒 Acquired round START lock');
    } else if (operation === 'end') {
      this.isEndingRound = true;
      console.log('🔒 Acquired round END lock');
    }
    
    return true;
  }

  releaseRoundOperationLock(operation) {
    this.isProcessingRound = false;
    this.lastOperationTime = null;
    
    if (operation === 'start') {
      this.isStartingRound = false;
      console.log('🔓 Released round START lock');
    } else if (operation === 'end') {
      this.isEndingRound = false;
      console.log('🔓 Released round END lock');
    }
  }

  releaseAllRoundLocks() {
    this.isProcessingRound = false;
    this.isStartingRound = false;
    this.isEndingRound = false;
    this.lastOperationTime = null;
    console.log('🔓 Released all round locks');
  }

  // Modify checkAndStartRound to use transaction lock
  async checkAndStartRound() {
    try {
      // Skip all checks if simulation is running (check both flags)
      if (this.isSimulationRunning || global.isSimulationRunning) {
        console.log('🎮 Skipping admin automation - simulation is running (local:', this.isSimulationRunning, 'global:', global.isSimulationRunning, ')');
        return;
      }
      
      console.log('🔄 Admin automation check running - simulation flags: local:', this.isSimulationRunning, 'global:', global.isSimulationRunning);
      
      // Get current contract state
      const contractState = await this.contractService.getContractState();
      const currentBettors = await this.contractService.getAllBettors();
      
      if (contractState.isActive) {
        // Contract is active - check if we need to manage the timer
        if (this.currentRound.startTime) {
          const now = Date.now();
          const timeElapsed = Math.floor((now - this.currentRound.startTime) / 1000);
          const timeRemaining = Math.max(0, this.roundDuration - timeElapsed);
          
          // Check if timer has expired
          if (timeRemaining === 0) {
            // Timer expired - check if there are any bettors
            if (currentBettors.length === 0) {
              console.log('🔄 Round timer expired but no bettors found - restarting timer');
              
              // Reset the timer instead of ending the round
              await this.resetRoundTimer();
              
              this.broadcastToChat(
                `⏰ Round #${this.currentRound.roundNumber} extended - no bets placed yet! ` +
                `Timer reset to ${this.roundDuration} seconds.`, 
                'system'
              );
              
              return; // Exit early, don't process round ending
        } else {
              // There are bettors - proceed with ending the round
              console.log('⏰ Round timer expired with bettors - ending round automatically');
              
              // IMMEDIATELY notify frontend that we're waiting for winner selection
              console.log('🎯 Timer expired with bettors - setting waiting for winner state...');
              if (this.socketService) {
                this.socketService.setWaitingForWinner(true);
                
                // Broadcast waiting for winner state to frontend IMMEDIATELY
                this.socketService.broadcastMessage({
                  type: 'waitingForWinner',
                  isWaiting: true,
                  roundNumber: this.currentRound.roundNumber,
                  message: 'Round ended - selecting winner...'
                });
              }
              
              // CRITICAL: Check if we're already processing an end round transaction
              if (this.currentRound.endingInProgress || this.isProcessingTransaction) {
                console.log('⚠️ End round already in progress - skipping duplicate attempt');
                return;
              }
              
              // Acquire transaction lock to prevent multiple simultaneous end attempts
              if (!await this.acquireTransactionLock()) {
                console.log('⚠️ Transaction lock busy - skipping end round attempt');
                return;
              }
              
              // Mark as ending in progress
              this.currentRound.endingInProgress = true;
              
              try {
                await this.endCurrentRound();
        } finally {
                // Always release the lock and reset the flag
                this.releaseTransactionLock();
                this.currentRound.endingInProgress = false;
              }
              
              return;
        }
      } else {
            // Timer still running
            console.log(`✅ Round is active - ${timeRemaining}s remaining`);
            
            // Check if we have no bettors and significant time has passed (e.g., more than 50% of round duration)
            const halfRoundDuration = this.roundDuration / 2;
            if (currentBettors.length === 0 && timeElapsed > halfRoundDuration) {
              console.log(`🔄 No bettors after ${timeElapsed}s (>${halfRoundDuration}s) - resetting timer to encourage participation`);
              
              // Reset the timer to give more opportunity for bets
              await this.resetRoundTimer();
              
              this.broadcastToChat(
                `⏰ Round #${this.currentRound.roundNumber} reset - no bets after ${Math.floor(timeElapsed)}s! ` +
                `Fresh ${this.roundDuration}s timer started.`, 
                'system'
              );
              
              return;
            }
            
            // Broadcast timer updates every 5 seconds for smooth countdown
            if (timeElapsed % 5 === 0) {
              this.broadcastTimerUpdate();
            }
          }
        } else {
          // Don't start tracking a new round if we're still ending the previous one
          if (this.isProcessingTransaction || this.currentRound.endingInProgress) {
            console.log('⏳ Waiting for previous round to fully end before tracking new round');
            return;
          }
          
          console.log('✅ Round is active - starting local timer for externally started round');
          // Initialize local timer for externally started round
          this.currentRound.startTime = Date.now();
          this.currentRound.roundNumber++;
          this.currentRound.winnerProcessed = false; // Reset for new round
          this.currentRound.emptyRoundCount = 0; // Reset empty round counter
          this.currentRound.lastResetTime = null; // Reset last reset time
          this.roundDuration = 90; // Set to 30 seconds for externally started rounds
          
          console.log(`⏰ Local timer started - Round #${this.currentRound.roundNumber}`);
          console.log(`⏰ Round duration: ${this.roundDuration}s`);
          
          // Broadcast to chat about detected round
          this.broadcastToChat(
            `🎲 ACTIVE ROUND #${this.currentRound.roundNumber} DETECTED! ` +
            `Timer: ${this.roundDuration} seconds remaining!`, 
            'round'
          );
        }
      } else {
        // Contract is inactive - check if we should start a new round
        if (!this.isProcessingTransaction && this.autoStartEnabled && !this.currentRound.endingInProgress) {
          console.log('🚀 Contract inactive - starting new round...');
          
          // Acquire transaction lock for starting round
          if (await this.acquireTransactionLock()) {
            try {
              await this.startNewRound();
            } finally {
              this.releaseTransactionLock();
            }
          } else {
            console.log('⚠️ Transaction lock busy - skipping start round attempt');
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error checking round status:', error);
      this.stats.errors++;
      this.stats.lastError = error.message;
      
      // Always release locks on error
      this.releaseTransactionLock();
      this.currentRound.endingInProgress = false;
    }
  }

  async startNewRound() {
    try {
      console.log('🚀 Starting new jackpot round...');
      
      if (!this.isInitialized) {
        throw new Error('Admin service not initialized');
      }
      
      // Add delay before transaction
      await this.sleep(2000);
      
      // Check if contract is already active (externally started)
      const contractState = await this.contractService.getContractState();
      
          if (contractState.isActive) {
        console.log('⚠️ Contract is already active - cannot start new round');
        this.broadcastToChat('⚠️ Round already active - cannot start new round', 'warning');
        return;
      }
      
      // Build start jackpot message
      const message = this.buildStartJackpotMessage();
      
      // Send transaction
      const result = await this.sendAdminTransaction(message, '0.05'); // 0.05 TON for gas
      
      if (result.success) {
        // Wait for confirmation
        await this.waitForRoundConfirmation('start');
        
        // Initialize round tracking
      this.currentRound.startTime = Date.now();
      this.currentRound.roundNumber++;
      this.currentRound.winnerProcessed = false; // Reset for new round
      this.stats.roundsStarted++;
      
      console.log(`✅ Round #${this.currentRound.roundNumber} started`);
      console.log(`⏰ Round duration: ${this.roundDuration}s (${this.roundDuration/60} minutes)`);
      
      this.broadcastToChat(
        `🎰 NEW ROUND #${this.currentRound.roundNumber} STARTED! ` +
          `Duration: ${this.roundDuration/60} minutes. Place your bets!`, 
        'round'
      );
      
        // Start broadcasting timer updates
        this.broadcastTimerUpdate();
      } else {
        throw new Error('Failed to start round: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Error starting round:', error);
      this.stats.errors++;
      this.stats.lastError = error.message;
      this.broadcastToChat('❌ Failed to start new round', 'error');
      throw error;
    }
  }

  async endCurrentRound() {
    try {
      console.log('🏁 Ending current round...');
      
      // Double-check that we're not already ending a round
      if (this.currentRound.endingInProgress && this.currentRound.lastEndAttempt && 
          (Date.now() - this.currentRound.lastEndAttempt < 30000)) { // 30 second cooldown
        console.log('⚠️ End round attempt too recent - skipping to prevent spam');
      return;
    }
    
      // Mark the attempt time
      this.currentRound.lastEndAttempt = Date.now();
      this.currentRound.endAttempts = (this.currentRound.endAttempts || 0) + 1;
      
      // Check if we've tried too many times recently
      if (this.currentRound.endAttempts > 3) {
        console.log('⚠️ Too many end round attempts - backing off');
        this.broadcastToChat('⚠️ Multiple end round attempts detected - please check manually', 'warning');
        return;
      }
      
      // Check if round is actually active before ending
      const preEndState = await this.contractService.getContractState();
      
      if (!preEndState.isActive) {
        console.log('⚠️ Contract is not active - cannot end round');
        this.currentRound.endingInProgress = false;
        this.currentRound.endAttempts = 0; // Reset attempts since round is already ended
        return;
      }
      
      // Build end jackpot message
      const message = this.buildEndJackpotMessage();
      
      // Send transaction
      const result = await this.sendAdminTransaction(message, '0.05'); // 0.05 TON for gas
      
      if (result.success) {
        // Wait for confirmation
        await this.waitForRoundConfirmation('end');
        
        // Update round tracking
      this.currentRound.endTime = Date.now();
        this.currentRound.endingInProgress = false;
        this.currentRound.lastEndAttempt = null;
        this.currentRound.endAttempts = 0;
      this.stats.roundsEnded++;
      
      console.log(`✅ Round #${this.currentRound.roundNumber} ended - transaction sent`);
      
        this.broadcastToChat(
          `🏁 ROUND #${this.currentRound.roundNumber} ENDED! ` +
          `Winner selection in progress...`, 
          'round'
        );
        
        // Clear the start time to indicate round is no longer active
        this.currentRound.startTime = null;
        
        // Give frontend time to show loading state (waiting state already set in checkAndStartRound)
        await this.sleep(2000);
        
        // Start winner detection process
        console.log('🎯 Starting winner detection process...');
        await this.detectAndBroadcastWinner(preEndState);
        
      } else {
        throw new Error('Failed to end round: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Error ending round:', error);
      this.stats.errors++;
      this.stats.lastError = error.message;
      this.broadcastToChat('❌ Failed to end round', 'error');
      
      // Reset flags on error but keep attempt tracking for rate limiting
      this.currentRound.endingInProgress = false;
      
      throw error;
    }
  }

  buildStartJackpotMessage() {
    return beginCell()
      .storeUint(0x01, 32) // Start jackpot opcode
      .storeUint(Date.now(), 64) // query_id as timestamp
      .endCell();
  }

  buildEndJackpotMessage() {
    return beginCell()
      .storeUint(0x02, 32) // End jackpot opcode
      .storeUint(Date.now(), 64) // query_id as timestamp
      .endCell();
  }

  async sendAdminTransaction(message, amount) {
    try {
      console.log('📤 Sending admin transaction...');
      
      console.log(`💰 Transaction amount: ${amount} TON`);
      
      // Get wallet sequence number using runMethod (correct approach for TonClient)
      const seqnoResult = await this.client.runMethod(this.adminWallet.address, 'seqno');
      let seqno = seqnoResult.stack.readNumber();
      console.log(`🔢 Wallet seqno: ${seqno}`);
      
      // Get wallet key pair for signing
      const keyPair = await mnemonicToWalletKey(this.adminMnemonic);
      
      // Create transaction with proper structure
      let transfer = await this.adminWallet.createTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [internal({
          value: "0.05", // Use the amount directly (e.g., '0.05')
          to: this.contractService.contractAddress,
          body: message,
        })]
      });

      // Send transaction
      const result = await this.client.sendExternalMessage(this.adminWallet, transfer);
      
      console.log('✅ Transaction sent successfully');
      return { success: true, result };
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Wait for transaction confirmation by checking contract state
  async waitForRoundConfirmation(operation) {
    console.log(`⏳ Waiting for ${operation} confirmation...`);
    
    let confirmed = false;
    let attempts = 0;
    const maxAttempts = 15; // 15 attempts * 2 seconds = 30 seconds max wait
    
    while (!confirmed && attempts < maxAttempts) {
      try {
        await this.sleep(2000); // Wait 2 seconds before checking
        
        const contractState = await this.contractService.getContractState();
        
        if (operation === 'start' && contractState.isActive) {
          confirmed = true;
          console.log('✅ Start transaction confirmed - round is now active');
        } else if (operation === 'end' && !contractState.isActive) {
          confirmed = true;
          console.log('✅ End transaction confirmed - round is now inactive');
        } else {
          attempts++;
          console.log(`🔄 Checking ${operation} confirmation attempt ${attempts}/${maxAttempts}...`);
        }
      } catch (error) {
        console.warn(`⚠️ Error checking ${operation} confirmation:`, error);
        attempts++;
        await this.sleep(2000);
      }
    }
    
    if (!confirmed) {
      throw new Error(`${operation} transaction confirmation timeout - please check contract state manually`);
    }
    
    return true;
  }

  // Get current status
  getStatus() {
    const now = Date.now();
    const timeElapsed = this.currentRound.startTime ? 
      Math.floor((now - this.currentRound.startTime) / 1000) : 0;
    const timeRemaining = this.currentRound.startTime ? 
      Math.max(0, this.roundDuration - timeElapsed) : 0;
    
    return {
      isInitialized: this.isInitialized,
      isAutoManaged: this.autoStartEnabled,
      roundDuration: this.roundDuration,
      minBetsToEnd: this.minBetsToEnd,
      timerActive: !!this.currentRound.startTime,
      timeRemaining: Math.max(0, timeRemaining), // Ensure always a number
      currentRound: {
        isActive: !!this.currentRound.startTime,
        roundNumber: this.currentRound.roundNumber || 0,
        startTime: this.currentRound.startTime,
        endTime: this.currentRound.endTime,
        timeElapsed: Math.max(0, timeElapsed), // Ensure always a number
        timeRemaining: Math.max(0, timeRemaining), // Ensure always a number
        timerExpired: timeRemaining === 0 && !!this.currentRound.startTime,
        emptyRoundCount: this.currentRound.emptyRoundCount || 0,
        lastResetTime: this.currentRound.lastResetTime
      },
      timer: {
        isActive: !!this.currentRound.startTime,
        roundNumber: this.currentRound.roundNumber || 0,
        startTime: this.currentRound.startTime,
        endTime: this.currentRound.endTime,
        timeElapsed: Math.max(0, timeElapsed), // Ensure always a number
        timeRemaining: Math.max(0, timeRemaining), // Ensure always a number
        timerExpired: timeRemaining === 0 && !!this.currentRound.startTime,
        emptyRoundCount: this.currentRound.emptyRoundCount || 0,
        lastResetTime: this.currentRound.lastResetTime
      },
      stats: {
        ...this.stats,
        uptimeHours: Math.floor((Date.now() - this.stats.uptime) / (1000 * 60 * 60))
      },
      walletAddress: this.adminWallet ? this.adminWallet.address.toString() : null
    };
  }

  // Manual control methods (for emergency use)
  async forceStartRound() {
    console.log('🚨 Force starting round...');
    this.broadcastToChat('🚨 MANUAL: Starting new round!', 'system');
    await this.startNewRound();
  }

  async forceEndRound() {
    console.log('🚨 Force ending round...');
    this.broadcastToChat('🚨 MANUAL: Ending current round!', 'system');
    await this.endCurrentRound();
  }

  // Health check
  isHealthy() {
    return this.isInitialized && this.stats.errors < 10;
  }

  // Clear cache (for compatibility)
  clearCache() {
    console.log('🗑️ Cache cleared (no-op)');
  }

  // Placeholder methods for compatibility with existing server code
  stop() {
    console.log('⏹️ Stopping admin service...');
    this.autoStartEnabled = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏹️ Auto-start checking stopped');
    }
    
    // Release all locks
    this.releaseAllRoundLocks();
    this.releaseTransactionLock();
    
    // Clear singleton instance
    AdminService.instance = null;
    
    console.log('⏹️ Admin service stopped');
  }

  // New method: Enhanced winner detection and broadcasting
  async detectAndBroadcastWinner(contractState) {
    if (this.currentRound.winnerProcessed) {
      console.log('✅ Winner already processed for this round');
      return;
    }

    try {
      console.log('🎯 Starting winner detection process...');
      
      // Mark as processed to prevent duplicate processing
      this.currentRound.winnerProcessed = true;
      
      // Note: Waiting for winner state already set by caller, no need to set again
      
      // Get current bettors list from contract
      const currentBettors = typeof global.getCachedBettors === 'function' ? global.getCachedBettors() : [];
      console.log(`📊 Contract bettors count: ${currentBettors.length}`);
      
      // Wait a moment for contract to finalize winner selection
      await this.sleep(3000);
      
      // Get fresh contract state to detect winner
      const freshContractState = await this.contractService.getContractState();
      console.log('🔍 Fresh contract state:', {
        isActive: freshContractState.isActive,
        lastWinner: freshContractState.lastWinner,
        lastPrizeAmount: freshContractState.lastPrizeAmount
      });
      
      // Check if we have a winner from the contract
      if (freshContractState.lastWinner) {
        console.log('🎉 Winner found in contract:', freshContractState.lastWinner);
        
        // Find winner in current bettors list
        const winnerBettor = currentBettors.find(bettor => 
          bettor.fullAddress === freshContractState.lastWinnerAddress ||
          bettor.fullAddress === freshContractState.lastWinner ||
          bettor.fullAddress?.toLowerCase() === freshContractState.lastWinnerAddress?.toLowerCase() ||
          bettor.fullAddress?.toLowerCase() === freshContractState.lastWinner?.toLowerCase()
        );
        
        const winnerData = {
          winner: freshContractState.lastWinner,
          fullAddress: freshContractState.lastWinnerAddress || freshContractState.lastWinner,
          prize: freshContractState.formattedLastPrize || freshContractState.lastPrizeAmount?.toFixed(3) || '0.000',
          username: winnerBettor?.username || winnerBettor?.address || `Player_${freshContractState.lastWinner?.slice(-4)}`,
          betAmount: winnerBettor?.amount || 0,
          timestamp: Date.now(),
          roundNumber: this.currentRound.roundNumber,
          totalBettors: currentBettors.length
        };
        
        console.log('🏆 Broadcasting winner to all users:', winnerData);
        
        // Broadcast winner via socket to all connected users
        if (this.socketService) {
          this.socketService.broadcastWinnerAnnouncement(winnerData);
        }
        
        // Broadcast to chat
        this.broadcastToChat(
          `🎉 ROUND ${this.currentRound.roundNumber} WINNER: ${winnerData.username} won ${winnerData.prize} TON!`,
          'winner'
        );
        
        console.log('✅ Winner detection and broadcast complete');
        
        // Clear waiting for winner state after successful broadcast
        if (this.socketService) {
          this.socketService.setWaitingForWinner(false);
          
          // Broadcast that we're no longer waiting
          this.socketService.broadcastMessage({
            type: 'waitingForWinner',
            isWaiting: false,
            roundNumber: this.currentRound.roundNumber,
            message: 'Winner announced!'
          });
        }
        
      } else {
        console.log('⚠️ No winner found in contract');
        
        // Fallback: Select winner from current bettors if contract failed
        if (currentBettors.length > 0) {
          const fallbackWinner = this.selectFallbackWinner(currentBettors);
          console.log('🎲 Using fallback winner selection:', fallbackWinner?.username);
          
          if (fallbackWinner) {
            const totalPrize = this.calculateTotalPrize(currentBettors);
            const winnerData = {
              winner: fallbackWinner.fullAddress?.slice(0, 8) + '...' || fallbackWinner.address?.slice(0, 8) + '...',
              fullAddress: fallbackWinner.fullAddress || fallbackWinner.address,
              prize: totalPrize.toFixed(3),
              username: fallbackWinner.username || fallbackWinner.address,
              betAmount: fallbackWinner.amount || 0,
              timestamp: Date.now(),
              roundNumber: this.currentRound.roundNumber,
              totalBettors: currentBettors.length,
              isFallback: true
            };
            
            console.log('🎲 Broadcasting fallback winner:', winnerData);
            
            // Broadcast fallback winner
            if (this.socketService) {
              this.socketService.broadcastWinnerAnnouncement(winnerData);
            }
            
            this.broadcastToChat(
              `🎲 ROUND ${this.currentRound.roundNumber} WINNER (System): ${winnerData.username} won ${winnerData.prize} TON!`,
              'winner'
            );
            
            // Clear waiting for winner state after fallback winner broadcast
            if (this.socketService) {
              this.socketService.setWaitingForWinner(false);
              
              // Broadcast that we're no longer waiting
              this.socketService.broadcastMessage({
                type: 'waitingForWinner',
                isWaiting: false,
                roundNumber: this.currentRound.roundNumber,
                message: 'Fallback winner announced!'
              });
            }
          }
        } else {
          console.log('❌ No bettors found - cannot select winner');
          this.broadcastToChat('⚠️ Round ended with no valid bets', 'system');
          
          // Clear waiting for winner state when no bettors found
          if (this.socketService) {
            this.socketService.setWaitingForWinner(false);
            
            // Broadcast that we're no longer waiting
            this.socketService.broadcastMessage({
              type: 'waitingForWinner',
              isWaiting: false,
              roundNumber: this.currentRound.roundNumber,
              message: 'No bettors found'
            });
          }
        }
      }
      
      // Reset round state after winner processing
      this.currentRound.startTime = null;
      this.currentRound.endTime = Date.now();
      this.currentRound.endingInProgress = false;
      this.currentRound.lastEndAttempt = null;
      this.currentRound.endAttempts = 0;
      
      // Note: No need to clear bettors as they come from contract
      
    } catch (error) {
      console.error('❌ Error in winner detection:', error);
      this.stats.errors++;
      this.stats.lastError = error.message;
      
      // Ensure we clear the waiting state even on error
      if (this.socketService) {
        this.socketService.setWaitingForWinner(false);
      }
      
      // Reset round state on error
      this.currentRound.startTime = null;
      this.currentRound.endTime = Date.now();
      this.currentRound.endingInProgress = false;
      this.currentRound.winnerProcessed = true;
    }
  }

  // Fallback winner selection based on bet amounts (weighted random)
  selectFallbackWinner(bettors) {
    if (bettors.length === 0) return null;
    if (bettors.length === 1) return bettors[0];
    
    // Calculate weights based on bet amounts
    const totalWeight = bettors.reduce((sum, bettor) => sum + (bettor.amount || 0), 0);
    if (totalWeight === 0) return bettors[0]; // If no amounts, return first
    
    const random = Math.random() * totalWeight;
    
    let cumulativeWeight = 0;
    for (const bettor of bettors) {
      cumulativeWeight += (bettor.amount || 0);
      if (random <= cumulativeWeight) {
        return bettor;
      }
    }
    
    // Fallback to last bettor
    return bettors[bettors.length - 1];
  }

  // Calculate total prize from bettors (95% of total jackpot)
  calculateTotalPrize(bettors) {
    const totalJackpot = bettors.reduce((sum, bettor) => sum + (bettor.amount || 0), 0);
    return totalJackpot * 0.95; // Winner gets 95%, 5% is fee
  }

  // Test winner broadcast function (for demonstration)
  async testWinnerBroadcast() {
    const testWinnerData = {
      winner: 'EQD-Cb...TEST',
      fullAddress: 'EQD-Cb6rCY50fdpPOBr-e6K5ryWkE_p77rB6M-I0nHbTEST',
      prize: '1.234',
      username: 'TestPlayer',
      betAmount: 1.5,
      timestamp: Date.now(),
      roundNumber: this.currentRound.roundNumber || 999,
      totalBettors: 3,
      isTestBroadcast: true
    };

    console.log('🧪 Broadcasting test winner for demonstration');
    
    if (this.socketService) {
      this.socketService.broadcastWinnerAnnouncement(testWinnerData);
      this.broadcastToChat('🧪 Test winner broadcast sent!', 'system');
      return true;
    } else {
      console.error('❌ Socket service not available for test broadcast');
      return false;
    }
  }

  // New method to reset round timer without ending the round
  async resetRoundTimer() {
    // Skip round timer reset if simulation is running (check both flags)
    if (this.isSimulationRunning || global.isSimulationRunning) {
      console.log('🎮 Skipping round timer reset - simulation is running (local:', this.isSimulationRunning, 'global:', global.isSimulationRunning, ')');
      return;
    }
    
    console.log('🔄 Resetting round timer...');
    
    // Reset the start time to now
    this.currentRound.startTime = Date.now();
    
    // Increment empty round counter
    this.currentRound.emptyRoundCount = (this.currentRound.emptyRoundCount || 0) + 1;
    this.currentRound.lastResetTime = Date.now();
    
    // Broadcast the timer reset
    console.log(`📊 Round #${this.currentRound.roundNumber} timer reset (${this.currentRound.emptyRoundCount} empty rounds)`);
    console.log(`⏰ New timer started - full ${this.roundDuration}s duration`);
    
    // Broadcast timer update to all clients
    this.broadcastTimerUpdate();
    
    // Also broadcast round reset event via socket service
    if (this.socketService) {
      this.socketService.broadcastRoundReset({
        type: 'roundReset',
        roundNumber: this.currentRound.roundNumber,
        timeRemaining: this.roundDuration,
        emptyRoundCount: this.currentRound.emptyRoundCount,
        message: `Round #${this.currentRound.roundNumber} timer reset - no bets placed!`
      });
    }
  }
}

// Singleton instance
AdminService.instance = null;

// Create and export singleton instance
let adminServiceInstance = null;

function getAdminService() {
  if (!adminServiceInstance) {
    adminServiceInstance = new AdminService();
  }
  return adminServiceInstance;
}

module.exports = getAdminService(); 