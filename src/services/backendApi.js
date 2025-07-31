// Backend API service for frontend
class BackendApiService {
  constructor() {
    this.baseUrl = "http://localhost:5002";
  }

  async fetchJson(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // CONTRACT API METHODS REMOVED - ALL DATA NOW COMES VIA SOCKET

  // Admin automation status
  async getAdminStatus() {
    return this.fetchJson('/api/admin/status');
  }

  // Update admin settings
  async updateAdminSettings(settings) {
    return this.fetchJson('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  }

  // Emergency admin controls (require admin key)
  async forceStartRound(adminKey) {
    return this.fetchJson('/api/admin/force-start', {
      method: 'POST',
      body: JSON.stringify({ adminKey })
    });
  }

  async forceEndRound(adminKey) {
    return this.fetchJson('/api/admin/force-end', {
      method: 'POST',
      body: JSON.stringify({ adminKey })
    });
  }

  // BETTOR API METHODS REMOVED - ALL DATA NOW COMES VIA SOCKET

  // Bet notification
  async notifyBetPlacement(betData) {
    return this.fetchJson('/api/game/bet-notification', {
      method: 'POST',
      body: JSON.stringify(betData)
    });
  }

  // Health check
  async getHealth() {
    return this.fetchJson('/api/health');
  }
}

// Create singleton instance
export const backendApi = new BackendApiService();

export default BackendApiService; 