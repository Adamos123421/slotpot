
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
  const CARD_WIDTH = 81; // 75px + 3px margin on each side
  
  // Lock players when spinning starts to prevent them from changing during animation
  useEffect(() => {
    if (isSpinning && contractWinner && players.length > 0) {
      console.log('🔒 Locking players for animation:', players);
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
    const avatar = player.avatar && player.avatar !== '❓' ? player.avatar : "/img/unknown.webp";
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
    
    // Create enough copies to ensure smooth infinite scrolling (50 copies)
    for (let copyIndex = 0; copyIndex < 50; copyIndex++) {
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
    
    console.log('Looking for winner:', winner);
    console.log('Available players:', effectivePlayers);
    
    for (let i = 0; i < effectivePlayers.length; i++) {
      const player = effectivePlayers[i];
      if (
        (player && player.address && (player.address === winner.winner || player.address === winner.fullAddress)) ||
        (player && player.fullAddress && (player.fullAddress === winner.winner || player.fullAddress === winner.fullAddress)) ||
        (player && player.username && player.username === winner.username) ||
        (player && player.displayName && player.displayName === winner.displayName)
      ) {
        console.log(`Found winner at position ${i}:`, player);
        return i;
      }
    }
    console.warn('Winner not found in player list');
    return -1;
  }, [effectivePlayers]);

  // Spin wheel function with improved accuracy
  const spinWheel = useCallback((targetWinner) => {
    if (wheelState === 'spinning' || !wheelRef.current) return;
    
    console.log('Starting spin with winner:', targetWinner);
    
    // Sound removed
    
    setWheelState('spinning');
    stopIdleMovement();
    
    const winnerPosition = findWinnerPosition(targetWinner);
    if (winnerPosition === -1) {
      console.warn('Winner not found in player list, spinning randomly');
      // If winner not found, still spin but land on first player
      const fallbackPosition = 0;
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
    
    console.log(`📏 Card measurements: width=${actualCardWidth}px, margin=${cardMargin}px, total=${totalCardSpacing}px`);
    console.log(`🎯 Winner found at array position: ${winnerPosition}`);
    
    // CLASSIC SLOT MACHINE ANIMATION: Fast slide then slow down to winner
    const cycleLength = effectivePlayers.length * totalCardSpacing;
    const currentAbsolutePosition = Math.abs(currentPosition.current);
    
    // Calculate how far we need to slide to get the winner centered
    // We want to slide fast past the winner, then slow down and land on it
    const winnerOffset = winnerPosition * totalCardSpacing;
    
    // Slide at least 3 full cycles to create that "fast spinning" effect
    // Then land precisely on the winner in the next visible cycle
    const minimumSpinDistance = cycleLength * 3; // At least 3 full cycles
    const targetCycle = Math.ceil((currentAbsolutePosition + minimumSpinDistance) / cycleLength);
    const finalWinnerPosition = (targetCycle * cycleLength) + winnerOffset;
    const finalPosition = -(finalWinnerPosition + (actualCardWidth / 2) - centerOffset);
    
    console.log(`🎰 Classic slot machine calculation:`);
    console.log(`   - Current position: ${currentPosition.current}px`);
    console.log(`   - Winner position in array: ${winnerPosition}`);
    console.log(`   - Winner offset: ${winnerOffset}px`);
    console.log(`   - Minimum spin distance: ${minimumSpinDistance}px`);
    console.log(`   - Target cycle: ${targetCycle}`);
    console.log(`   - Final winner position: ${finalWinnerPosition}px`);
    console.log(`   - Final position: ${finalPosition}px`);
    console.log(`   - Total slide distance: ${Math.abs(finalPosition - currentPosition.current)}px`);
    
    // Sound removed
    
    // STAGE 1: Fast spinning for 2 seconds
    wheel.style.transitionTimingFunction = 'linear';
    wheel.style.transitionDuration = '2000ms';
    
    // Slide 80% of the way during fast phase
    const fastPhasePosition = currentPosition.current + ((finalPosition - currentPosition.current) * 0.8);
    wheel.style.transform = `translate3d(${fastPhasePosition}px, 0px, 0px)`;
    currentPosition.current = fastPhasePosition;
    
    // STAGE 2: Slow down dramatically for final 20% over 3 seconds
    setTimeout(() => {
      // Sound removed
      
      wheel.style.transitionTimingFunction = 'cubic-bezier(0.05, 0.1, 0.05, 1)';
      wheel.style.transitionDuration = '3000ms';
      wheel.style.transform = `translate3d(${finalPosition}px, 0px, 0px)`;
      currentPosition.current = finalPosition;
      
      // Sound removed
      
    }, 2000); // Wait 2 seconds for fast phase
    
    // After total animation (2s + 3s = 5s), show winner
    setTimeout(() => {
      console.log('Classic slot machine animation completed, showing winner');
      setWheelState('winner');
      
      // Highlight the winner card
      const allCards = wheel.querySelectorAll('.roulette-card');
      console.log(`🎯 Highlighting winner at position ${winnerPosition} out of ${effectivePlayers.length} players`);
      
      allCards.forEach((card, index) => {
        const cardPlayerIndex = index % effectivePlayers.length;
        if (cardPlayerIndex === winnerPosition) {
          card.classList.add('winner-highlight');
          console.log(`✨ Highlighted card at index ${index} (player ${cardPlayerIndex})`);
        }
      });
      
      // After showcasing winner for 4 seconds, go to finished state
      winnerShowcaseTimeoutRef.current = setTimeout(() => {
        console.log('Winner showcase complete, entering finished state');
        
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
      console.log('Starting roulette spin with winner:', contractWinner);
      spinWheel(contractWinner);
    } else if (isSpinning && !contractWinner && wheelState === 'idle') {
      // Bet placed, stop and wait for backend
      console.log('Stopping wheel, waiting for winner...');
      setWheelState('waiting');
      stopIdleMovement();
    } else if (!isSpinning && wheelState !== 'idle' && wheelState !== 'winner' && wheelState !== 'finished') {
      // Reset to idle state (but don't interrupt winner showcase or finished state)
      console.log('Resetting to idle state');
      setWheelState('idle');
    }
  }, [isSpinning, contractWinner, wheelState, spinWheel, stopIdleMovement]);

  // Detect new game start and reset from finished state to idle
  useEffect(() => {
    // If we're in finished state and there's no winner (new game starting), reset to idle
    if (wheelState === 'finished' && !contractWinner && !isSpinning) {
      console.log('New game detected - resetting from finished to idle');
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
