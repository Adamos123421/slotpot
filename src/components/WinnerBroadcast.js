import React, { useState, useEffect } from 'react';
import winnerCoordinator from '../services/winnerCoordinator';
import './WinnerBroadcast.css';

const WinnerBroadcast = ({ socketService }) => {
  const [winnerBanner, setWinnerBanner] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!socketService) return;

    // Listen for winner banner notifications
    const handleWinnerBanner = (bannerData) => {
      console.log('🔔 Winner banner received:', bannerData);
      
      // Check with coordinator if we should show this banner
      if (winnerCoordinator.shouldBlock(bannerData.winnerData?.timestamp)) {
        console.log('🔄 WinnerBroadcast: Banner blocked by coordinator');
        return;
      }
      
      // Inform coordinator that we're showing a winner announcement
      winnerCoordinator.setActive(true, bannerData.winnerData?.timestamp);
      
      setWinnerBanner(bannerData);
      setIsVisible(true);

      // Auto-hide after specified duration (extended for better user experience)
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          setWinnerBanner(null);
          winnerCoordinator.setActive(false);
        }, 500); // Wait for animation
      }, bannerData.duration || 10000);
    };

    socketService.on('notification:banner', handleWinnerBanner);

    return () => {
      socketService.off('notification:banner', handleWinnerBanner);
    };
  }, [socketService]);

  if (!winnerBanner) return null;

  return (
    <div className={`winner-broadcast ${isVisible ? 'visible' : ''}`}>
      <div className="winner-broadcast-content">
        <div className="celebration-confetti">
          {[...Array(20)].map((_, i) => (
            <div key={i} className={`confetti confetti-${i % 5}`} />
          ))}
        </div>
        
        <div className="winner-header">
          <h1 className="winner-title">{winnerBanner.title}</h1>
        </div>
        
        <div className="winner-details">
          <div className="winner-avatar">🏆</div>
          <div className="winner-info">
            <h2 className="winner-name">{winnerBanner.winnerData?.username}</h2>
            <div className="winner-prize">
              <span className="prize-amount">{winnerBanner.winnerData?.prize}</span>
              <span className="prize-currency">TON</span>
            </div>
          </div>
        </div>
        
        <div className="winner-message">
          {winnerBanner.message}
        </div>
        
        <div className="celebration-effects">
          <div className="sparkle sparkle-1">✨</div>
          <div className="sparkle sparkle-2">🎉</div>
          <div className="sparkle sparkle-3">🎊</div>
          <div className="sparkle sparkle-4">✨</div>
        </div>
        
        <button 
          className="close-button"
          onClick={() => {
            console.log('🔴 WinnerBroadcast: Manual close triggered');
            setIsVisible(false);
            setTimeout(() => {
              setWinnerBanner(null);
              winnerCoordinator.setActive(false);
            }, 500);
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default WinnerBroadcast; 