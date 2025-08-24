import { useEffect, useState } from 'react';

// Device detection utility function
const isMobileDevice = (telegramApp = null) => {
  // First check Telegram platform if available
  if (telegramApp?.platform) {
    const platform = telegramApp.platform.toLowerCase();
    console.log('📱 Telegram platform detected:', platform);
    
    // Telegram platform values:
    // - "android" = Android mobile
    // - "ios" = iOS mobile  
    // - "tdesktop" = Telegram Desktop
    // - "web" = Web version (could be mobile or desktop)
    // - "macos" = macOS Telegram
    // - "unknown" = fallback
    
    if (platform === 'android' || platform === 'ios') {
      console.log('📱 Mobile platform detected via Telegram:', platform);
      return true;
    }
    
    if (platform === 'tdesktop' || platform === 'macos') {
      console.log('📱 Desktop platform detected via Telegram:', platform);
      return false;
    }
    
    // For "web" platform, fall through to additional checks
    console.log('📱 Web platform detected, using additional checks');
  }
  
  // Fallback to traditional device detection
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  
  // Consider it mobile if it has mobile user agent OR (touch + small screen)
  return isMobileUserAgent || (isTouchDevice && isSmallScreen);
};

const useTelegramWebApp = () => {
  const [webApp, setWebApp] = useState(null);
  const [user, setUser] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [initData, setInitData] = useState(null);
  // Full-screen mode state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [orientation, setOrientation] = useState('portrait');
  const [viewportDimensions, setViewportDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  const [isMobile, setIsMobile] = useState(false); // Will be set properly in useEffect

  useEffect(() => {
    const app = window.Telegram?.WebApp;
    
    if (app) {
      // Mark body as Telegram environment for CSS targeting
      document.body.setAttribute('data-telegram', 'true');
      console.log('📱 Telegram WebApp detected - marked body with data-telegram attribute');
      
      app.ready();
      
      // Detect if device is mobile or desktop using Telegram platform info
      const deviceIsMobile = isMobileDevice(app);
      const isDesktop = !deviceIsMobile;
      setIsMobile(deviceIsMobile);
      console.log('📱 Device detection:', { 
        isMobile: !isDesktop, 
        isDesktop, 
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        touchSupport: 'ontouchstart' in window,
        telegramPlatform: app.platform,
        telegramVersion: app.version,
        viewportHeight: app.viewportHeight,
        viewportWidth: app.viewportWidth
      });
      
      // Enable full screen mode only on mobile devices
      app.expand();
      app.enableClosingConfirmation();
      
      // Prevent scroll-to-close gestures
      app.disableVerticalSwipes();
      if (app.setHeaderColor) {
        app.setHeaderColor('#0a0a0f');
      }
      
      // Prevent pull-to-refresh and document scroll
      document.addEventListener('touchmove', (e) => {
        // Only prevent scrolling on body/html level, allow within containers
        if (e.target === document.body || e.target === document.documentElement) {
          e.preventDefault();
        }
      }, { passive: false });
      
      // Request new full-screen mode only on mobile devices
      if (app.requestFullscreen && !isDesktop) {
        try {
          app.requestFullscreen();
          setIsFullScreen(true);
          console.log('📱 Telegram full-screen mode requested (mobile device)');
        } catch (error) {
          console.log('📱 Full-screen mode not available:', error);
        }
      } else if (isDesktop) {
        console.log('📱 Skipping full-screen mode on desktop device');
        setIsFullScreen(false);
      }
      
      // Request full screen viewport
      if (app.viewportHeight && app.viewportStableHeight) {
        console.log('📱 Telegram viewport:', {
          height: app.viewportHeight,
          stableHeight: app.viewportStableHeight,
          isExpanded: app.isExpanded,
          isFullScreen: app.isFullscreen || false
        });
      }
      
      // Set CSS custom properties for dynamic viewport
      document.documentElement.style.setProperty('--tg-viewport-height', `${app.viewportHeight || window.innerHeight}px`);
      document.documentElement.style.setProperty('--tg-viewport-stable-height', `${app.viewportStableHeight || window.innerHeight}px`);
      document.documentElement.style.setProperty('--tg-viewport-width', `${app.viewportWidth || window.innerWidth}px`);
      
      // Detect orientation
      const currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      setOrientation(currentOrientation);
      setViewportDimensions({
        width: app.viewportWidth || window.innerWidth,
        height: app.viewportHeight || window.innerHeight
      });
      
      // Set theme colors to match our design
      app.setHeaderColor('#0a0a0f');
      app.setBackgroundColor('#0a0a0f');
      
      // Hide Telegram header if possible
      if (app.setHeaderColor) {
        app.setHeaderColor('#0a0a0f');
      }
      
      setWebApp(app);
      
      // Get real user data
      const userData = app.initDataUnsafe?.user;
      const rawInitData = app.initData;
      
      // Extract start parameter from URL hash
      const hash = window.location.hash.slice(1);
      const hashParams = new URLSearchParams(hash);
      const urlParams = new URLSearchParams(window.location.search);
      
      const startParam = hashParams.get('tgWebAppStartParam') || 
                        app.initDataUnsafe?.start_param || 
                        urlParams.get('startapp') || 
                        null;
      
      console.log('📱 URL hash:', hash);
      console.log('📱 URL search params:', window.location.search);
      console.log('📱 tgWebAppStartParam from hash:', hashParams.get('tgWebAppStartParam'));
      console.log('📱 startapp from URL search:', urlParams.get('startapp'));
      console.log('📱 start_param from initDataUnsafe:', app.initDataUnsafe?.start_param);
      console.log('📱 Final startParam:', startParam);
      
      if (userData) {
        setUser({
          id: userData.id,
          firstName: userData.first_name,
          lastName: userData.last_name,
          username: userData.username,
          languageCode: userData.language_code,
          isPremium: userData.is_premium || false,
          photoUrl: userData.photo_url,
          // Formatted display name
          displayName: userData.first_name + (userData.last_name ? ` ${userData.last_name}` : ''),
          // Short name for UI
          shortName: userData.first_name || userData.username || 'User',
          // Referral start param if present
          referralCode: startParam || null
        });
        
        setInitData(rawInitData);
        console.log('📱 Real Telegram user data loaded:', userData);
      } else {
        // Fallback to mock data for testing
        console.log('📱 No Telegram user data - using mock');
        setUser({
          id: 123456789,
          firstName: "Test",
          lastName: "User", 
          username: "testuser",
          languageCode: "en",
          isPremium: false,
          displayName: "Test User",
          shortName: "Test",
          photoUrl: null,
          referralCode: new URLSearchParams(window.location.search).get('startapp') || null
        });
      }
      
      setIsExpanded(true);
      
      // Handle viewport changes (keyboard, orientation, etc.)
      const handleViewportChange = () => {
        if (app.viewportHeight) {
          document.documentElement.style.setProperty('--tg-viewport-height', `${app.viewportHeight}px`);
          document.documentElement.style.setProperty('--tg-viewport-stable-height', `${app.viewportStableHeight}px`);
          document.documentElement.style.setProperty('--tg-viewport-width', `${app.viewportWidth}px`);
          
          const newOrientation = app.viewportWidth > app.viewportHeight ? 'landscape' : 'portrait';
          setOrientation(newOrientation);
          setViewportDimensions({
            width: app.viewportWidth,
            height: app.viewportHeight
          });
          
          console.log('📱 Viewport changed:', {
            height: app.viewportHeight,
            stableHeight: app.viewportStableHeight,
            width: app.viewportWidth,
            orientation: newOrientation,
            isFullScreen: app.isFullscreen || false
          });
        }
      };
      
      // Handle full-screen mode changes
      const handleFullScreenChange = () => {
        const isCurrentlyFullScreen = app.isFullscreen || false;
        setIsFullScreen(isCurrentlyFullScreen);
        console.log('📱 Full-screen mode changed:', isCurrentlyFullScreen);
        
        // Add CSS class for full-screen styling
        if (isCurrentlyFullScreen) {
          document.documentElement.classList.add('telegram-fullscreen');
        } else {
          document.documentElement.classList.remove('telegram-fullscreen');
        }
      };
      
      // Listen for viewport changes
      if (app.onEvent) {
        app.onEvent('viewportChanged', handleViewportChange);
        app.onEvent('fullscreenChanged', handleFullScreenChange);
        app.onEvent('fullscreenFailed', () => {
          console.log('📱 Full-screen request failed');
          setIsFullScreen(false);
        });
      }
      
      // Handle back button
      app.BackButton.onClick(() => {
        app.close();
      });
      
      // Handle orientation changes
      const handleOrientationChange = () => {
        setTimeout(() => {
          const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
          setOrientation(newOrientation);
          setViewportDimensions({
            width: window.innerWidth,
            height: window.innerHeight
          });
          
          // Re-check device type on resize (for responsive breakpoints)
          const newIsMobile = isMobileDevice(app);
          if (newIsMobile !== isMobile) {
            setIsMobile(newIsMobile);
            console.log('📱 Device type changed:', { 
              wasMobile: isMobile, 
              nowMobile: newIsMobile,
              screenWidth: window.innerWidth,
              telegramPlatform: app.platform
            });
          }
          
          console.log('📱 Orientation changed to:', newOrientation);
        }, 100); // Small delay to ensure dimensions are updated
      };
      
      window.addEventListener('orientationchange', handleOrientationChange);
      window.addEventListener('resize', handleOrientationChange);
      
      // Cleanup
      return () => {
        window.removeEventListener('orientationchange', handleOrientationChange);
        window.removeEventListener('resize', handleOrientationChange);
        // Clean up Telegram body attribute
        document.body.removeAttribute('data-telegram');
        console.log('📱 Cleaned up Telegram WebApp body attribute');
      };
      
    } else {
      // Set mock user for browser testing
      setUser({
        id: 123456789,
        firstName: "Test",
        lastName: "User",
        username: "testuser", 
        languageCode: "en",
        isPremium: false,
        displayName: "Test User",
        shortName: "Test",
        photoUrl: null
      });
      
      // Set device detection for non-Telegram environment
      const deviceIsMobile = isMobileDevice();
      setIsMobile(deviceIsMobile);
      console.log('📱 Running in browser mode - using mock data, isMobile:', deviceIsMobile);
      
      // Handle orientation in browser mode
      const handleBrowserOrientationChange = () => {
        const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
        setOrientation(newOrientation);
        setViewportDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
        
        // Re-check device type on resize (for responsive breakpoints)
        const newIsMobile = isMobileDevice();
        if (newIsMobile !== isMobile) {
          setIsMobile(newIsMobile);
          console.log('📱 Browser mode device type changed:', { 
            wasMobile: isMobile, 
            nowMobile: newIsMobile,
            screenWidth: window.innerWidth
          });
        }
      };
      
      window.addEventListener('resize', handleBrowserOrientationChange);
      
      return () => {
        window.removeEventListener('resize', handleBrowserOrientationChange);
      };
    }
  }, []);

  const showAlert = (message) => {
    if (webApp) {
      webApp.showAlert(message);
    } else {
      window.alert(message);
    }
  };

  const showConfirm = (message, callback) => {
    if (webApp) {
      webApp.showConfirm(message, callback);
    } else {
      callback(window.confirm(message));
    }
  };

  const hapticFeedback = (type = 'impact') => {
    if (webApp?.HapticFeedback) {
      switch (type) {
        case 'light':
          webApp.HapticFeedback.impactOccurred('light');
          break;
        case 'medium':
          webApp.HapticFeedback.impactOccurred('medium');
          break;
        case 'heavy':
          webApp.HapticFeedback.impactOccurred('heavy');
          break;
        case 'error':
          webApp.HapticFeedback.notificationOccurred('error');
          break;
        case 'success':
          webApp.HapticFeedback.notificationOccurred('success');
          break;
        case 'warning':
          webApp.HapticFeedback.notificationOccurred('warning');
          break;
        default:
          webApp.HapticFeedback.impactOccurred('medium');
      }
    }
  };

  // Open external link (for wallet connections)
  const openLink = (url) => {
    if (webApp) {
      webApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  // Show main button (for betting actions)
  const showMainButton = (text, onClick) => {
    if (webApp?.MainButton) {
      webApp.MainButton.setText(text);
      webApp.MainButton.show();
      webApp.MainButton.onClick(onClick);
    }
  };

  const hideMainButton = () => {
    if (webApp?.MainButton) {
      webApp.MainButton.hide();
    }
  };

  // Full-screen mode controls
  const requestFullScreen = async () => {
    if (!isMobile) {
      console.log('📱 Full-screen mode disabled on desktop devices');
      return false;
    }
    
    if (webApp?.requestFullscreen) {
      try {
        await webApp.requestFullscreen();
        setIsFullScreen(true);
        console.log('📱 Full-screen mode activated');
        return true;
      } catch (error) {
        console.error('📱 Failed to request full-screen:', error);
        return false;
      }
    } else {
      console.warn('📱 Full-screen mode not supported');
      return false;
    }
  };

  const exitFullScreen = async () => {
    if (webApp?.exitFullscreen) {
      try {
        await webApp.exitFullscreen();
        setIsFullScreen(false);
        console.log('📱 Exited full-screen mode');
        return true;
      } catch (error) {
        console.error('📱 Failed to exit full-screen:', error);
        return false;
      }
    } else {
      console.warn('📱 Full-screen exit not supported');
      return false;
    }
  };

  const toggleFullScreen = async () => {
    if (!isMobile) {
      console.log('📱 Full-screen toggle disabled on desktop devices');
      return false;
    }
    
    if (isFullScreen) {
      return await exitFullScreen();
    } else {
      return await requestFullScreen();
    }
  };

  // Lock orientation (if supported)
  const lockOrientation = (orientationLock) => {
    // Use window.screen to avoid ESLint no-restricted-globals error
    if (typeof window !== 'undefined' && window.screen && window.screen.orientation && window.screen.orientation.lock) {
      try {
        window.screen.orientation.lock(orientationLock);
        console.log(`📱 Orientation locked to: ${orientationLock}`);
      } catch (error) {
        console.warn('📱 Orientation lock not supported or failed:', error);
      }
    } else {
      console.warn('📱 Screen orientation API not available');
    }
  };

  const unlockOrientation = () => {
    // Use window.screen to avoid ESLint no-restricted-globals error
    if (typeof window !== 'undefined' && window.screen && window.screen.orientation && window.screen.orientation.unlock) {
      try {
        window.screen.orientation.unlock();
        console.log('📱 Orientation unlocked');
      } catch (error) {
        console.warn('📱 Orientation unlock failed:', error);
      }
    } else {
      console.warn('📱 Screen orientation API not available');
    }
  };

  // Get user avatar URL or generate one
  const getUserAvatar = () => {
    if (user?.photoUrl) {
      return user.photoUrl;
    }
    
    // Generate avatar based on user initials
    const initials = user?.shortName?.charAt(0)?.toUpperCase() || 'U';
    return `https://ui-avatars.com/api/?name=${initials}&background=6366f1&color=ffffff&size=128`;
  };

  return {
    webApp,
    user,
    isExpanded,
    initData,
    showAlert,
    showConfirm,
    hapticFeedback,
    openLink,
    showMainButton,
    hideMainButton,
    getUserAvatar,
    isReady: !!webApp,
    isTelegramEnv: !!window.Telegram?.WebApp,
    // Helper to check if we have real user data
    hasRealUserData: !!(webApp && webApp.initDataUnsafe?.user),
    // Device detection
    isMobile,
    isDesktop: !isMobile,
    // Full-screen mode functionality
    isFullScreen,
    requestFullScreen,
    exitFullScreen,
    toggleFullScreen,
    // Orientation and viewport
    orientation,
    viewportDimensions,
    lockOrientation,
    unlockOrientation,
    // Helper to check if full-screen is supported
    supportsFullScreen: !!(webApp?.requestFullscreen),
    // Helper to get optimal layout based on orientation and full-screen
    getLayoutMode: () => {
      if (isFullScreen) {
        return orientation === 'landscape' ? 'fullscreen-landscape' : 'fullscreen-portrait';
      }
      return orientation === 'landscape' ? 'normal-landscape' : 'normal-portrait';
    }
  };
};

export default useTelegramWebApp; 