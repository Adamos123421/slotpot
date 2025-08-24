// Console blocking utility
class ConsoleBlocker {
  constructor() {
    this.isBlocked = false;
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    };
  }

  // Block all console output
  block() {
    if (this.isBlocked) return;
    
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};
    console.debug = () => {};
    
    this.isBlocked = true;
    console.log('Console logs blocked');
  }

  // Restore console output
  restore() {
    if (!this.isBlocked) return;
    
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;
    
    this.isBlocked = false;
    console.log('Console logs restored');
  }

  // Block only specific methods
  blockSpecific(methods = ['log', 'warn', 'info', 'debug']) {
    methods.forEach(method => {
      if (console[method]) {
        console[method] = () => {};
      }
    });
  }

  // Allow only errors
  blockAllExceptErrors() {
    console.log = () => {};
    console.warn = () => {};
    console.info = () => {};
    console.debug = () => {};
    // Keep console.error active
  }
}

// Create singleton instance
const consoleBlocker = new ConsoleBlocker();

// Auto-block all console logs by default
consoleBlocker.blockAllExceptErrors();

// Export for manual control
export default consoleBlocker;

// Also export a simple function for quick blocking
export const blockConsole = () => consoleBlocker.block();
export const restoreConsole = () => consoleBlocker.restore();
export const blockExceptErrors = () => consoleBlocker.blockAllExceptErrors();
