// Import fetch for Node.js versions that don't have it built-in
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) {
    // Try to import node-fetch as fallback
    fetch = require('node-fetch');
  }
} catch (error) {
  console.warn('⚠️ Fetch not available - Telegram profile pictures will not work');
}

class UserService {
  constructor() {
    // In-memory storage for usernames (in production, this should be a database)
    this.usernames = new Map(); // address -> {username, lastSeen, firstName, lastName, telegramPhotoUrl}
    this.addressToUsernameCache = new Map(); // quick lookup
    this.photoUrlCache = new Map(); // telegramId -> photoUrl cache
    
    this.TELEGRAM_BOT_TOKEN = "8007770170:AAHZ39EJAG-UxUAxiKeAYBW-tQUDPr0S6rk";
    
    console.log('👤 User service initialized');
    if (!this.TELEGRAM_BOT_TOKEN) {
      console.warn('⚠️ TELEGRAM_BOT_TOKEN not configured - profile pictures will not be fetched');
    }
    if (!fetch) {
      console.warn('⚠️ Fetch not available - profile pictures will not be fetched');
    }
  }

  // Fetch Telegram profile picture URL
  async fetchTelegramProfilePicture(telegramId) {
    console.log(`🔍 Attempting to fetch profile picture for Telegram ID: ${telegramId}`);
    
    if (!this.TELEGRAM_BOT_TOKEN || !telegramId || !fetch) {
      console.log(`❌ Missing requirements: Bot token: ${!!this.TELEGRAM_BOT_TOKEN}, Telegram ID: ${!!telegramId}, Fetch: ${!!fetch}`);
      return null;
    }

    // Check cache first
    if (this.photoUrlCache.has(telegramId)) {
      const cachedUrl = this.photoUrlCache.get(telegramId);
      console.log(`💾 Using cached profile picture for ${telegramId}: ${cachedUrl ? 'found' : 'cached as null'}`);
      return cachedUrl;
    }

    // Known users with no accessible photos - skip API call for performance
    const knownNoPhotoUsers = []; // Removed 6503987555 since photos are now available
    if (knownNoPhotoUsers.includes(telegramId.toString())) {
      console.log(`⚡ Skipping API call for known no-photo user: ${telegramId}`);
      this.photoUrlCache.set(telegramId, null);
      setTimeout(() => {
        this.photoUrlCache.delete(telegramId);
      }, 60 * 60 * 1000); // Cache for 1 hour
      return null;
    }

    try {
      console.log(`📡 Making Bot API request for user ${telegramId}...`);
      const response = await fetch(`https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/getUserProfilePhotos?user_id=${telegramId}&limit=1`);
      const data = await response.json();

      console.log(`📋 Bot API response:`, {
        ok: data.ok,
        totalCount: data.result?.total_count || 0,
        hasPhotos: data.result?.photos?.length > 0
      });

      if (data.ok && data.result.total_count > 0) {
        const photo = data.result.photos[0][0]; // Get the smallest version of the first photo
        const fileId = photo.file_id;

        console.log(`🆔 Photo file ID: ${fileId}`);

        // Get file path
        const fileResponse = await fetch(`https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileData = await fileResponse.json();

        console.log(`📁 File response:`, {
          ok: fileData.ok,
          filePath: fileData.result?.file_path
        });

        if (fileData.ok) {
          const photoUrl = `https://api.telegram.org/file/bot${this.TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
          
          // Cache the result for 1 hour
          this.photoUrlCache.set(telegramId, photoUrl);
          setTimeout(() => {
            this.photoUrlCache.delete(telegramId);
          }, 60 * 60 * 1000); // 1 hour cache

          console.log(`✅ Successfully fetched profile picture for Telegram ID ${telegramId}: ${photoUrl}`);
          return photoUrl;
        } else {
          console.log(`❌ Failed to get file path:`, fileData);
        }
      } else {
        console.log(`❌ No profile photos found for user ${telegramId} or API error:`, data);
      }
    } catch (error) {
      console.error(`❌ Error fetching Telegram profile picture for ID ${telegramId}:`, error);
    }

    // Cache null result to avoid repeated failed requests
    this.photoUrlCache.set(telegramId, null);
    setTimeout(() => {
      this.photoUrlCache.delete(telegramId);
    }, 10 * 60 * 1000); // 10 minutes cache for failed requests

    console.log(`❌ Profile picture fetch failed for ${telegramId}, using fallback avatar`);
    return null;
  }

