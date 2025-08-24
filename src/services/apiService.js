const API_BASE_URL = 'https://advantage-discovered-abraham-incident.trycloudflare.com';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // Generic fetch wrapper with error handling
  async fetchApi(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      };

      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // GET request
  async get(endpoint) {
    return this.fetchApi(endpoint, { method: 'GET' });
  }

  // POST request
  async post(endpoint, data) {
    return this.fetchApi(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // PUT request
  async put(endpoint, data) {
    return this.fetchApi(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.fetchApi(endpoint, { method: 'DELETE' });
  }

  // Health check
  async getHealth() {
    return this.fetchApi('/api/health');
  }

  // Get chat messages and user count
  async getChatData() {
    return this.fetchApi('/api/chat/messages');
  }

  // Get server statistics (chat-focused, no game state needed)
  async getServerStats() {
    try {
      const [chatData, health] = await Promise.all([
        this.getChatData(),
        this.getHealth()
      ]);

      return {
        connectedUsers: chatData.totalUsers || 0,
        totalMessages: chatData.messages?.length || 0,
        recentMessages: chatData.messages || [],
        serverStatus: health.status,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Failed to get server stats:', error);
      return {
        connectedUsers: 0,
        totalMessages: 0,
        recentMessages: [],
        serverStatus: 'Error',
        lastUpdated: new Date(),
        error: error.message
      };
    }
  }

  // Check if server is reachable
  async isServerReachable() {
    try {
      await this.getHealth();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Create and export singleton instance
const apiService = new ApiService();
export default apiService; 