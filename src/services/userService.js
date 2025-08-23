import apiService from './apiService';

class UserService {
  constructor() {
    this.registeredUsers = new Set(); // Track which addresses we've already registered
  }

  // Register user with backend when they connect wallet
  async registerUser(address, userData, referralCode) {
    try {
      if (!address) {
        console.error('❌ Cannot register user: no address provided');
        return false;
      }

      // Don't register the same user multiple times in a session
      if (this.registeredUsers.has(address)) {
        console.log('👤 User already registered in this session:', address.slice(0, 8) + '...');
        return true;
      }

      console.log('👤 Registering user with backend:', userData);

      const response = await apiService.post('/user/register', {
        address: address,
        username: userData.username || userData.displayName || userData.shortName,
        firstName: userData.firstName,
        lastName: userData.lastName,
        telegramId: userData.id,
        referrer: referralCode || userData.referrer
      });

      if (response.success) {
        this.registeredUsers.add(address);
        console.log('✅ User registered successfully:', response.user.username);
        return response.user;
      } else {
        console.error('❌ Failed to register user:', response.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error registering user:', error);
      return false;
    }
  }

  // Update username for an address
  async updateUsername(address, username) {
    try {
      if (!address || !username) {
        console.error('❌ Cannot update username: missing address or username');
        return false;
      }

      console.log('👤 Updating username for:', address.slice(0, 8) + '...', '→', username);

      const response = await apiService.post('/user/update-username', {
        address: address,
        username: username
      });

      if (response.success) {
        console.log('✅ Username updated successfully:', response.user.username);
        return response.user;
      } else {
        console.error('❌ Failed to update username:', response.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error updating username:', error);
      return false;
    }
  }

  // Get user info from backend
  async getUserInfo(address) {
    try {
      if (!address) return null;

      const response = await apiService.get(`/user/${address}`);
      return response;
    } catch (error) {
      console.error('❌ Error getting user info:', error);
      return null;
    }
  }

  // Clear registration cache (for testing)
  clearCache() {
    this.registeredUsers.clear();
    console.log('🗑️ User registration cache cleared');
  }

  // Check if user is registered in this session
  isRegisteredInSession(address) {
    return this.registeredUsers.has(address);
  }
}

// Create singleton instance
const userService = new UserService();
export default userService; 