  // Register or update a user's information
  async registerUser(address, userData) {
    if (!address) {
      console.error('❌ Cannot register user: no address provided');
      return false;
    }

    const normalizedAddress = address.toString();
    
    console.log(`👤 Registering user for address ${normalizedAddress.slice(0, 8)}... with data:`, {
      username: userData.username,
      firstName: userData.firstName || userData.first_name,
      lastName: userData.lastName || userData.last_name,
      telegramId: userData.telegramId || userData.id,
      hasId: !!(userData.id || userData.telegramId)
    });
    
    // Extract data with fallbacks
    const username = userData.username || 
                    userData.first_name || 
                    userData.firstName || 
                    `Player_${normalizedAddress.slice(-4)}`;
    
    const telegramId = userData.id || userData.telegramId || null;
    
    console.log(`📋 Processed user data: username="${username}", telegramId="${telegramId}"`);
    
    // Use provided photo URL or fetch if we have Telegram ID
    let telegramPhotoUrl = userData.telegramPhotoUrl || null;
    if (!telegramPhotoUrl && telegramId) {
      try {
        console.log(`📸 USERSERVICE: Fetching profile picture for ${username} (ID: ${telegramId})`);
        telegramPhotoUrl = await this.fetchTelegramProfilePicture(telegramId);
      } catch (error) {
        console.error(`❌ Error fetching profile picture for ${username}:`, error);
      }
    } else if (telegramPhotoUrl) {
      console.log(`✅ USERSERVICE: Using pre-fetched profile picture for ${username}`);
    }
    
    const userInfo = {
      username: username,
      firstName: userData.first_name || userData.firstName || '',
      lastName: userData.last_name || userData.lastName || '',
      telegramId: telegramId,
      telegramPhotoUrl: telegramPhotoUrl,
      lastSeen: new Date(),
      registeredAt: this.usernames.has(normalizedAddress) ? 
                    this.usernames.get(normalizedAddress).registeredAt : 
                    new Date()
    };

    // Store the user info in memory
    this.usernames.set(normalizedAddress, userInfo);
    this.addressToUsernameCache.set(normalizedAddress, username);
    
    console.log(`💾 Stored user in memory: ${normalizedAddress.slice(0,8)}... -> ${username}`);
    console.log(`💾 Total users in memory: ${this.usernames.size}`);

    // Also register user in database for referral system
    try {
      const statsService = require('./statsService');
      if (statsService.isReady()) {
        await statsService.collections.players.updateOne(
          { address: normalizedAddress },
          {
            $set: { 
              usernameSnapshot: username,
              lastSeen: new Date()
            },
            $setOnInsert: { 
              firstSeen: new Date(),
              totalBets: 0,
              totalAmountBet: 0,
              totalWins: 0,
              totalPrize: 0,
              referralCount: 0,
              referralEarnings: 0
            }
          },
          { upsert: true }
        );
        console.log(`📊 User registered in database for referrals: ${normalizedAddress.slice(0, 8)}...`);
      } else {
        console.log(`⚠️ StatsService not ready, will register user when service becomes available`);
        // Store pending registration for when statsService becomes ready
        this.pendingRegistrations = this.pendingRegistrations || [];
        this.pendingRegistrations.push({ address: normalizedAddress, username });
      }
    } catch (error) {
      console.error(`❌ Failed to register user in database: ${error.message}`);
    }

    const photoStatus = telegramPhotoUrl ? '📸' : '👤';
    console.log(`${photoStatus} User registered/updated: ${username} (${normalizedAddress.slice(0, 8)}...)`);
    return true;
  }

  // Get username for an address
  getUsername(address) {
    if (!address) return null;
    
    const normalizedAddress = address.toString();
    const userInfo = this.usernames.get(normalizedAddress);
    
    if (userInfo) {
      // Update last seen
      userInfo.lastSeen = new Date();
      return userInfo.username;
    }
    
    // Return fallback username if not found
    return `Player ${this.formatAddress(normalizedAddress)}`;
  }

