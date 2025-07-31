import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import PlayerSlot from './PlayerSlot';
import './GameArea.css';

function GameArea({ 
  jackpotValue,
  currentRound,
  timeRemaining,
  isLive,
  betAmount,
  onBetChange,
  onPlaceBet,
  isConnected,
  isLoading,
  userWinChance,
  userBetTotal,
  contractState,
  adminInfo,
  currentBettors,
  // Winner state props (passed from App.js)
  waitingForWinner,
  contractWinner,
  postWinnerLoading,
  showWinnerAnnouncement
}) {
  // Local animation state only (winner states are now props from App.js)
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelOffset, setReelOffset] = useState(0);
  const [winner, setWinner] = useState(null);
  const [predeterminedWinner, setPredeterminedWinner] = useState(null);
  
  // Winner states removed - now passed as props from App.js:
  // waitingForWinner, contractWinner, showWinnerAnnouncement, postWinnerLoading
  const [transactionNotification, setTransactionNotification] = useState({
    show: false,
    message: '',
    type: 'success' // 'success', 'pending', 'error'
  });

  // Use refs to prevent unnecessary re-renders
  const animationFrameRef = useRef();
  const [localTimer, setLocalTimer] = useState(0);
  const lastSyncRef = useRef(null);

  // Use refs for animation conditions to avoid dependency issues
  const isSpinningRef = useRef(isSpinning);
  const winnerRef = useRef(winner);
  
  // Keep refs in sync
  useEffect(() => { isSpinningRef.current = isSpinning; }, [isSpinning]);
  useEffect(() => { winnerRef.current = winner; }, [winner]);

  // Memoized calculated values to prevent recalculation on every render
  const memoizedValues = useMemo(() => {
    // Check if contract is active - if not, show everything as 0
    const isContractActive = contractState?.isActive !== false;
    
         // Use local countdown timer if active, otherwise fall back to contract/prop data
    // SAFETY: Ensure we never accidentally render the timer object by extracting only numbers
    const backendTimer = typeof contractState?.timer?.timeRemaining === 'number' 
      ? contractState.timer.timeRemaining 
      : (typeof timeRemaining === 'number' ? timeRemaining : 0);
     const displayTimer = isContractActive ? (localTimer > 0 ? localTimer : backendTimer) : 0;
    
         // Debug logging for timer sync
     if (backendTimer > 0 && Math.abs(backendTimer - localTimer) > 5) {
       console.log('⏰ Timer sync check:', {
         backend: backendTimer,
         local: localTimer,
         using: displayTimer
       });
     }
    
    // SAFETY: Ensure roundNumber is always a number, never an object
    const displayRound = typeof contractState?.timer?.roundNumber === 'number' 
      ? contractState.timer.roundNumber 
      : (typeof currentRound === 'number' ? currentRound : 0);
    const totalPlayers = isContractActive ? (contractState?.betCount || currentBettors?.length || 0) : 0;

    // Use contract's total jackpot value directly (this includes all bet amounts before fees)
    const totalJackpotValue = isContractActive ? (contractState?.totalJackpot || jackpotValue || 0) : 0;

    // Calculate winner prize (95% of total jackpot, 5% is fee)
    const winnerPrizeValue = totalJackpotValue * 0.95;

    return {
      displayTimer: Math.max(0, displayTimer), // Ensure always positive number
      displayRound: Math.max(0, displayRound), // Ensure always positive number
      totalPlayers,
      totalJackpotValue: parseFloat(totalJackpotValue.toFixed(3)), // Contract's total jackpot
      winnerPrizeValue: parseFloat(winnerPrizeValue.toFixed(3)), // Amount winner gets (95% of total)
      isContractActive
    };
  }, [contractState?.isActive, contractState?.timer?.roundNumber, contractState?.betCount, contractState?.totalJackpot, contractState?.timer?.timeRemaining,
      currentBettors, currentRound, jackpotValue, timeRemaining, localTimer]);

  // Memoize player stats to prevent unnecessary updates
  const playerStats = useMemo(() => {
    // If contract is not active, show everything as 0
    if (!memoizedValues.isContractActive) {
      return {
        yourWager: 0,
        yourChance: 0
      };
    }
    
    // Find user's bet in current bettors
    const userBettor = currentBettors?.find(bettor => 
      bettor.address === contractState?.userAddress ||
      bettor.fullAddress === contractState?.userAddress
    );
    
    const yourWager = userBettor ? userBettor.amount : userBetTotal || 0; // Show actual bet amount including fee
    
    // Use contract's probability calculation if available, otherwise fallback to manual calculation
    const yourChance = userWinChance > 0 ? userWinChance : 
      (userBettor?.amount && memoizedValues.totalJackpotValue > 0 ? 
        (userBettor.amount * 100) / memoizedValues.totalJackpotValue : 0);

    return {
      yourWager: parseFloat(yourWager.toFixed(3)), // Prevent floating point jitter
      yourChance: parseFloat(yourChance.toFixed(2)) // Prevent floating point jitter
    };
  }, [currentBettors, contractState?.userAddress, userBetTotal, userWinChance, memoizedValues.totalJackpotValue, memoizedValues.isContractActive]);

  // Memoize game status to prevent text flicker
  const gameStatus = useMemo(() => {
    if (!memoizedValues.isContractActive) return "⏸️ Jackpot is paused";
    if (waitingForWinner) return "🎯 Selecting winner...";
    if (!isLive) return adminInfo?.isAutoManaged ? "🤖 Auto-starting next round..." : "Waiting for next round...";
    if (winner) return `🎉 ${winner.name} wins ${memoizedValues.winnerPrizeValue.toFixed(3)} TON!`;
    if (isSpinning) return "🎰 Spinning...";
    if (memoizedValues.displayTimer <= 5 && memoizedValues.totalPlayers > 0) return "⏰ Get ready to spin!";
    if (memoizedValues.totalPlayers === 0) return "💰 Place your bets to start!";
    return `💰 ${memoizedValues.totalPlayers} player${memoizedValues.totalPlayers !== 1 ? 's' : ''} betting...`;
  }, [waitingForWinner, isLive, winner, isSpinning, adminInfo?.isAutoManaged, memoizedValues]);

  const { displayTimer, displayRound, totalPlayers, totalJackpotValue, winnerPrizeValue } = memoizedValues;

  // Memoized player creation to prevent recreation on every render
  const players = useMemo(() => {
    // Create fixed array of 20 cards
    const FIXED_CARDS = 20;
    const playersArray = [];
    
    // If contract is not active, show only waiting placeholders
    if (memoizedValues.isContractActive && currentBettors && currentBettors.length > 0) {
      currentBettors.forEach((bettor, index) => {
        if (index < FIXED_CARDS) { // Only fill up to 20 slots
          // Apply 0.05 TON fee deduction for internal calculations (net amount for jackpot)
          const netBetAmount = Math.max(0, bettor.amount - 0.05);
          
          // Use contract's probability calculation: (bettorAmount * 100) / totalJackpot
          const winChance = memoizedValues.totalJackpotValue > 0 ? 
            (bettor.amount * 100) / memoizedValues.totalJackpotValue : 0;
          
          playersArray.push({
            id: index + 1,
            name: bettor.username,
            avatar: '👤',
            bet: bettor.amount, // Show actual bet amount including fee
            netBet: netBetAmount, // Store net bet for calculations
            chance: winChance,
            address: bettor.address,
            isRealPlayer: true
          });
        }
      });
    }
    
    // Fill remaining slots with waiting placeholders
    while (playersArray.length < FIXED_CARDS) {
      playersArray.push({
        id: playersArray.length + 1,
        name: 'Waiting',
        avatar: '❓',
        bet: 0,
        netBet: 0,
        chance: 0,
        isRealPlayer: false
      });
    }
    
    return playersArray;
  }, [currentBettors, memoizedValues.totalJackpotValue, memoizedValues.isContractActive]); // Recalculate when bettors change or jackpot changes

  // Memoized extended players for slot machine
  const extendedPlayers = useMemo(() => {
    const extended = [];
    for (let i = 0; i < 20; i++) {
      extended.push(...players);
    }
    return extended;
  }, [players]);

  // Function to spin to a specific winner (moved up and wrapped in useCallback)
  const startSpinToWinner = useCallback((targetWinner) => {
    if (isSpinning) return;
    
    console.log('🎰 Starting spin animation to winner:', targetWinner.name);
    
    setPredeterminedWinner(targetWinner);
    setIsSpinning(true);
    setWinner(null);
    
    // Calculate precise stopping position for the target winner
    const currentCardWidth = window.innerWidth <= 480 ? 120 : 150;
    const gap = window.innerWidth <= 480 ? 15 : 20;
    const cardPlusGap = currentCardWidth + gap;
    const centerOffset = (window.innerWidth / 2) - (cardPlusGap / 2) - 25;
    const winnerIndex = players.findIndex(p => 
      p.address === targetWinner.address || p.name === targetWinner.name
    );
    
    if (winnerIndex === -1) {
      console.error('Winner not found in players array');
      return;
    }
    
    const baseSpins = 2;
    const targetCardPosition = winnerIndex * cardPlusGap;
    const targetPosition = (baseSpins * 20 * cardPlusGap) + targetCardPosition + centerOffset; // Use fixed 20 cards
    
    setReelOffset(targetPosition);
    
    console.log('🎯 Animation targeting winner:', targetWinner.name, 'at position:', winnerIndex);
    
    // Stop spinning after 3 seconds and show winner
    setTimeout(() => {
      setIsSpinning(false);
      setWinner(targetWinner);
      setPredeterminedWinner(null);
      
      // Winner notification is now handled by App.js via socket events
      
      // Clear local winner after 8 seconds (allow full display)
      setTimeout(() => {
        setWinner(null);
      }, 8000);
    }, 3000);
  }, [isSpinning, players]);

  // Reset local state when new round starts (only track round number changes)
  const [lastRoundNumber, setLastRoundNumber] = useState(null);
  
  useEffect(() => {
    const currentRoundNumber = contractState?.timer?.roundNumber;
    
    // Only reset when round number actually changes (indicating a new round)
    if (currentRoundNumber && currentRoundNumber !== lastRoundNumber) {
      console.log(`🔄 New round detected: ${lastRoundNumber} → ${currentRoundNumber}`);
      
      // Reset all local game state for new round (winner states managed by App.js)
      setIsSpinning(false);
      setReelOffset(0);
      setWinner(null);
      setPredeterminedWinner(null);
      
      setLastRoundNumber(currentRoundNumber);
    }
  }, [contractState?.timer?.roundNumber, lastRoundNumber]); // Removed unnecessary dependencies

  // DISABLED: Legacy winner animation system - now handled by App.js carousel animation
  // useEffect(() => {
  //   // If we have a winner from the backend and we're not already spinning
  //   if (contractWinner && !isSpinning && !winner) {
  //     console.log('🎯 Starting spin animation for contract winner:', contractWinner);
  //     
  //     // Find winner in current players
  //     const targetWinner = players.find(p => 
  //       p.address === contractWinner.address || 
  //       p.name === contractWinner.name ||
  //       p.name === contractWinner.username
  //     );
  //     
  //     if (targetWinner) {
  //       startSpinToWinner(targetWinner);
  //     } else {
  //       console.warn('Winner not found in players:', contractWinner);
  //     }
  //   }
  // }, [contractWinner, isSpinning, winner, players, startSpinToWinner]); // Fixed dependencies

  // Persistent animation that doesn't restart on user changes
  useEffect(() => {
    let lastTimestamp = 0;
    
    const animate = (timestamp) => {
      // Only animate if conditions are met (using refs to avoid dependencies)
      if (!isSpinningRef.current && !winnerRef.current) {
        // Calculate delta time for smooth 60fps animation
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        
        setReelOffset(prev => {
          const currentCardWidth = window.innerWidth <= 480 ? 120 : 150;
          const gap = window.innerWidth <= 480 ? 15 : 20;
          const cardPlusGap = currentCardWidth + gap;
          
          // Smooth movement at 1.2 pixels per frame (60fps = 72px/sec)
          const speed = Math.max(0.5, deltaTime / 16.67 * 1.2); // Normalize to 60fps
          const newOffset = prev + speed;
          const fullCycleWidth = 20 * cardPlusGap;
          
          // Reset to 0 when full cycle is complete for seamless loop
          if (newOffset >= fullCycleWidth) {
            return newOffset - fullCycleWidth;
          }
          return newOffset;
        });
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // selectWeightedWinner function removed - unused

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Monitor bet confirmation polling status
  useEffect(() => {
    // Set up a global handler for bet confirmation updates
    window.updateBetConfirmationStatus = (status) => {
      // Function removed since betConfirmationStatus was removed
    };

    // Set up a global handler for transaction notifications
    window.showTransactionNotification = (message, type = 'success') => {
      setTransactionNotification({
        show: true,
        message: message,
        type: type
      });
      
      // Auto-hide after 4 seconds
      setTimeout(() => {
        setTransactionNotification({
          show: false,
          message: '',
          type: 'success'
        });
      }, 4000);
    };

    return () => {
      delete window.updateBetConfirmationStatus;
      delete window.showTransactionNotification;
    };
  }, []);

  // Sync timer once and start local countdown
  useEffect(() => {
    const currentRoundId = contractState?.currentRound?.roundNumber || contractState?.timer?.roundNumber;
    const backendTimer = contractState?.timer?.timeRemaining ?? timeRemaining;
    
    // Only sync if we have new round data or timer data changed significantly
    const needsSync = !lastSyncRef.current || 
                     lastSyncRef.current.roundId !== currentRoundId ||
                     (backendTimer > 0 && Math.abs(backendTimer - localTimer) > 10);
    
    if (needsSync && backendTimer > 0) {
      console.log('⏰ Syncing timer:', backendTimer, 'seconds');
      setLocalTimer(backendTimer);
      lastSyncRef.current = {
        roundId: currentRoundId,
        timer: backendTimer,
        timestamp: Date.now()
      };
    }
  }, [contractState?.currentRound?.roundNumber, contractState?.timer?.roundNumber, contractState?.timer?.timeRemaining, timeRemaining, localTimer]);

  // Local countdown timer (runs every second)
  useEffect(() => {
    if (localTimer <= 0) return;

    const interval = setInterval(() => {
      setLocalTimer(prev => {
        const newTime = Math.max(0, prev - 1);
        if (newTime === 0) {
          console.log('⏰ Timer reached zero');
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [localTimer]);

  return (
    <div className="game-area">
      {/* Jackpot Section */}
      <div className="jackpot-section">
        <div className="jackpot-header">
          <h2>⚡ JACKPOT</h2>
          <span className="player-count">{totalPlayers}</span>
          {adminInfo?.isAutoManaged && (
            <span className="automation-badge">🤖 AUTO</span>
          )}
        </div>
        <p className="jackpot-subtitle">
          {gameStatus}
        </p>
        
        <div className="bet-controls">
          <div className="bet-amount-display">
            <span className="bet-amount-value">{betAmount?.toFixed(1) || '0.0'}</span>
            <span className="currency-label">TON</span>
          </div>
          <div className="bet-buttons">
            <button className="bet-preset" onClick={() => onBetChange({ target: { value: '0.11' } })}>0.11</button>
            <button className="bet-preset" onClick={() => onBetChange({ target: { value: '0.5' } })}>0.5</button>
            <button className="bet-preset" onClick={() => onBetChange({ target: { value: '1.0' } })}>1.0</button>
            <button className="bet-preset" onClick={() => onBetChange({ target: { value: '2.0' } })}>2.0</button>
          </div>
          <button 
            className="bet-button" 
            onClick={onPlaceBet}
            disabled={!isConnected || !memoizedValues.isContractActive || !isLive || isLoading || isSpinning || waitingForWinner || postWinnerLoading}
          >
            {!memoizedValues.isContractActive ? '⏸️ Paused' :
             isSpinning ? '🎰 Spinning...' :
             waitingForWinner ? '🎯 Selecting...' :
             postWinnerLoading ? '🔄 New Round...' :
             isConnected ? 'Bet' : 'Connect Wallet'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card jackpot-value">
          <div className="stat-icon">🎰</div>
          <div className="stat-amount">{totalJackpotValue.toFixed(3)}</div>
          <div className="stat-label">Total Jackpot</div>
        </div>
        
        <div className="stat-card net-payout">
          <div className="stat-icon">💰</div>
          <div className="stat-amount">{winnerPrizeValue.toFixed(3)}</div>
          <div className="stat-label">Winner Gets (95%)</div>
        </div>
        
        <div className="stat-card your-wager">
          <div className="stat-icon">🎯</div>
          <div className="stat-amount">
            {playerStats.yourWager.toFixed(3)}
          </div>
          <div className="stat-label">Your Wager</div>
        </div>
        
        <div className="stat-card your-chance">
          <div className="stat-amount">
            {playerStats.yourChance.toFixed(2)}%
          </div>
          <div className="stat-label">Your Chance</div>
        </div>
        
        <div className="stat-card time-remaining">
          <div className="stat-amount">{formatTime(displayTimer)}</div>
          <div className="stat-label">
            {contractState?.timer?.isActive ? 'Auto Timer' : 'Time Remaining'}
          </div>
        </div>
      </div>

      {/* Winner Arrow */}
      <div className="winner-arrow-container">
        <div className="winner-arrow">
          <div className="arrow">▼</div>
        </div>
      </div>

      {/* Slot Machine */}
      <div className="slot-machine">
        <div className="slot-frame">
          <div className="slot-reel-container">
            <div 
              className={`slot-reel ${isSpinning ? 'slot-spinning' : 'idle'}`}
              style={{ 
                transform: `translateX(${-reelOffset}px)`,
                willChange: 'transform'
              }}
            >
              {extendedPlayers.map((player, index) => {
                // Check if this player is the winner from App.js (contractWinner)
                const isCurrentWinner = contractWinner && (
                  (player.address && (player.address === contractWinner.winner || player.address === contractWinner.fullAddress)) ||
                  (player.fullAddress && (player.fullAddress === contractWinner.winner || player.fullAddress === contractWinner.fullAddress)) ||
                  (player.username && player.username === contractWinner.username)
                );
                
                return (
                  <div key={`${player.id}-${index}`} className="slot-card">
                    <PlayerSlot 
                      player={player} 
                      isWinner={isCurrentWinner}
                      isPredetermined={predeterminedWinner && predeterminedWinner.id === player.id}
                      winnerPrize={isCurrentWinner ? contractWinner.prize : null}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Slot Machine Effects */}
          {isSpinning && <div className="slot-blur"></div>}
        </div>
      </div>

      {/* Footer Info */}
      <div className="footer-info">
        <div className="payout-info">
          ⚡ Payouts are settled in TON
          {contractState?.timer?.isActive && (
            <span className="automation-info"> • 🤖 Automated rounds</span>
          )}
        </div>
        <div className="game-stats">
          <span className="players-count">👥 {totalPlayers} Players</span>
          <span className="round-number">Round #{displayRound}</span>
          {isConnected && (
            <span className="connection-status">🟢 Connected</span>
          )}
        </div>
      </div>

      {/* Contract Winner Announcement Overlay */}
      {showWinnerAnnouncement && contractWinner && (
        <div className="winner-announcement-overlay">
          <div className="winner-announcement-card">
            <div className="winner-icon">🎉</div>
            <h3>ROUND WINNER!</h3>
            <div className="winner-details">
              <div className="winner-address">{contractWinner.username || contractWinner.winner}</div>
              <div className="winner-prize">Won {contractWinner.prize} TON</div>
            </div>
            <div className="winner-confetti">🎊 🎉 🎊</div>
          </div>
        </div>
      )}

      {/* Big Loading Overlay for Winner Selection */}
      {waitingForWinner && (
        <div className="winner-selection-loading">
          <div className="winner-selection-content">
            <div className="loading-spinner-big">🎯</div>
            <h2>Selecting Winner...</h2>
            <p>Analyzing bets and picking the winner</p>
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}

      {/* Post-Winner Loading Overlay */}
      {postWinnerLoading && (
        <div className="winner-selection-loading">
          <div className="winner-selection-content">
            <div className="loading-spinner-big">🔄</div>
            <h2>Preparing New Round...</h2>
            <p>Setting up the next jackpot round</p>
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Notification */}
      {transactionNotification.show && (
        <div className={`transaction-notification ${transactionNotification.type}`}>
          {transactionNotification.message}
        </div>
      )}
    </div>
  );
}

export default GameArea; 