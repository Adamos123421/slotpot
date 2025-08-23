const { TonClient, Cell, Address, beginCell } = require('@ton/ton');
const userService = require('./userService');

class ContractService {
  constructor() {
    this.client = new TonClient({
      endpoint: "https://toncenter.com/api/v2/jsonRPC",
      apiKey: "cb6a181146fafbe2adc51d3a21d27341aa8a93cbf581e03a80e9e7203a3abd65"
    });
    
    this.contractAddress = Address.parse(
      "EQAO-eknIHULYsinQdpEb8oPVQy6eUXz0-zAPTKi1QTAJkjo"
    );
    
    // Rate limiting and caching
    this.lastRequestTime = 0;
    this.requestDelay = parseInt(process.env.REQUEST_DELAY) || 3000; // 3 seconds between requests
    this.contractStateCache = null;
    this.cacheExpiry = 15000; // Cache for 15 seconds
    this.lastCacheTime = 0;
    
    // Separate cache for bettors data (refreshes more frequently)
    this.bettorsCache = null;
    this.bettorsCacheExpiry = 10000; // Cache bettors for 10 seconds (shorter than contract state)
    this.lastBettorsCacheTime = 0;
    
        // Username dictionary - stores usernames by address when users place bets
    this.usernameDict = new Map();
    
    console.log('📄 Contract service initialized');
    console.log('🔗 Contract address:', this.contractAddress.toString());
    console.log(`🚦 Request delay: ${this.requestDelay}ms`);
  }

  // Save username and photo when user places a bet
  saveUsername(address, username, photoUrl = null) {
    if (!address || !username) return;
    const normalizedAddress = address.toString();
    this.usernameDict.set(normalizedAddress, {
      username: username,
      photoUrl: photoUrl
    });
    console.log(`💾 Saved user data for ${normalizedAddress.slice(0,8)}... -> username: ${username}, photo: ${photoUrl ? 'yes' : 'no'}`);
  }

  // Get username from our dictionary (no database calls)
  getUsername(address) {
    if (!address) return null;
    const normalizedAddress = address.toString();
    const userData = this.usernameDict.get(normalizedAddress);
    if (userData && userData.username) {
      console.log(`👤 Found username in dict: ${normalizedAddress.slice(0,8)}... -> ${userData.username}`);
      return userData.username;
    }
    // Fallback to address suffix if no username saved
    const fallbackUsername = `Player_${normalizedAddress.slice(-4)}`;
    console.log(`👤 No username in dict for ${normalizedAddress.slice(0,8)}..., using fallback: ${fallbackUsername}`);
    return fallbackUsername;
  }

  // Get photo URL from our dictionary
  getPhotoUrl(address) {
    if (!address) return null;
    const normalizedAddress = address.toString();
    const userData = this.usernameDict.get(normalizedAddress);
    if (userData && userData.photoUrl) {
      return userData.photoUrl;
    }
    // Fallback to robohash
    return `https://robohash.org/${normalizedAddress}.png?size=100x100`;
  }

  // Sleep function for delays
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Rate-limited request wrapper
  async makeRequest(requestFn, cacheKey = null) {
    // Check cache first
    if (cacheKey && this.contractStateCache && (Date.now() - this.lastCacheTime) < this.cacheExpiry) {
      console.log('📋 Using cached contract data');
      return this.contractStateCache;
    }

    // Ensure minimum delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      const waitTime = this.requestDelay - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms...`);
      await this.sleep(waitTime);
    }

