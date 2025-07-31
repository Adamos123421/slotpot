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
    
    this.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    
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
    if (!this.TELEGRAM_BOT_TOKEN || !telegramId || !fetch) {
      return null;
    }

    // Check cache first
    if (this.photoUrlCache.has(telegramId)) {
      return this.photoUrlCache.get(telegramId);
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/getUserProfilePhotos?user_id=${telegramId}&limit=1`);
      const data = await response.json();

      if (data.ok && data.result.total_count > 0) {
        const photo = data.result.photos[0][0]; // Get the smallest version of the first photo
        const fileId = photo.file_id;

        // Get file path
        const fileResponse = await fetch(`https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileData = await fileResponse.json();

        if (fileData.ok) {
          const photoUrl = `https://api.telegram.org/file/bot${this.TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
          
          // Cache the result for 1 hour
          this.photoUrlCache.set(telegramId, photoUrl);
          setTimeout(() => {
            this.photoUrlCache.delete(telegramId);
          }, 60 * 60 * 1000); // 1 hour cache

          console.log(`📸 Fetched profile picture for Telegram ID ${telegramId}`);
          return photoUrl;
        }
      }
    } catch (error) {
      console.error(`❌ Error fetching Telegram profile picture for ID ${telegramId}:`, error);
    }

    // Cache null result to avoid repeated failed requests
    this.photoUrlCache.set(telegramId, null);
    setTimeout(() => {
      this.photoUrlCache.delete(telegramId);
    }, 10 * 60 * 1000); // 10 minutes cache for failed requests

    return null;
  }

  // Register or update a user's information
  async registerUser(address, userData) {
    if (!address) {
      console.error('❌ Cannot register user: no address provided');
      return false;
    }

    const normalizedAddress = address.toString();
    
    // Extract data with fallbacks
    const username = userData.username || 
                    userData.first_name || 
                    userData.firstName || 
                    `Player_${normalizedAddress.slice(-4)}`;
    
    const telegramId = userData.id || userData.telegramId || null;
    
    // Fetch profile picture if we have Telegram ID
    let telegramPhotoUrl = null;
    if (telegramId) {
      try {
        telegramPhotoUrl = await this.fetchTelegramProfilePicture(telegramId);
      } catch (error) {
        console.error(`❌ Error fetching profile picture for ${username}:`, error);
      }
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

    // Store the user info
    this.usernames.set(normalizedAddress, userInfo);
    this.addressToUsernameCache.set(normalizedAddress, username);

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
    
    if (userInfo) {
      // Update last seen
      userInfo.lastSeen = new Date();
      return { ...userInfo, address: normalizedAddress };
    }
    
    return {
      address: normalizedAddress,
      username: `Player ${this.formatAddress(normalizedAddress)}`,
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
}

// Create singleton instance
const userService = new UserService();
module.exports = userService; 