class SoundService {
  constructor() {
    this.sounds = {};
    this.isEnabled = true;
    this.volume = 0.7;
    this.isLoaded = false;
    this.audioContext = null;
    this.audioUnlocked = false;
    this.userInteractionReceived = false;
    
    // Sound definitions with their corresponding files
    this.soundFiles = {
      bet: '/bet.wav',
      countdown: '/decompte-temps.wav',
      analyze: '/annalyse-bet.wav',
      spin: '/tic-roue.wav',
      launch: '/lancement-tirage-v3.wav',
      launchV2: '/lancement-tirage-v2.wav',
      launchV1: '/lancement-tirage.wav',
      winner: '/gagnant.wav'
    };
    
    this.init();
    this.setupUserInteractionHandlers();
  }
  
  setupUserInteractionHandlers() {
    const unlockAudio = async () => {
      if (this.audioUnlocked) return;
      
      console.log('🔓 Attempting to unlock audio after user interaction');
      
      try {
        // Create audio context if it doesn't exist
        if (!this.audioContext) {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
          console.log('🎵 Audio context resumed');
        }
        
        // Test audio playback
        await this.testAudioPlayback();
        
        this.audioUnlocked = true;
        this.userInteractionReceived = true;
        console.log('🔊 Audio successfully unlocked');
        
        // Remove event listeners after successful unlock
        this.removeUserInteractionHandlers();
        
      } catch (error) {
        console.warn('🔇 Failed to unlock audio:', error);
      }
    };
    
    // List of events that can unlock audio
    const events = ['touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown'];
    
    this.unlockAudio = unlockAudio;
    this.unlockEvents = events;
    
    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, unlockAudio, { once: false, passive: true });
    });
    
    // Special handling for Telegram Mini App
    if (window.Telegram?.WebApp) {
      // Try to unlock on Telegram WebApp ready
      window.Telegram.WebApp.ready(() => {
        setTimeout(unlockAudio, 100);
      });
      
      // Try to unlock when app becomes visible
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !this.audioUnlocked) {
          setTimeout(unlockAudio, 100);
        }
      });
    }
  }
  
  removeUserInteractionHandlers() {
    if (this.unlockEvents && this.unlockAudio) {
      this.unlockEvents.forEach(event => {
        document.removeEventListener(event, this.unlockAudio);
      });
    }
  }
  
  async testAudioPlayback() {
    return new Promise((resolve, reject) => {
      // Try to play a very short, silent audio to test if audio is unlocked
      const testAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAPA/');
      testAudio.volume = 0;
      
      const playPromise = testAudio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('🎵 Test audio playback successful');
            resolve();
          })
          .catch((error) => {
            console.warn('🔇 Test audio playback failed:', error);
            reject(error);
          });
      } else {
        resolve();
      }
    });
  }
  
  async init() {
    try {
      await this.loadSounds();
      this.isLoaded = true;
      console.log('🔊 Sound service initialized successfully');
    } catch (error) {
      console.warn('🔇 Sound service failed to initialize:', error);
    }
  }
  
  async loadSounds() {
    const loadPromises = Object.entries(this.soundFiles).map(async ([key, path]) => {
      try {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.volume = this.volume;
        
        return new Promise((resolve, reject) => {
          audio.addEventListener('canplaythrough', () => {
            this.sounds[key] = audio;
            resolve();
          });
          
          audio.addEventListener('error', (e) => {
            console.warn(`Failed to load sound: ${key} (${path})`, e);
            reject(e);
          });
          
          // Start loading
          audio.load();
        });
      } catch (error) {
        console.warn(`Error loading sound ${key}:`, error);
      }
    });
    
    // Wait for all sounds to load (or fail)
    await Promise.allSettled(loadPromises);
  }
  
  async ensureAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (error) {
        console.warn('Failed to create audio context:', error);
        return false;
      }
    }
    
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('🎵 Audio context resumed before playback');
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
        return false;
      }
    }
    
    return true;
  }
  
  async play(soundName, options = {}) {
    if (!this.isEnabled || !this.isLoaded) {
      return;
    }
    
    // Ensure audio context is ready
    await this.ensureAudioContext();
    
    const sound = this.sounds[soundName];
    if (!sound) {
      console.warn(`Sound not found: ${soundName}`);
      return;
    }
    
    try {
      // Clone the audio to allow multiple simultaneous plays
      const audioClone = sound.cloneNode();
      audioClone.volume = options.volume !== undefined ? options.volume : this.volume;
      
      // Play the sound
      const playPromise = audioClone.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name === 'NotAllowedError') {
            console.warn(`🔇 Audio play blocked by browser policy for ${soundName}. User interaction required.`);
            // Try to unlock audio on next user interaction
            if (!this.audioUnlocked) {
              this.setupUserInteractionHandlers();
            }
          } else {
            console.warn(`Error playing sound ${soundName}:`, error);
          }
        });
      }
      
      // Clean up after playing
      audioClone.addEventListener('ended', () => {
        audioClone.remove();
      });
      
      return audioClone;
    } catch (error) {
      console.warn(`Error playing sound ${soundName}:`, error);
    }
  }
  
  // Specific game sound methods
  playBet() {
    this.play('bet', { volume: 0.5 });
  }
  
  playCountdown() {
    this.play('countdown', { volume: 0.6 });
  }
  
  playAnalyze() {
    this.play('analyze', { volume: 0.7 });
  }
  
  playSpin() {
    this.play('spin', { volume: 0.3 });
  }
  
  // Play spin with variable volume for dramatic effect
  playSpinWithVolume(volume = 0.3) {
    this.play('spin', { volume });
  }
  
  playLaunch() {
    // Use the latest version by default
    this.play('launch', { volume: 0.8 });
  }
  
  playWinner() {
    this.play('winner', { volume: 0.9 });
  }
  
  // Volume and settings control
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    Object.values(this.sounds).forEach(sound => {
      sound.volume = this.volume;
    });
  }
  
  toggle() {
    this.isEnabled = !this.isEnabled;
    
    // If enabling and not unlocked, try to unlock audio
    if (this.isEnabled && !this.audioUnlocked) {
      this.setupUserInteractionHandlers();
    }
    
    return this.isEnabled;
  }
  
  enable() {
    this.isEnabled = true;
    
    // Try to unlock audio when enabling
    if (!this.audioUnlocked) {
      this.setupUserInteractionHandlers();
    }
  }
  
  disable() {
    this.isEnabled = false;
  }
  
  // Stop all sounds
  stopAll() {
    Object.values(this.sounds).forEach(sound => {
      sound.pause();
      sound.currentTime = 0;
    });
  }
  
  // Check if sounds are loaded
  isReady() {
    return this.isLoaded;
  }
  
  // Check if audio is unlocked and ready to play
  isUnlocked() {
    return this.audioUnlocked;
  }
  
  // Get audio context state
  getAudioContextState() {
    return this.audioContext ? this.audioContext.state : 'unavailable';
  }
  
  // Get available sounds
  getAvailableSounds() {
    return Object.keys(this.soundFiles);
  }
  
  // Force audio unlock (call this from user interaction handlers)
  async forceUnlock() {
    if (this.unlockAudio) {
      await this.unlockAudio();
    }
  }
}

// Create and export singleton instance
const soundService = new SoundService();

export default soundService; 