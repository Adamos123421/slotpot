import React, { useState, useEffect, useRef, useCallback } from 'react';
import './OptimizedCarousel.css';

const OptimizedCarousel = ({ 
  players, 
  isSpinning, 
  onSpinComplete, 
  contractWinner,
  totalJackpotValue 
}) => {
  const [wheelState, setWheelState] = useState('idle'); // 'idle', 'spinning', 'winner'
  const [lockedPlayers, setLockedPlayers] = useState([]);
  const wheelRef = useRef();
  const currentPosition = useRef(0);
  
  // Lock players when spinning starts
  useEffect(() => {
    if (isSpinning && contractWinner && players.length > 0) {
      setLockedPlayers([...players]);
      setWheelState('spinning');
    }
  }, [isSpinning, contractWinner, players]);
  
  // Use locked players during animation
  const effectivePlayers = wheelState === 'spinning' || wheelState === 'winner' ? lockedPlayers : players;
  
  // Render player card with optimized structure
  const renderPlayerCard = useCallback((player, index) => {
    if (!player) {
      return (
        <div className="roulette-card waiting" key={`waiting-${index}`}>
          <div className="card-content">
            <div className="avatar-container">
              <div className="avatar-placeholder">?</div>
            </div>
            <div className="player-info">
              <p className="player-name">Waiting</p>
              <div className="bet-info">
                <div className="coin-icon grayscale"></div>
                <span className="bet-amount">0.000</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    const amount = player.bet || player.amount || 0;
    const isActive = amount > 0;
    const avatar = player.avatar && player.avatar !== '❓' && player.avatar !== '👤' ? 
      player.avatar : 
      `https://robohash.org/${player.address || player.name}.png?size=100x100`;
    const username = player.username || player.displayName || player.name || 'Player';
    const bet = amount.toFixed(3);
    
    return (
      <div 
        className={`roulette-card ${isActive ? 'active' : 'inactive'}`} 
        key={`${player.address || index}-${index}`}
        data-player-id={player.address || index}
      >
        <div className="card-content">
          <div className="avatar-container">
            <img src={avatar} alt={username} className="player-avatar" />
          </div>
          <div className="player-info">
            <p className="player-name">{username}</p>
            <div className="bet-info">
              <div className={`coin-icon ${!isActive ? 'grayscale' : ''}`}></div>
              <span className="bet-amount">{bet}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }, []);

  // Find winner position with optimized logic
  const findWinnerPosition = useCallback((winner) => {
    if (!winner || !effectivePlayers.length) return -1;
    
    // Try multiple matching strategies
    for (let i = 0; i < effectivePlayers.length; i++) {
      const player = effectivePlayers[i];
      if (!player) continue;
      
      // Direct address match
      if (winner.winner && player.address === winner.winner) {
        return i;
      }
      
      // Username match
      if (winner.username && player.username === winner.username) {
        return i;
      }
      
      // Display name match
      if (winner.displayName && player.displayName === winner.displayName) {
        return i;
      }
      
      // Winner name match
      if (winner.winnerName && player.username === winner.winnerName) {
        return i;
      }
    }
    
    return -1;
  }, [effectivePlayers]);

  // Perform spin with CSS-based animation
  const performSpin = useCallback((winnerPosition) => {
    if (!wheelRef.current || winnerPosition === -1) return;
    
    const wheel = wheelRef.current;
    const wheelWidth = wheel.offsetWidth;
    const centerOffset = wheelWidth / 2;
    const cardWidth = 166; // Fixed card width
    const cardSpacing = 20; // Fixed spacing
    const totalCardSpacing = cardWidth + cardSpacing;
    
    // Calculate final position to center winner
    const winnerOffset = winnerPosition * totalCardSpacing;
    const cycleLength = effectivePlayers.length * totalCardSpacing;
    const minimumSpinDistance = cycleLength * 3; // 3 full cycles minimum
    const targetCycle = Math.ceil((Math.abs(currentPosition.current) + minimumSpinDistance) / cycleLength);
    const finalWinnerPosition = (targetCycle * cycleLength) + winnerOffset;
    const finalPosition = -(finalWinnerPosition + (cardWidth / 2) - centerOffset - 20);
    
    // Apply CSS animation classes
    wheel.classList.add('spinning');
    wheel.style.setProperty('--final-position', `${finalPosition}px`);
    wheel.style.setProperty('--current-position', `${currentPosition.current}px`);
    
    // Update position
    currentPosition.current = finalPosition;
    
    // Animation complete callback
    setTimeout(() => {
      setWheelState('winner');
      wheel.classList.remove('spinning');
      if (onSpinComplete) onSpinComplete();
    }, 5000); // Match CSS animation duration
    
  }, [effectivePlayers.length, onSpinComplete]);

  // Start spin when contract winner is set
  useEffect(() => {
    if (isSpinning && contractWinner && effectivePlayers.length > 0) {
      const winnerPosition = findWinnerPosition(contractWinner);
      if (winnerPosition !== -1) {
        performSpin(winnerPosition);
      }
    }
  }, [isSpinning, contractWinner, effectivePlayers, findWinnerPosition, performSpin]);

  // Reset wheel state when not spinning
  useEffect(() => {
    if (!isSpinning) {
      setWheelState('idle');
      setLockedPlayers([]);
    }
  }, [isSpinning]);

  return (
    <div className="optimized-carousel-container">
      <div className="carousel-header">
        <h3>🎰 Jackpot: {totalJackpotValue?.toFixed(3) || '0.000'} TON</h3>
        {contractWinner && (
          <div className="winner-announcement">
            Winner: {contractWinner.username || contractWinner.displayName || contractWinner.winnerName || 'Unknown'}
          </div>
        )}
      </div>
      
      <div className="carousel-viewport">
        <div 
          ref={wheelRef}
          className={`roulette-wheel ${wheelState}`}
          style={{
            transform: `translate3d(${currentPosition.current}px, 0px, 0px)`,
            willChange: wheelState === 'spinning' ? 'transform' : 'auto'
          }}
        >
          {/* Create multiple cycles for smooth infinite scroll */}
          {Array.from({ length: 50 }, (_, cycleIndex) => (
            <div key={`cycle-${cycleIndex}`} className="roulette-row">
              {effectivePlayers.map((player, playerIndex) => 
                renderPlayerCard(player, playerIndex)
              )}
            </div>
          ))}
        </div>
        
        {/* Center indicator */}
        <div className="center-indicator">
          <div className="indicator-arrow"></div>
        </div>
      </div>
    </div>
  );
};

export default OptimizedCarousel;
