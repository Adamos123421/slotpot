import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TonIcon } from './IconComponents';


const SimpleCarousel = ({ 
  players, 
  isSpinning, 
  onSpinComplete, 
  contractWinner,
  totalJackpotValue 
}) => {
  const [wheelState, setWheelState] = useState('idle'); // 'idle', 'waiting', 'spinning', 'winner', 'finished'
  const [lockedPlayers, setLockedPlayers] = useState([]); // Lock players during animation
  const wheelRef = useRef();
  const idleAnimationRef = useRef();
  const currentPosition = useRef(0);
  const winnerShowcaseTimeoutRef = useRef();
  
  // Card dimensions (matching roulette example)
  const CARD_WIDTH = 20; // 75px + 3px margin on each side
  
  // Lock players when spinning starts to prevent them from changing during animation
  useEffect(() => {
    if (isSpinning && contractWinner && players.length > 0) {
      // Locking players for animation
      setLockedPlayers([...players]);
    }
  }, [isSpinning, contractWinner, players]);
  
  // Use locked players during animation, regular players otherwise
  const effectivePlayers = wheelState === 'spinning' || wheelState === 'winner' ? lockedPlayers : players;
  
  // Render individual player card HTML
  const renderPlayerCard = useCallback((player, key) => {
    if (!player) {
      return `
        <div class="waiting-card">
          <div class="avatar-container">
            ?
          </div>
          <div class="waiting-text">Waiting</div>
          <div class="waiting-amount">0.000</div>
        </div>
      `;
    }
    
    // Always show the amount if it exists, regardless of isRealPlayer
    const amount = player.bet || player.amount || 0;
    const isActive = amount > 0;
    const avatar = player.avatar && player.avatar !== '❓' && player.avatar !== '👤' ? 
      player.avatar : 
      `https://robohash.org/${player.address || player.name}.png?size=100x100`;
    const username = player.username || player.displayName || player.name || 'Player';
    const bet = amount.toFixed(3);
    
    return `
      <div class="player-card ${isActive ? 'active' : 'inactive'}" data-key="${key}">
        <div class="card-content">
          <div class="avatar-container">
            <img src="${avatar}" alt="${username}" class="player-avatar" />
          </div>
          <div class="player-info">
            <p class="player-name">${username}</p>
            <div class="bet-info">
              <div class="coin-icon ${!isActive ? 'grayscale' : ''}"></div>
              <span class="bet-amount">${bet}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }, []);

  // Initialize wheel with player rows for infinite scrolling
  const initWheel = useCallback(() => {
    if (!wheelRef.current || !effectivePlayers.length) return;
    
    const wheel = wheelRef.current;
    wheel.innerHTML = ''; // Clear existing content
    
    // Create one continuous row with multiple player cycles for smooth infinite scroll
    const row = document.createElement('div');
    row.className = 'roulette-row';
    
    // Create enough copies to ensure smooth infinite scrolling (10 copies)
    for (let copyIndex = 0; copyIndex < 10; copyIndex++) {
      effectivePlayers.forEach((player, playerIndex) => {
        const card = document.createElement('div');
        card.className = 'roulette-card';
        card.innerHTML = renderPlayerCard(player, `${copyIndex}-${playerIndex}`);
        row.appendChild(card);
      });
    }
    
    wheel.appendChild(row);
  }, [effectivePlayers, renderPlayerCard]);

  // Idle movement - constant speed with true infinite scroll
  const startIdleMovement = useCallback(() => {
    if (!wheelRef.current || wheelState !== 'idle') return;
    
    const animate = () => {
      if (wheelState !== 'idle') return;
      
      currentPosition.current -= 0.5; // Slower, smoother movement (0.5px per frame)
      
      // True infinite scroll - reset when we've scrolled through several player cycles
      // Use actual card spacing for consistency
      const firstCard = wheelRef.current?.querySelector('.roulette-card');
      const actualCardWidth = firstCard ? firstCard.offsetWidth : CARD_WIDTH;
      const cardMargin = firstCard ? parseInt(getComputedStyle(firstCard).marginLeft) + parseInt(getComputedStyle(firstCard).marginRight) : 6;
      const totalCardSpacing = actualCardWidth + cardMargin;
      
      const cycleWidth = effectivePlayers.length * totalCardSpacing;
      const resetPoint = -(cycleWidth * 10); // Reset after 10 cycles
      
      if (currentPosition.current <= resetPoint) {
        // Reset to a position that maintains visual continuity
        currentPosition.current = -(cycleWidth * 5); // Reset to middle area
      }
      
      if (wheelRef.current) {
        wheelRef.current.style.transform = `translate3d(${currentPosition.current}px, 0px, 0px)`;
      }
      
      idleAnimationRef.current = requestAnimationFrame(animate);
    };
    
    idleAnimationRef.current = requestAnimationFrame(animate);
  }, [wheelState, effectivePlayers.length, CARD_WIDTH]);

  // Stop idle movement
  const stopIdleMovement = useCallback(() => {
    if (idleAnimationRef.current) {
      cancelAnimationFrame(idleAnimationRef.current);
      idleAnimationRef.current = null;
    }
  }, []);

  // Find winner position in player array
  const findWinnerPosition = useCallback((winner) => {
    if (!winner || !effectivePlayers.length) return -1;
    
    for (let i = 0; i < effectivePlayers.length; i++) {
      const player = effectivePlayers[i];
      if (!player) continue;
      
      // Try multiple matching strategies
      const addressMatch = (
        (player.address && (player.address === winner.winner || player.address === winner.fullAddress)) ||
        (player.fullAddress && (player.fullAddress === winner.winner || player.fullAddress === winner.fullAddress))
      );
      
      const usernameMatch = (
        (player.username && player.username === winner.username) ||
        (player.displayName && player.displayName === winner.displayName) ||
        (player.username && winner.username && player.username === winner.username) ||
        (player.displayName && winner.winnerName && player.displayName === winner.winnerName)
      );
      
      if (addressMatch || usernameMatch) {
        return i;
      }
    }
    
    return -1;
  }, [effectivePlayers]);

  // Spin wheel function with improved accuracy
  const spinWheel = useCallback((targetWinner) => {
    if (wheelState === 'spinning' || !wheelRef.current) return;
    
    setWheelState('spinning');
    stopIdleMovement();
    
    const winnerPosition = findWinnerPosition(targetWinner);
    if (winnerPosition === -1) {
      // Fallback 1: Try to find by username pattern (e.g., "Player_3tsb" -> look for any player with "3tsb")
      const winnerUsername = targetWinner.username || targetWinner.winnerName;
      if (winnerUsername && winnerUsername.includes('_')) {
        const usernameSuffix = winnerUsername.split('_')[1];
        for (let i = 0; i < effectivePlayers.length; i++) {
          const player = effectivePlayers[i];
          if (player && player.username && player.username.includes(usernameSuffix)) {
            performSpin(i, targetWinner);
            return;
          }
        }
      }
      
      // Fallback 2: If no match found, land on first active player
      const firstActivePlayer = effectivePlayers.findIndex(p => p && (p.bet > 0 || p.amount > 0));
      const fallbackPosition = firstActivePlayer !== -1 ? firstActivePlayer : 0;
      performSpin(fallbackPosition, targetWinner);
      return;
    }
          
    performSpin(winnerPosition, targetWinner);
    
  }, [wheelState, stopIdleMovement, findWinnerPosition, effectivePlayers.length, onSpinComplete, CARD_WIDTH]);

  // Separate function to perform the actual spin animation
  const performSpin = useCallback((winnerPosition, targetWinner) => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    // Calculate precise landing position
    const wheelWidth = wheel.offsetWidth;
    const centerOffset = wheelWidth / 2;
    const firstCard = wheel.querySelector('.roulette-card');
    const actualCardWidth = firstCard ? firstCard.offsetWidth : CARD_WIDTH;
    const cardMargin = firstCard ? parseInt(getComputedStyle(firstCard).marginLeft) + parseInt(getComputedStyle(firstCard).marginRight) : 6;
    const totalCardSpacing = actualCardWidth + cardMargin;
    
    // CLASSIC SLOT MACHINE ANIMATION: Fast slide then slow down to winner
    const cycleLength = effectivePlayers.length * totalCardSpacing;
    const currentAbsolutePosition = Math.abs(currentPosition.current);
    
    // Calculate how far we need to slide to get the winner centered
    // The winner card should be perfectly centered in the wheel
    const winnerOffset = winnerPosition * totalCardSpacing;
    
    // Slide at least 3 full cycles to create that "fast spinning" effect
    // Then land precisely on the winner in the next visible cycle
    const minimumSpinDistance = cycleLength * 3; // At least 3 full cycles
    const targetCycle = Math.ceil((currentAbsolutePosition + minimumSpinDistance) / cycleLength);
    const finalWinnerPosition = (targetCycle * cycleLength) + winnerOffset;
    
    // Calculate the exact position to center the winner card
    // The center of the winner card should align with the center of the wheel
    // Add -50px adjustment to land exactly on the winner
    const finalPosition = -(finalWinnerPosition + (actualCardWidth / 2) - centerOffset - 20);
    
    // Start ticking sound for the spinning effect
    let tickInterval = setInterval(() => {
              // Spin sound removed for performance
    }, 100); // Fast ticking initially
    
    // STAGE 1: Fast spinning for 2 seconds
    wheel.style.transitionTimingFunction = 'linear';
    wheel.style.transitionDuration = '2000ms';
    
    // Slide 80% of the way during fast phase
    const fastPhasePosition = currentPosition.current + ((finalPosition - currentPosition.current) * 1);
    wheel.style.transform = `translate3d(${fastPhasePosition}px, 0px, 0px)`;
    currentPosition.current = fastPhasePosition;
    
    // STAGE 2: Slow down dramatically for final 20% over 3 seconds
    setTimeout(() => {
      // Slower ticking sound
      clearInterval(tickInterval);
      tickInterval = setInterval(() => {
        // Spin sound removed for performance
      }, 300); // Much slower ticking
      
      wheel.style.transitionTimingFunction = 'cubic-bezier(0.05, 0.1, 0.05, 1)';
      wheel.style.transitionDuration = '3000ms';
      wheel.style.transform = `translate3d(${finalPosition}px, 0px, 0px)`;
      currentPosition.current = finalPosition;
      
      // Stop ticking after slowdown completes
      setTimeout(() => {
        clearInterval(tickInterval);
      }, 3000);
      
    }, 2000); // Wait 2 seconds for fast phase
    
    // After total animation (2s + 3s = 5s), show winner
    setTimeout(() => {
      setWheelState('winner');
      
      // Highlight the winner card
      const allCards = wheel.querySelectorAll('.roulette-card');
      
      // Find the card that should be in the center (winner card)
      const centerCardIndex = Math.round(Math.abs(finalPosition) / totalCardSpacing);
      
      
      
      // Verify the center card is indeed the winner
      const centerCard = allCards[centerCardIndex];
      if (centerCard) {
        const centerCardPlayerIndex = centerCardIndex % effectivePlayers.length;
        if (centerCardPlayerIndex === winnerPosition) {
        } else {
        }
      }
      
      // After showcasing winner for 4 seconds, go to finished state
      winnerShowcaseTimeoutRef.current = setTimeout(() => {
        
        // Remove winner highlights
        const highlightedCards = wheel.querySelectorAll('.winner-highlight');
        highlightedCards.forEach(card => {
          card.classList.remove('winner-highlight');
        });
        
        // Reset transition styles
        wheel.style.transitionTimingFunction = '';
        wheel.style.transitionDuration = '';
        
        // Clear locked players
        setLockedPlayers([]);
        
        setWheelState('finished');
        onSpinComplete?.(targetWinner);
      }, 4000); // Show winner for 4 seconds
      
    }, 5000); // Wait 5 seconds for both phases (2s fast + 3s slow)
    
  }, [effectivePlayers.length, CARD_WIDTH, onSpinComplete]);

  // Handle state changes
  useEffect(() => {
    if (isSpinning && contractWinner && wheelState === 'waiting') {
      // Backend responded with winner, start spinning
      spinWheel(contractWinner);
    } else if (isSpinning && !contractWinner && wheelState === 'idle') {
      // Bet placed, stop and wait for backend
      setWheelState('waiting');
      stopIdleMovement();
    } else if (!isSpinning && wheelState !== 'idle' && wheelState !== 'winner' && wheelState !== 'finished') {
      // Reset to idle state (but don't interrupt winner showcase or finished state)
      setWheelState('idle');
    }
  }, [isSpinning, contractWinner, wheelState, spinWheel, stopIdleMovement]);

  // Detect new game start and reset from finished state to idle
  useEffect(() => {
    // If we're in finished state and there's no winner (new game starting), reset to idle
    if (wheelState === 'finished' && !contractWinner && !isSpinning) {
      setWheelState('idle');
    }
  }, [wheelState, contractWinner, isSpinning]);

  // Start/stop idle movement based on state
  useEffect(() => {
    if (wheelState === 'idle') {
      startIdleMovement();
    } else {
      stopIdleMovement();
    }
    
    return () => stopIdleMovement();
  }, [wheelState, startIdleMovement, stopIdleMovement]);

  // Initialize wheel when effective players change (but not during winner showcase)
  useEffect(() => {
    // Don't reinitialize during winner showcase or finished state to preserve highlighting
    if (wheelState !== 'winner' && wheelState !== 'finished') {
      initWheel();
    }
  }, [initWheel, wheelState]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (winnerShowcaseTimeoutRef.current) {
        clearTimeout(winnerShowcaseTimeoutRef.current);
      }
    };
  }, []);

  if (!effectivePlayers || effectivePlayers.length === 0) {
    return (
      <div className="simple-carousel">
        <div className="carousel-message">
          Waiting for players to join...
        </div>
      </div>
    );
  }

  return (
    <div className="roulette-wrapper">
      {/* Center selector line */}
      <div className="roulette-selector"></div>
      
      {/* Spinning wheel */}
      <div ref={wheelRef} className="roulette-wheel"></div>
      
      {/* State indicator */}
      <div className="wheel-state-indicator">
        {wheelState === 'idle' && <span>🎰</span>}
        {wheelState === 'waiting' && <span>⏳</span>}
        {wheelState === 'spinning' && <span>🎯</span>}
        {wheelState === 'winner' && <span>🎉</span>}
        {wheelState === 'finished' && <span>🏁</span>}
      </div>
      
      {/* Glare Effect */}
      <div 
        className="absolute -top-1/4 -right-1/3 h-full opacity-75 will-change-transform z-[3] pointer-events-none"
        style={{ maskImage: 'linear-gradient(black, transparent 50%)' }}
      >
        <img src="/img/glare.webp" className="w-full object-cover object-center" alt="" />
              </div>
    </div>
  );
};

export default SimpleCarousel; 