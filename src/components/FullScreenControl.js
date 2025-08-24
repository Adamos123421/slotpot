import React from 'react';
import useTelegramWebApp from '../hooks/useTelegramWebApp';
import './FullScreenControl.css';

const FullScreenControl = () => {
  const {
    isFullScreen,
    requestFullScreen,
    exitFullScreen,
    supportsFullScreen,
    orientation,
    viewportDimensions,
    lockOrientation,
    unlockOrientation,
    getLayoutMode,
    hapticFeedback,
    isMobile,
    isDesktop
  } = useTelegramWebApp();

  const handleFullScreenToggle = async () => {
    hapticFeedback('light');
    
    if (isFullScreen) {
      await exitFullScreen();
    } else {
      await requestFullScreen();
    }
  };

  const handleOrientationLock = (orientationMode) => {
    hapticFeedback('medium');
    
    if (orientationMode === 'unlock') {
      unlockOrientation();
    } else {
      lockOrientation(orientationMode);
    }
  };

  if (!supportsFullScreen || isDesktop) {
    return null; // Don't show controls if full-screen isn't supported or on desktop
  }

  const layoutMode = getLayoutMode();

  return (
    <div className={`fullscreen-control ${layoutMode}`}>
      <div className="fullscreen-status">
        <div className="status-indicator">
          <div className={`status-dot ${isFullScreen ? 'active' : 'inactive'}`}></div>
          <span className="status-text">
            {isFullScreen ? 'Full-Screen' : 'Normal Mode'}
          </span>
        </div>
        
        <div className="viewport-info">
          <span className="orientation-badge">{orientation}</span>
          <span className="dimensions-text">
            {viewportDimensions.width} × {viewportDimensions.height}
          </span>
        </div>
      </div>

      <div className="control-buttons">
        <button
          className={`control-btn fullscreen-btn ${isFullScreen ? 'active' : ''}`}
          onClick={handleFullScreenToggle}
          title={isFullScreen ? 'Exit Full-Screen' : 'Enter Full-Screen'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isFullScreen ? (
              // Exit full-screen icon
              <>
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 0 2-2h3M3 16h3a2 2 0 0 0 2 2v3"/>
              </>
            ) : (
              // Enter full-screen icon
              <>
                <path d="M3 7V3h4M21 7V3h-4M21 17v4h-4M3 17v4h4"/>
              </>
            )}
          </svg>
          <span className="btn-text">
            {isFullScreen ? 'Exit' : 'Full-Screen'}
          </span>
        </button>

        {isFullScreen && (
          <div className="orientation-controls">
            <button
              className="control-btn orientation-btn"
              onClick={() => handleOrientationLock('portrait')}
              title="Lock Portrait"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="7" y="2" width="10" height="20" rx="2" ry="2"/>
              </svg>
            </button>
            
            <button
              className="control-btn orientation-btn"
              onClick={() => handleOrientationLock('landscape')}
              title="Lock Landscape"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="10" rx="2" ry="2"/>
              </svg>
            </button>
            
            <button
              className="control-btn orientation-btn"
              onClick={() => handleOrientationLock('unlock')}
              title="Unlock Orientation"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="layout-info">
        <span className="layout-mode-text">Layout: {layoutMode}</span>
      </div>
    </div>
  );
};

export default FullScreenControl; 