    try {
      const result = await requestFn();
      this.lastRequestTime = Date.now();
      
      // Cache the result if cacheKey provided
      if (cacheKey) {
        this.contractStateCache = result;
        this.lastCacheTime = Date.now();
      }
      
      return result;
    } catch (error) {
      this.lastRequestTime = Date.now();
      
      if (error.message && (error.message.includes('429') || error.message.includes('Too Many Requests'))) {
        console.log('🚦 Rate limited by TON Center - extending delay');
        await this.sleep(5000); // Extra delay on rate limit
      }
      
      throw error;
    }
  }

  // Helper function to format TON amounts
  formatTonAmount(nanotons) {
    if (!nanotons || nanotons === 0) return '0';
    const tons = Number(nanotons) / 1000000000;
    return tons.toFixed(3);
  }

  // Helper function to format addresses
  formatAddress(address) {
    if (!address) return 'Unknown';
    const str = address.toString();
    return `${str.slice(0, 6)}...${str.slice(-6)}`;
  }

  // Get current contract state with caching
  async getContractState() {
    return this.makeRequest(async () => {
      console.log('📡 Fetching fresh contract state...');
      
      try {
        // Test contract availability first
        const contractAvailable = await this.testContractAvailability();
        if (!contractAvailable) {
          return this.getDefaultContractState('Contract not available or not deployed');
        }

        const [
          isActive,
          totalJackpot,
          betCount,
          lastWinner,
          lastPrizeAmount,
          contractBalance
        ] = await Promise.all([
          this.getJackpotActive(),
          this.getTotalJackpot(),
          this.getBetCount(),
          this.getLastWinner(),
          this.getLastPrizeAmount(),
          this.getContractBalance()
        ]);

        // Check if round just ended by comparing with previous state
        const previousState = this.contractStateCache;
        const roundJustEnded = previousState && 
          previousState.isActive === true && 
          isActive === false;

        if (roundJustEnded && lastWinner) {
          console.log('🎉 ROUND ENDED! Winner detected:', this.formatAddress(lastWinner));
          console.log('💰 Prize amount:', this.formatTonAmount(lastPrizeAmount), 'TON');
          
          // Broadcast winner announcement if available
          if (typeof global.broadcastToChat === 'function') {
            global.broadcastToChat(
              `🎉 WINNER: ${this.formatAddress(lastWinner)} won ${this.formatTonAmount(lastPrizeAmount)} TON!`,
              'winner'
            );
          }
        }

        return {
          isActive,
          totalJackpot: parseFloat(this.formatTonAmount(totalJackpot)),
          formattedJackpot: this.formatTonAmount(totalJackpot),
          betCount: Number(betCount),
          lastWinner: lastWinner ? this.formatAddress(lastWinner) : null,
          lastWinnerAddress: lastWinner ? lastWinner.toString() : null, // Full address for frontend
          lastPrizeAmount: parseFloat(this.formatTonAmount(lastPrizeAmount)),
          formattedLastPrize: this.formatTonAmount(lastPrizeAmount),
          contractBalance: parseFloat(this.formatTonAmount(contractBalance)),
          timestamp: Date.now(),
          error: null,
          // Winner detection flags
          roundJustEnded,
          hasWinner: !!lastWinner,
          winnerAnnouncement: roundJustEnded && lastWinner ? {
            winner: this.formatAddress(lastWinner),
            fullAddress: lastWinner.toString(),
            prize: this.formatTonAmount(lastPrizeAmount),
            // Calculate expected prize (95% of total jackpot)
            expectedPrize: this.formatTonAmount(totalJackpot * 95n / 100n),
            timestamp: Date.now()
          } : null
        };
      } catch (error) {
        console.error('Error fetching contract state:', error);
        return this.getDefaultContractState(error.message);
      }
    }, 'contractState');
  }

  // Test if contract is available and accessible
  async testContractAvailability() {
    try {
      await this.sleep(100);
      const state = await this.client.getContractState(this.contractAddress);
      
      // Check if contract exists and is initialized
      if (!state || state.state === 'uninitialized') {
        console.log('⚠️ Contract not deployed or uninitialized');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Contract availability test failed:', error);
      return false;
    }
  }

  // Return default state when contract is not available
  getDefaultContractState(errorMessage = 'Contract not available') {
    return {
      isActive: false,
      totalJackpot: 0,
      formattedJackpot: '0.000',
      betCount: 0,
      lastWinner: null,
      lastPrizeAmount: 0,
      formattedLastPrize: '0.000',
      contractBalance: 0,
      timestamp: Date.now(),
      error: errorMessage
    };
  }

  // Individual getter methods with delays
  async getJackpotActive() {
    await this.sleep(200); // Small delay between calls
    try {
      const result = await this.client.runMethod(this.contractAddress, 'isJackpotActive');
      return result.stack.readBoolean();
    } catch (error) {
      if (error.message.includes('exit_code')) {
        console.log('⚠️ Contract method isJackpotActive not available - assuming inactive');
        return false;
      }
      console.error('Error getting jackpot active status:', error);
      return false;
    }
  }

  async getTotalJackpot() {
    await this.sleep(200);
    try {
      const result = await this.client.runMethod(this.contractAddress, 'getTotalJackpot');
      const jackpot = result.stack.readBigNumber();
      console.log(`💰 Contract getTotalJackpot(): ${this.formatTonAmount(jackpot)} TON`);
      return jackpot;
    } catch (error) {
      if (error.message.includes('exit_code')) {
        console.log('⚠️ Contract method getTotalJackpot returned exit_code error - method may not be implemented or contract inactive');
        console.log('🔍 Error details:', error.message);
        return 0n;
      }
      console.error('❌ Error calling getTotalJackpot method:', error);
      return 0n;
    }
  }

  async getBetCount() {
    await this.sleep(200);
    try {
      const result = await this.client.runMethod(this.contractAddress, 'getBetCount');
      return result.stack.readBigNumber();
    } catch (error) {
      if (error.message.includes('exit_code')) {
        console.log('⚠️ Contract method getBetCount not available - returning 0');
        return 0n;
      }
      console.error('Error getting bet count:', error);
      return 0n;
    }
  }

  async getLastWinner() {
    await this.sleep(200);
    try {
      const result = await this.client.runMethod(this.contractAddress, 'getLastWinner');
      const address = result.stack.readAddressOpt();
      return address;
    } catch (error) {
      if (error.message.includes('exit_code')) {
        console.log('⚠️ Contract method getLastWinner not available - returning null');
        return null;
      }
      console.error('Error getting last winner:', error);
      return null;
    }
  }

  async getLastPrizeAmount() {
    await this.sleep(200);
    try {
      const result = await this.client.runMethod(this.contractAddress, 'getLastPrizeAmount');
      return result.stack.readBigNumber();
    } catch (error) {
      if (error.message.includes('exit_code')) {
        console.log('⚠️ Contract method getLastPrizeAmount not available - returning 0');
        return 0n;
      }
      console.error('Error getting last prize amount:', error);
      return 0n;
    }
  }

  async getContractBalance() {
    await this.sleep(200);
    try {
      const result = await this.client.runMethod(this.contractAddress, 'getBalance');
      return result.stack.readBigNumber();
    } catch (error) {
      if (error.message.includes('exit_code')) {
        console.log('⚠️ Contract method getBalance not available - trying fallback');
        try {
          const state = await this.client.getContractState(this.contractAddress);
          return state.balance || 0n;
        } catch (fallbackError) {
          console.log('⚠️ Contract balance not available - returning 0');
          return 0n;
        }
      }
      console.error('Error getting contract balance:', error);
      return 0n;
    }
  }

  // User-specific methods with rate limiting
  async getBettorAmount(bettorAddress) {
    return this.makeRequest(async () => {
      try {
        const address = typeof bettorAddress === 'string' ? 
          Address.parse(bettorAddress) : bettorAddress;
        
        // Create address cell using beginCell().storeAddress()
        const addressCell = beginCell().storeAddress(address).endCell();
        
        const result = await this.client.runMethod(
          this.contractAddress, 
          'getBettorAmount', 
          [{ type: 'slice', cell: addressCell }]
        );
        
        const amount = result.stack.readBigNumber();
        return parseFloat(this.formatTonAmount(amount));
      } catch (error) {
        console.error('Error getting bettor amount:', error);
        return 0;
      }
    });
  }

  async getWinningProbability(bettorAddress) {
    return this.makeRequest(async () => {
      try {
        const address = typeof bettorAddress === 'string' ? 
          Address.parse(bettorAddress) : bettorAddress;
        
        // Create address cell using beginCell().storeAddress()
        const addressCell = beginCell().storeAddress(address).endCell();
        
        const result = await this.client.runMethod(
          this.contractAddress, 
          'getWinningProbability', 
          [{ type: 'slice', cell: addressCell }]
        );
        
        const probability = result.stack.readBigNumber();
        return Number(probability) / 10000; // Convert from basis points to decimal
      } catch (error) {
        console.error('Error getting winning probability:', error);
        return 0;
      }
    });
  }

  async getFeePercentage() {
    return this.makeRequest(async () => {
      try {
        // The fee percentage is hardcoded in the contract as 500 (5%)
        // but we can try to get owner info to verify contract works
        const result = await this.client.runMethod(this.contractAddress, 'getOwner');
        // If owner call succeeds, return the known fee percentage
        return 500n; // 5%
      } catch (error) {
        console.error('Error getting contract owner (fee check):', error);
        return 500n; // Default 5%
      }
    });
  }

  async getAdminAddress() {
    return this.makeRequest(async () => {
      try {
        const result = await this.client.runMethod(this.contractAddress, 'getOwner');
        return result.stack.readAddress();
      } catch (error) {
        console.error('Error getting admin address:', error);
        return null;
      }
    });
  }

  // Build transaction for bet placement (for frontend) - no API calls needed
  buildBetTransaction(betAmount, fromAddress) {
    try {
      // Add 0.05 TON fee to the bet amount for the transaction
      const totalAmount = betAmount + 0.05;
      const totalNanotons = Math.floor(totalAmount * 1000000000);
      
      // Create PlaceBet message with correct op code (0x03)
      const body = beginCell()
        .storeUint(0x03, 32) // op code for PlaceBet
        .storeUint(Date.now(), 64) // query_id
        .endCell();
      
      return {
        validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
        messages: [
          {
            address: this.contractAddress.toString(),
            amount: totalNanotons.toString(),
            payload: body.toBoc().toString('base64') // Include the PlaceBet message
          }
        ]
      };
    } catch (error) {
      console.error('Error building bet transaction:', error);
      throw error;
    }
  }

  // Clear cache manually
  clearCache() {
    this.contractStateCache = null;
    this.lastCacheTime = 0;
    this.bettorsCache = null;
    this.lastBettorsCacheTime = 0;
    console.log('🗑️ Contract and bettors cache cleared');
  }

  // Add simulated bettor to the cache
  addSimulatedBettor(bettorData) {
    // Initialize bettors cache if it doesn't exist
    if (!this.bettorsCache) {
      this.bettorsCache = [];
      this.lastBettorsCacheTime = Date.now();
    }

    // Check if bettor already exists
    const existingIndex = this.bettorsCache.findIndex(
      bettor => bettor.fullAddress === bettorData.address
    );

    const formattedBettor = {
      address: this.formatAddress(bettorData.address),
      fullAddress: bettorData.address,
      amount: parseFloat(bettorData.amount),
      username: bettorData.username,
      displayName: bettorData.username,
      avatar: bettorData.avatar || `https://robohash.org/${bettorData.address}.png?size=100x100`,
      telegramPhotoUrl: bettorData.avatar,
      telegramId: bettorData.telegramId,
      firstName: bettorData.firstName,
      lastName: bettorData.lastName,
      timestamp: Date.now(),
      isSimulated: true
    };

    if (existingIndex >= 0) {
      // Update existing bettor
      this.bettorsCache[existingIndex] = formattedBettor;
      console.log(`🔄 Updated simulated bettor: ${bettorData.username} (${bettorData.amount} TON)`);
    } else {
      // Add new bettor
      this.bettorsCache.push(formattedBettor);
      console.log(`➕ Added simulated bettor: ${bettorData.username} (${bettorData.amount} TON)`);
    }

    // Extend cache time to keep simulated data visible
    this.lastBettorsCacheTime = Date.now();
    
    return formattedBettor;
  }

  // Get current bettors (including simulated ones)
  getCurrentBettors() {
    return this.bettorsCache || [];
  }

  // Remove all simulated bettors
  clearSimulatedBettors() {
    if (this.bettorsCache) {
      const originalCount = this.bettorsCache.length;
      this.bettorsCache = this.bettorsCache.filter(bettor => !bettor.isSimulated);
      const removedCount = originalCount - this.bettorsCache.length;
      console.log(`🗑️ Removed ${removedCount} simulated bettors`);
    }
  }

  // Get cache status
  getCacheStatus() {
    return {
      contractState: {
        hasCachedData: !!this.contractStateCache,
        cacheAge: this.contractStateCache ? Date.now() - this.lastCacheTime : 0,
        cacheExpiry: this.cacheExpiry
      },
      bettors: {
        hasCachedData: !!this.bettorsCache,
        cacheAge: this.bettorsCache ? Date.now() - this.lastBettorsCacheTime : 0,
        cacheExpiry: this.bettorsCacheExpiry
      },
      lastRequestTime: this.lastRequestTime,
      requestDelay: this.requestDelay
    };
  }

  // Get all current round bettors from contract using getAllBettors() with dedicated caching
  async getAllBettors() {
    // During simulation, always return cached simulated bettors without fetching from contract
    if (global.adminAutomation && global.adminAutomation.isSimulationRunning) {
      console.log('🎮 Simulation running - returning cached simulated bettors without contract fetch');
      return this.bettorsCache || [];
    }
    
    // Check bettors cache first
    if (this.bettorsCache && (Date.now() - this.lastBettorsCacheTime) < this.bettorsCacheExpiry) {
      console.log('📋 Using cached bettors data');
      return this.bettorsCache;
    }

    // Ensure minimum delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      const waitTime = this.requestDelay - timeSinceLastRequest;
      console.log(`⏳ Rate limiting bettors fetch: waiting ${waitTime}ms...`);
      await this.sleep(waitTime);
    }

    try {
      console.log('📡 Fetching fresh bettors from contract using getAllBettors()...');
      
      const result = await this.client.runMethod(this.contractAddress, 'getAllBettors');
      this.lastRequestTime = Date.now();
      
      console.log('🔍 getAllBettors raw result:', result);
      console.log('🔍 Stack size:', result.stack.remaining);
      
      // The contract returns a dictionary/map of Address -> Int (coins)
      const bettorsDict = result.stack.readCellOpt();
      
      console.log('🔍 Bettors dict:', bettorsDict ? 'exists' : 'null');
      if (bettorsDict) {
        console.log('🔍 Dict cell hex:', bettorsDict.toString('hex'));
      }
      
      if (!bettorsDict) {
        console.log('📊 No bettors dictionary returned from contract');
        const emptyResult = [];
        
        // Cache empty result
        this.bettorsCache = emptyResult;
        this.lastBettorsCacheTime = Date.now();
        
        return emptyResult;
      }
      
      // Additional safety check - if cell is too small, it's likely empty
      if (bettorsDict.bits.length < 8) {
        console.log('📊 Dictionary cell too small, treating as empty');
        const emptyResult = [];
        
        // Cache empty result
        this.bettorsCache = emptyResult;
        this.lastBettorsCacheTime = Date.now();
        
        return emptyResult;
      }

      // Parse the dictionary to extract address-amount pairs
      const bettors = [];
      
      try {
        // For TON dictionaries, we need to parse using Dictionary class
        const { Dictionary, Slice } = require('@ton/core');
        
        console.log('🔍 Attempting to parse dictionary...');
        console.log('🔍 Dict cell bits:', bettorsDict.bits.length);
        console.log('🔍 Dict cell refs:', bettorsDict.refs.length);
        
        // First, try to understand the cell structure
        const slice = bettorsDict.beginParse();
        console.log('🔍 Slice remaining bits:', slice.remainingBits);
        console.log('🔍 Slice remaining refs:', slice.remainingRefs);
        
        // Check if the dictionary is empty
        if (slice.remainingBits === 0 && slice.remainingRefs === 0) {
          console.log('📊 Dictionary appears to be empty (no bits or refs)');
          return bettors;
        }
        
        // The bet amounts are stored as regular Int, not Int as coins
        // So we need to parse as regular integers (nanotons) and format them properly
        const parsingApproaches = [
        

          { name: 'BigVarUint 4', type: Dictionary.Values.BigVarUint(4) }
        ];
        
        let parseSuccess = false;
        
        for (const approach of parsingApproaches) {
          try {
            console.log(`🔄 Trying parsing approach: ${approach.name}`);
            
            const bettorDict = Dictionary.loadDirect(
              Dictionary.Keys.Address(),
              approach.type,
              bettorsDict
            );
            
            console.log(`✅ ${approach.name} parsing successful, size:`, bettorDict.size);
            
            // Convert dictionary entries to array
            for (let [address, amount] of bettorDict) {
              const formattedAmount = parseFloat(this.formatTonAmount(amount));
              
              console.log(`🔍 Found bettor: ${address.toString()} -> ${formattedAmount} TON`);
              
              // Use our username dictionary instead of calling userService
              const username = this.getUsername(address.toString());
              const photoUrl = this.getPhotoUrl(address.toString());
              console.log(`👤 CONTRACT: Getting user data for ${address.toString()}: username="${username}", photo="${photoUrl ? 'yes' : 'no'}"`);
              bettors.push({
                address: this.formatAddress(address),
                fullAddress: address.toString(),
                amount: formattedAmount,
                username: username,
                displayName: username,
                avatar: photoUrl,
                telegramPhotoUrl: photoUrl,
                telegramId: null,
                firstName: '',
                lastName: '',
                timestamp: Date.now()
              });
            }
            
            parseSuccess = true;
            console.log(`📊 Successfully parsed ${bettors.length} bettors using ${approach.name}`);
            break;
            
          } catch (approachError) {
            console.log(`❌ ${approach.name} failed:`, approachError.message);
            continue;
          }
        }
        
        if (!parseSuccess) {
          console.log('⚠️ All parsing approaches failed, trying manual slice parsing...');
          
          // Manual parsing attempt - check if it's a simple cell structure
          try {
            const manualSlice = bettorsDict.beginParse();
            console.log('🔍 Manual parsing - available bits:', manualSlice.remainingBits);
            
            if (manualSlice.remainingBits >= 8) {
              // Try to read some basic data to understand structure
              const firstByte = manualSlice.preloadUint(8);
              console.log('🔍 First byte of dictionary:', firstByte.toString(16));
              
              // If first byte suggests empty dictionary, return empty
              if (firstByte === 0) {
                console.log('📊 Dictionary appears empty based on first byte');
                return bettors;
              }
            }
            
          } catch (manualError) {
            console.log('❌ Manual parsing also failed:', manualError.message);
          }
        }
        
      } catch (parseError) {
        console.error('Error parsing bettors dictionary:', parseError);
        console.log('🔍 Parse error details:', parseError.message);
        console.log('🔍 Parse error stack:', parseError.stack);
      }
      
      // Cache the result
      this.bettorsCache = bettors;
      this.lastBettorsCacheTime = Date.now();
      
      return bettors;
      
    } catch (error) {
      this.lastRequestTime = Date.now();
      
      if (error.message && (error.message.includes('429') || error.message.includes('Too Many Requests'))) {
        console.log('🚦 Rate limited by TON Center - extending delay');
        await this.sleep(5000); // Extra delay on rate limit
      }
      
      if (error.message.includes('exit_code')) {
        console.log('⚠️ Contract method getAllBettors not available - trying fallback approach');
        
        // Fallback: Try to reconstruct bettors from available data
        const fallbackBettors = await this.getFallbackBettors();
        
        // Cache the fallback result
        this.bettorsCache = fallbackBettors;
        this.lastBettorsCacheTime = Date.now();
        
        return fallbackBettors;
      }
      
      console.error('Error fetching all bettors from contract:', error);
      
      // Return cached result if available, otherwise empty array
      if (this.bettorsCache) {
        console.log('📋 Using stale bettors cache due to error');
        return this.bettorsCache;
      }
      
      return [];
    }
  }

  // Fallback method to get bettors when getAllBettors() is not available
  async getFallbackBettors() {
    console.log('🔄 Using fallback method to get bettors...');
    
    // Get local bettors from the server's memory
    const localBettors = typeof global.getCurrentBettors === 'function' ? 
      global.getCurrentBettors() : [];
    
    console.log(`📊 Found ${localBettors.length} local bettors`);
    
    // If no local bettors, try to reconstruct from contract state
    if (localBettors.length === 0) {
      console.log('📊 No local bettors found - trying to detect from contract state');
      
      // Try to get the bet count to see if there are any bettors
      const betCount = await this.getBetCount();
      console.log(`📊 Contract reports ${betCount} total bets`);
      
      if (Number(betCount) === 0) {
        console.log('📊 No bets in contract');
        return [];
      }
      
      // Since we can't get all bettors, return empty for now
      // The individual bettor data will still be available via userBettorData
      console.log('📊 Contract has bets but getAllBettors() not available - returning empty');
      return [];
    }
    
    // Validate each local bettor against contract
    const validatedBettors = [];
    
    for (const localBettor of localBettors) {
      try {
        const contractAmount = await this.getBettorAmount(localBettor.address);
        
        if (contractAmount > 0) {
          const userInfo = userService.getUserInfo(localBettor.address);
          validatedBettors.push({
            address: this.formatAddress(localBettor.address),
            fullAddress: localBettor.address,
            amount: contractAmount, // Use contract amount (more accurate)
            username: localBettor.username || userInfo.username,
            telegramPhotoUrl: userInfo.telegramPhotoUrl,
            timestamp: localBettor.timestamp || Date.now()
          });
          
          console.log(`✅ Validated bettor: ${localBettor.username} - ${contractAmount} TON`);
        } else {
          console.log(`❌ Local bettor ${localBettor.username} not found in contract`);
        }
      } catch (error) {
        console.error(`Error validating bettor ${localBettor.address}:`, error);
      }
    }
    
    console.log(`📊 Fallback found ${validatedBettors.length} validated bettors`);
    return validatedBettors;
  }

  // Legacy method for compatibility - now uses getAllBettors
  async getContractBettors() {
    return this.getAllBettors();
  }
}

// Create singleton instance
const contractService = new ContractService();

module.exports = contractService; 