  // Get full user info for an address
  getUserInfo(address) {
    if (!address) return null;
    
    const normalizedAddress = address.toString();
    const userInfo = this.usernames.get(normalizedAddress);
    
    console.log(`👤 getUserInfo called for ${normalizedAddress}:`, userInfo ? 'found' : 'not found');
    console.log(`👤 All stored usernames:`, Array.from(this.usernames.entries()).map(([addr, info]) => `${addr.slice(0,8)}... -> ${info.username}`));
    
    if (userInfo) {
      // Update last seen
      userInfo.lastSeen = new Date();
      console.log(`👤 Returning user info for ${normalizedAddress}: username="${userInfo.username}"`);
      return { ...userInfo, address: normalizedAddress };
    }
    
    const fallbackUsername = `Player_${normalizedAddress.slice(-4)}`;
    console.log(`👤 No user info found for ${normalizedAddress}, using fallback: ${fallbackUsername}`);
    
    return {
      address: normalizedAddress,
      username: fallbackUsername,
      displayName: fallbackUsername,
      firstName: '',
      lastName: '',
      telegramId: null,
      telegramPhotoUrl: null,
      lastSeen: new Date(),
      registeredAt: new Date()
    };
  }

  // Format address for display (same as contractService)
  formatAddress(address) {
    if (!address) return 'Unknown';
    const addressStr = address.toString();
    return `${addressStr.slice(0, 6)}...${addressStr.slice(-6)}`;
  }

  // Get all registered users
  getAllUsers() {
    const users = [];
    for (const [address, userInfo] of this.usernames.entries()) {
      users.push({
        address,
        ...userInfo
      });
    }
    return users.sort((a, b) => b.lastSeen - a.lastSeen); // Sort by most recent
  }

  // Check if user is registered
  isRegistered(address) {
    if (!address) return false;
    return this.usernames.has(address.toString());
  }

  // Update user's last seen timestamp
  updateLastSeen(address) {
    if (!address) return;
    
    const normalizedAddress = address.toString();
    const userInfo = this.usernames.get(normalizedAddress);
    
    if (userInfo) {
      userInfo.lastSeen = new Date();
    }
  }

  // Clean up old users (optional - for memory management)
  cleanupOldUsers(daysOld = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    
    let cleaned = 0;
    for (const [address, userInfo] of this.usernames.entries()) {
      if (userInfo.lastSeen < cutoff) {
        this.usernames.delete(address);
        this.addressToUsernameCache.delete(address);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old user entries`);
    }
    
    return cleaned;
  }

  // Get statistics
  getStats() {
    return {
      totalUsers: this.usernames.size,
      recentUsers: Array.from(this.usernames.values())
        .filter(user => (new Date() - user.lastSeen) < 24 * 60 * 60 * 1000).length, // Last 24h
      oldestUser: Math.min(...Array.from(this.usernames.values()).map(u => u.registeredAt)),
      newestUser: Math.max(...Array.from(this.usernames.values()).map(u => u.registeredAt))
    };
  }

  // Clear all users (for testing)
  clearAll() {
    const count = this.usernames.size;
    this.usernames.clear();
    this.addressToUsernameCache.clear();
    console.log(`🗑️ Cleared ${count} user entries`);
    return count;
  }
  
  // Clear specific user (for testing)
  clearUser(address) {
    if (!address) return false;
    const normalizedAddress = address.toString();
    const hadUser = this.usernames.has(normalizedAddress);
    this.usernames.delete(normalizedAddress);
    this.addressToUsernameCache.delete(normalizedAddress);
    console.log(`🗑️ Cleared user ${normalizedAddress.slice(0,8)}... (had user: ${hadUser})`);
    return hadUser;
  }

  // Process pending registrations when statsService becomes ready
  async processPendingRegistrations() {
    if (!this.pendingRegistrations || this.pendingRegistrations.length === 0) {
      return;
    }

    try {
      const statsService = require('./statsService');
      if (!statsService.isReady()) {
        return;
      }

      console.log(`📊 Processing ${this.pendingRegistrations.length} pending registrations...`);
      
      for (const pending of this.pendingRegistrations) {
        try {
          await statsService.collections.players.updateOne(
            { address: pending.address },
            {
              $set: { 
                usernameSnapshot: pending.username,
                lastSeen: new Date()
              },
              $setOnInsert: { 
                firstSeen: new Date(),
                totalBets: 0,
                totalAmountBet: 0,
                totalWins: 0,
                totalPrize: 0,
                referralCount: 0,
                referralEarnings: 0
              }
            },
            { upsert: true }
          );
          console.log(`📊 Processed pending registration: ${pending.address.slice(0, 8)}...`);
        } catch (error) {
          console.error(`❌ Failed to process pending registration for ${pending.address.slice(0, 8)}...: ${error.message}`);
        }
      }
      
      this.pendingRegistrations = [];
      console.log(`✅ All pending registrations processed`);
    } catch (error) {
      console.error(`❌ Error processing pending registrations: ${error.message}`);
    }
  }
}

// Create singleton instance
const userService = new UserService();
module.exports = userService; 