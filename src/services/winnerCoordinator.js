class WinnerCoordinator {
  constructor() {
    this.isActive = false;
    this.listeners = new Set();
    this.currentWinnerTimestamp = null;
    this.currentWinnerData = null; // Store full winner data for duplicate detection
  }

  // Register a component that shows winner announcements
  register(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Set active state and notify all listeners
  setActive(isActive, winnerTimestamp = null, winnerData = null) {
    console.log(`🎯 WinnerCoordinator: Setting active state: ${isActive}, timestamp: ${winnerTimestamp}`);
    this.isActive = isActive;
    this.currentWinnerTimestamp = winnerTimestamp;
    this.currentWinnerData = winnerData;
    
    // Notify all registered components
    this.listeners.forEach(callback => {
      try {
        callback({ isActive, winnerTimestamp });
      } catch (error) {
        console.error('Error in winner coordinator callback:', error);
      }
    });
  }

  // Check if a winner announcement should be blocked
  shouldBlock(winnerTimestamp, winnerData = null) {
    const isAlreadyActive = this.isActive;
    const isDuplicateTimestamp = this.currentWinnerTimestamp === winnerTimestamp;
    
    // Also check for duplicate winner data (same winner in same round)
    let isDuplicateWinner = false;
    if (winnerData && this.currentWinnerData) {
      isDuplicateWinner = (
        (winnerData.winner === this.currentWinnerData.winner) &&
        (winnerData.roundNumber === this.currentWinnerData.roundNumber) &&
        (winnerData.prize === this.currentWinnerData.prize)
      );
    }
    
    const shouldBlock = isAlreadyActive || isDuplicateTimestamp || isDuplicateWinner;
    
    console.log(`🎯 WinnerCoordinator shouldBlock check:`, {
      isActive: isAlreadyActive,
      currentTimestamp: this.currentWinnerTimestamp,
      incomingTimestamp: winnerTimestamp,
      isDuplicateTimestamp,
      isDuplicateWinner,
      shouldBlock
    });
    
    return shouldBlock;
  }

  // Clear all states (for new rounds)
  reset() {
    console.log('🔄 WinnerCoordinator: Resetting all states');
    this.setActive(false, null, null);
  }

  // Get current state
  getState() {
    return {
      isActive: this.isActive,
      currentWinnerTimestamp: this.currentWinnerTimestamp
    };
  }
}

// Create singleton instance
const winnerCoordinator = new WinnerCoordinator();
export default winnerCoordinator; 