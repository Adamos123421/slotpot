import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import soundService from '../services/soundService';

const SoundControl = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [audioContextState, setAudioContextState] = useState('unavailable');

  useEffect(() => {
    // Check if sound service is ready
    const checkSoundService = () => {
      setIsLoaded(soundService.isReady());
      setIsEnabled(soundService.isEnabled);
      setIsUnlocked(soundService.isUnlocked());
      setAudioContextState(soundService.getAudioContextState());
    };

    // Initial check
    checkSoundService();

    // Periodically check if sound service becomes ready
    const interval = setInterval(checkSoundService, 1000);

    return () => clearInterval(interval);
  }, []);

  const toggleSound = async () => {
    console.log('🔊 Sound control clicked');
    
    // Force audio unlock attempt
    try {
      await soundService.forceUnlock();
    } catch (error) {
      console.warn('Failed to force unlock audio:', error);
    }
    
    const newState = soundService.toggle();
    setIsEnabled(newState);
    
    // Play a test sound if enabling
    if (newState && isLoaded) {
      console.log('🎵 Playing test sound');
      soundService.play('bet', { volume: 0.3 });
    }
    
    // Update states
    setIsUnlocked(soundService.isUnlocked());
    setAudioContextState(soundService.getAudioContextState());
  };

  // Determine icon and color based on state
  const getIcon = () => {
    if (!isLoaded) {
      return <VolumeX size={18} />;
    }
    
    if (!isEnabled) {
      return <VolumeX size={18} />;
    }
    
    return <Volume2 size={18} />;
  };

  const getTitle = () => {
    if (!isLoaded) {
      return 'Loading sounds...';
    }
    
    if (!isUnlocked && audioContextState === 'suspended') {
      return 'Click to enable sounds (Telegram audio policy)';
    }
    
    if (!isEnabled) {
      return 'Enable sounds';
    }
    
    return 'Mute sounds';
  };

  const getButtonStyle = () => {
    let style = {};
    
    if (!isLoaded) {
      style.opacity = 0.5;
    } else if (!isUnlocked && audioContextState === 'suspended') {
      // Visual indicator that audio needs to be unlocked
      style.borderColor = '#f59e0b';
      style.color = '#f59e0b';
    } else if (!isEnabled) {
      style.opacity = 0.7;
    }
    
    return style;
  };

  return (
    <button 
      className="header-icon sound-control" 
      onClick={toggleSound}
      title={getTitle()}
      disabled={!isLoaded}
      style={getButtonStyle()}
    >
      {getIcon()}
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          fontSize: '8px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '2px 4px',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
          zIndex: 1000
        }}>
          {`${isLoaded ? 'L' : 'x'}${isEnabled ? 'E' : 'x'}${isUnlocked ? 'U' : 'x'} ${audioContextState}`}
        </div>
      )}
    </button>
  );
};

export default SoundControl; 