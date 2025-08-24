import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import GameArea from './components/GameArea';
import WalletConnection from './components/WalletConnection';
import PlayerProfile from './components/PlayerProfile';
import WinnerBroadcast from './components/WinnerBroadcast';
import Header from './components/Header';
import RecentWinners from './components/RecentWinners';
import SimpleCarousel from './components/SimpleCarousel';
import ReferralSystem from './components/ReferralSystem';
import UsernameInput from './components/UsernameInput';
import OnlineIndicator from './components/OnlineIndicator';
import ChatBubble from './components/ChatBubble';

import { TonIcon } from './components/IconComponents';
import useTelegramWebApp from './hooks/useTelegramWebApp';
import useJackpotContract from './hooks/useJackpotContract';
import useReferralAutoRegistration from './hooks/useReferralAutoRegistration';
import { DollarSign, User, Loader2, Trophy, Share2, Users, Target, Coins } from 'lucide-react';
import socketService from './services/socketService';
import winnerCoordinator from './services/winnerCoordinator';

import { uiOptions } from './config/tonconnect';
import { blockConsole, restoreConsole, blockExceptErrors } from './utils/consoleBlock';
import './App.css';
import './components/Header.css';

// TON Connect manifest URL - use remote manifest to avoid 500 errors
const manifestUrl = "https://raw.githubusercontent.com/Vodka2134156/kzsks/main/manifest.json";

function AppContent() {
  // Debug mode state
  const [debugMode, setDebugMode] = useState(false);
  
  // Global referral auto-registration
  useReferralAutoRegistration();
  
  // Local UI state
  const [currentRound, setCurrentRound] = useState(53408);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [activeTab, setActiveTab] = useState('jackpot');
  const [betAmount, setBetAmount] = useState(0.1);
  const [showWinnerAnnouncement, setShowWinnerAnnouncement] = useState(false);
  
  // Winner state management (moved from GameArea.js)
  const [waitingForWinner, setWaitingForWinner] = useState(false);
  const [contractWinner, setContractWinner] = useState(null);
  const [postWinnerLoading, setPostWinnerLoading] = useState(false);
  const [, setIsAnyWinnerDisplayActive] = useState(false);
  const [showWinnerVisually, setShowWinnerVisually] = useState(false); // Controls when winner card appears
  const [isInWinnerState, setIsInWinnerState] = useState(false); // Blocks new winner broadcasts
  
  // Username management
  const [showUsernameInput, setShowUsernameInput] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  
  // Bet loading state - tracks when user places bet until wager changes
  const [betLoadingState, setBetLoadingState] = useState({
    isWaitingForWagerChange: false,
    lastWagerAmount: 0,
    lastBalance: 0
  });
  
  // Bettors state (managed centrally to avoid duplicates)
  const [gameBettors, setGameBettors] = useState([]);
  const [previousRoundBettors, setPreviousRoundBettors] = useState([]); // Store bettors for winner matching
  const [slotSpinning, setSlotSpinning] = useState(false);
  // Note: carouselRef removed - now using Swiper component

  // Refs to avoid stale closures in socket handlers
  const gameBettorsRef = useRef([]);
  const contractWinnerRef = useRef(null);
  const showWinnerAnnouncementRef = useRef(false);
  const lastWinnerTimestampRef = useRef(null);
  const waitingForWinnerRef = useRef(false);
  const previousRoundBettorsRef = useRef([]);
  const timeRemainingRef = useRef(30);
  const showWinnerVisuallyRef = useRef(false);
  const isInWinnerStateRef = useRef(false);
  
  // Check for stored username on app load
  useEffect(() => {
    const storedUsername = localStorage.getItem('slotpot_username');
    if (storedUsername && storedUsername.trim().length >= 2) {
      setCurrentUsername(storedUsername.trim());
    }
  }, []);

  // Debug mode control
  useEffect(() => {
    if (debugMode) {
      restoreConsole();
    } else {
      blockExceptErrors(); // Block all except errors
    }
  }, [debugMode]);



  // Keep refs in sync with state
  useEffect(() => { gameBettorsRef.current = gameBettors; }, [gameBettors]);
  useEffect(() => { 
    contractWinnerRef.current = contractWinner; 
  }, [contractWinner]);
  useEffect(() => { showWinnerAnnouncementRef.current = showWinnerAnnouncement; }, [showWinnerAnnouncement]);
  useEffect(() => { waitingForWinnerRef.current = waitingForWinner; }, [waitingForWinner]);
  useEffect(() => { previousRoundBettorsRef.current = previousRoundBettors; }, [previousRoundBettors]);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);
  useEffect(() => { showWinnerVisuallyRef.current = showWinnerVisually; }, [showWinnerVisually]);
  useEffect(() => { isInWinnerStateRef.current = isInWinnerState; }, [isInWinnerState]);

  // Centralized winner announcement manager
  const showWinnerAnnouncements = useCallback((winnerData, source = 'unknown') => {
    const winnerTimestamp = winnerData.timestamp;
    
    // Block winner broadcasts if already in winner state
    if (isInWinnerStateRef.current) {
      if (process.env.NODE_ENV === 'development') {
        // console.log(`🚫 BLOCKED - Already in winner state, ignoring ${source}`);
      }
      return false;
    }
    
    // Use coordinator to check if should block (pass full winner data for better duplicate detection)
    if (winnerCoordinator.shouldBlock(winnerTimestamp, winnerData)) {
      return false;
    }
    
    // Winner sound removed for performance
    
    // Enter winner state to block future broadcasts
    setIsInWinnerState(true);
    
    // Set coordination flag via coordinator (pass full winner data)
    winnerCoordinator.setActive(true, winnerTimestamp, winnerData);
    setIsAnyWinnerDisplayActive(true);
    lastWinnerTimestampRef.current = winnerTimestamp;
    
    // Show App.js winner notification
    setContractWinner(winnerData);
    setShowWinnerAnnouncement(true);
    setWaitingForWinner(false);
    
    // Start animation - winner visual will appear after animation lands on winner
    setTimeout(() => {
      setShowWinnerVisually(true);
    }, 3000); // Give animation time to land properly
    
    return true;
  }, []);

  // Telegram integration
  const { user, hapticFeedback, showAlert, hasRealUserData } = useTelegramWebApp();

  // Smart contract integration
  const {
    contractState,
    userStats,
    adminInfo: rawAdminInfo,
    isLoadingContract,
    isPlacingBet,
    placeBet,
    isConnected,
    address,
  } = useJackpotContract();

  // SAFETY: Ensure adminInfo is always properly structured and never an object that could be rendered
  const adminInfo = useMemo(() => {
    if (!rawAdminInfo || typeof rawAdminInfo !== 'object') {
      return {
        isAutoManaged: false,
        roundDuration: 60,
        minBetsToEnd: 1,
        timerActive: false,
        timeRemaining: 0
      };
    }
    
    // Extract only primitive values to prevent accidental object rendering
    return {
      isAutoManaged: Boolean(rawAdminInfo.isAutoManaged),
              roundDuration: Number(rawAdminInfo.roundDuration) || 60,
      minBetsToEnd: Number(rawAdminInfo.minBetsToEnd) || 1,
      timerActive: Boolean(rawAdminInfo.timerActive),
      timeRemaining: Number(rawAdminInfo.timeRemaining) || 0,
      // Ensure currentRound is always a number, never an object
      currentRound: typeof rawAdminInfo.currentRound === 'object' 
        ? (rawAdminInfo.currentRound?.roundNumber || 0)
        : (Number(rawAdminInfo.currentRound) || 0)
    };
  }, [rawAdminInfo]);

  // SAFETY: Ensure contractState timer properties are never objects that could be accidentally rendered
  const safeContractState = useMemo(() => {
    if (!contractState) return contractState;
    
    return {
      ...contractState,
      // Ensure timer object properties are always primitives
      timer: contractState.timer ? {
        isActive: Boolean(contractState.timer.isActive),
        timeRemaining: Number(contractState.timer.timeRemaining) || 0,
        timeElapsed: Number(contractState.timer.timeElapsed) || 0,
        roundNumber: Number(contractState.timer.roundNumber) || 0,
        timerExpired: Boolean(contractState.timer.timerExpired)
      } : undefined,
      // Ensure currentRound is always a number if it exists
      currentRound: typeof contractState.currentRound === 'object' 
        ? (contractState.currentRound?.roundNumber || 0)
        : contractState.currentRound
    };
  }, [contractState]);

  // Use real contract data or fallback to simulated data
  const jackpotValue = contractState.totalJackpot;
  const isLive = contractState.isActive;
  
  // Calculate user stats from gameBettors data - optimized with shallow comparison
  const userBetTotal = useMemo(() => {
    if (!isConnected || !address || !gameBettors.length) return 0;
    
    return gameBettors
      .filter(bettor => 
        bettor.address === address || 
        bettor.walletAddress === address
      )
      .reduce((total, bettor) => total + (bettor.amount || 0), 0);
  }, [gameBettors.length, address, isConnected]); // Optimized dependencies
  
  const userWinChance = useMemo(() => {
    if (!isConnected || !address || userBetTotal === 0) return 0;
    
    // Calculate current round total from gameBettors for immediate updates
    const currentRoundTotal = gameBettors.reduce((total, bettor) => total + (bettor.amount || 0), 0);
    
    // Use the live total from current bettors, fallback to contract jackpot value
    const liveJackpotValue = currentRoundTotal > 0 ? currentRoundTotal : jackpotValue;
    
    if (!liveJackpotValue) return 0;
    
    return (userBetTotal / liveJackpotValue) * 100;
  }, [userBetTotal, jackpotValue, gameBettors.length, isConnected, address]); // Optimized dependencies

  // Track wager changes to determine when bet loading should stop
  useEffect(() => {
    const currentWager = userBetTotal || 0;
    const currentBalance = contractState?.userBalance || 0;
    
    // If we're waiting for wager change and the wager has changed
    if (betLoadingState.isWaitingForWagerChange) {
      const wagerChanged = Math.abs(currentWager - betLoadingState.lastWagerAmount) > 0.001;
      const balanceChanged = Math.abs(currentBalance - betLoadingState.lastBalance) > 0.001;
      
      if (wagerChanged || balanceChanged) {
        console.log('💰 Wager/Balance changed - stopping bet loading state');
        setBetLoadingState({
          isWaitingForWagerChange: false,
          lastWagerAmount: currentWager,
          lastBalance: currentBalance
        });
      }
    }
  }, [userBetTotal, contractState?.userBalance, betLoadingState.isWaitingForWagerChange, betLoadingState.lastWagerAmount, betLoadingState.lastBalance]);

  // Use automation timer or fallback to UI timer - only sync if significant difference
  useEffect(() => {
    if (contractState.timer?.timeRemaining !== undefined) {
      setTimeRemaining(prev => {
        const backendTime = contractState.timer.timeRemaining;
        const timeDiff = Math.abs(prev - backendTime);
        
        // Don't sync timer if we're analyzing bets or waiting for winner to avoid bugs
        if (waitingForWinner || isInWinnerState) {
          return prev;
        }
        
        // Only sync if difference is 5+ seconds or backend is significantly ahead
        if (timeDiff >= 5 || backendTime > prev + 2) {
          return backendTime;
        }
        
        // Keep local countdown running for smooth performance
        return prev;
      });
    } else {
      setTimeRemaining(30);
    }
  }, [contractState.timer?.timeRemaining, waitingForWinner, isInWinnerState]);

  // Local countdown timer (runs between backend updates)
  useEffect(() => {
    // Only run countdown when game is live
    if (!isLive) return;

    const countdown = setInterval(() => {
      setTimeRemaining(prev => {
        // Continue countdown even at 0 but don't go negative
        if (prev > 0) {
          const newTime = prev - 1;
          
          // Play countdown sound for final 5 seconds (more dramatic)
          if (newTime <= 5 && newTime > 0) {
            // Countdown sound removed for performance
          }
        
          // When we reach 0, trigger "analyzing bets" state locally
        if (newTime === 0) {
            // Analyze sound removed for performance
            setWaitingForWinner(true); // This will show "Analyzing Bets..."
        }
        
        return newTime;
        }
        
        // Stay at 0 once we reach it (don't go negative)
        return 0;
      });
    }, 1000);

    return () => {
      clearInterval(countdown);
    };
  }, [isLive]); // Restart when isLive changes

  // Note: Old animation useEffect removed - now using Swiper component for all carousel animations

  // Socket integration for immediate synchronization - SINGLE CONNECTION POINT
  useEffect(() => {
    // Socket connection established
    socketService.connect();

    // Listen for timer updates from socket
    socketService.on('timer', (timerData) => {
      // Timer update received
      
      // SAFETY: Ensure timerData exists and has required properties
      if (!timerData || typeof timerData !== 'object') {
        console.warn('⚠️ Invalid timer data received in App:', timerData);
        return;
      }
      
      const newTimeRemaining = typeof timerData.timeRemaining === 'number' ? timerData.timeRemaining : timeRemaining;
      const newRoundNumber = typeof timerData.roundNumber === 'number' ? timerData.roundNumber : currentRound;
      
              // Only update timeRemaining if it's significantly different (>5 seconds) or new round
        setTimeRemaining(prev => {
          const timeDiff = Math.abs(prev - newTimeRemaining);
          const isNewRound = newRoundNumber !== currentRound;
          
          // Only clear winner state when new round detected AND timer is significantly higher (real new round)
          if (isNewRound && contractWinner && newTimeRemaining > 200) {
                    // New round detected - clearing winner state
            setIsInWinnerState(false);
            setContractWinner(null);
            setShowWinnerAnnouncement(false);
            setShowWinnerVisually(false);
            setPostWinnerLoading(false);
            setIsAnyWinnerDisplayActive(false);
            setPreviousRoundBettors([]);
          }
          
          // Don't sync timer if we're analyzing bets or waiting for winner to avoid bugs
          if (waitingForWinnerRef.current || isInWinnerStateRef.current) {
            // Timer sync blocked - in analyzing/winner state
            return prev;
          }
          
          // Sync if: new round, big difference (>5s), or timer reset (server > client)
          if (isNewRound || timeDiff >= 5 || newTimeRemaining > prev + 2) {
            // Timer synced
            return newTimeRemaining;
          }
          
          // Otherwise keep local countdown running smoothly
          return prev;
        });
      
      if (newRoundNumber && newRoundNumber !== currentRound) {
        setCurrentRound(newRoundNumber);
      }
      // Note: Contract state timer will be updated via fullGameUpdate/contractStateUpdate events
    });

    // Listen for new round events
    socketService.on('newRound', (roundData) => {
      // console.log('🎰 App: New round detected via socket:', roundData);
      // console.log('🔓 Exiting winner state - new round started');
      
      setTimeRemaining(roundData.timeRemaining);
      setCurrentRound(roundData.roundNumber);
      setIsInWinnerState(false);
      setIsAnyWinnerDisplayActive(false);
      winnerCoordinator.reset();
      lastWinnerTimestampRef.current = null; // Clear duplicate protection for new round
      
      // Clear ALL winner highlighting for new round
      setContractWinner(null);
      setShowWinnerAnnouncement(false);
      setShowWinnerVisually(false);
      setPreviousRoundBettors([]);
      setWaitingForWinner(false);
      setPostWinnerLoading(false);
      
      // Note: Animation reset handled by Swiper component
    });

    // Listen for game state updates
    socketService.on('gameState', (gameState) => {
      // console.log('🎮 App: Game state update:', gameState);
      
      // Priority: Use timer.timeRemaining ONLY (as user specified)
      const backendTimeRemaining = gameState.timer?.timeRemaining;
      
      if (backendTimeRemaining !== undefined) {
        setTimeRemaining(prev => {
          const timeDiff = Math.abs(prev - backendTimeRemaining);
          
          // Don't sync timer if we're analyzing bets or waiting for winner to avoid bugs
          if (waitingForWinnerRef.current || isInWinnerStateRef.current) {
            // console.log('⏰ GameState timer sync blocked - in analyzing/winner state');
            return prev;
          }
          
          // Only sync if there's a significant difference (>=5s) or if backend is ahead
          if (timeDiff >= 5 || backendTimeRemaining > prev + 2) {
            // console.log('⏰ GameState syncing timer:', prev, '→', backendTimeRemaining, timeDiff >= 5 ? '(>=5s difference)' : '(backend ahead)');
            return backendTimeRemaining;
          }
          
          // Keep local countdown running if difference is small
          // console.log('⏰ GameState keeping local timer:', prev, 'vs backend:', backendTimeRemaining);
          return prev;
        });
      }
      if (gameState.currentRound) {
        // Extract roundNumber if currentRound is an object, otherwise use the value directly
        const roundNumber = typeof gameState.currentRound === 'object' && gameState.currentRound.roundNumber 
          ? gameState.currentRound.roundNumber 
          : gameState.currentRound;
        
        // Check if this is a new round with active timer - this means new round started
        const isNewRound = roundNumber !== currentRound;
        const hasActiveTimer = gameState.timer?.isActive || gameState.timer?.timeRemaining > 60;
        
        if (isNewRound && hasActiveTimer && isInWinnerStateRef.current) {
                  // console.log('🔄 GameState detected NEW ROUND with active timer - clearing winner state');
        // console.log('🔓 Exiting winner state - new round started via gameState');
          setIsInWinnerState(false);
          setContractWinner(null);
          setShowWinnerAnnouncement(false);
          setShowWinnerVisually(false);
          setPostWinnerLoading(false);
          setIsAnyWinnerDisplayActive(false);
          // Don't clear previousRoundBettors immediately - let carousel finish its animation
          setTimeout(() => {
            // console.log('🔄 Delayed clearing of previous round bettors');
            setPreviousRoundBettors([]);
          }, 2000); // Give carousel time to finish
          winnerCoordinator.reset();
        }
        
        setCurrentRound(roundNumber);
      }
      
      // Handle winner-related states
      if (gameState.isWaitingForWinner !== undefined) {
        // If transitioning TO waiting for winner, store current bettors
        if (gameState.isWaitingForWinner && !waitingForWinnerRef.current && gameBettorsRef.current.length > 0) {
          // console.log('🎮 App: Transitioning to waiting for winner, storing bettors:', gameBettorsRef.current);
          
          // Enhance bettors with proper usernames before storing
          const enhancedBettors = gameBettorsRef.current.map(bettor => ({
            ...bettor,
            username: bettor.username || bettor.displayName || `Player_${bettor.address?.slice(-4)}`,
            displayName: bettor.displayName || bettor.username || `Player_${bettor.address?.slice(-4)}`
          }));
          
          setPreviousRoundBettors(enhancedBettors);
        }
        
        setWaitingForWinner(gameState.isWaitingForWinner);
        
        // If waitingForWinner becomes false AND we have a new round with active timer, reset winner state
        if (!gameState.isWaitingForWinner && isInWinnerStateRef.current) {
          const roundNumber = typeof gameState.currentRound === 'object' && gameState.currentRound.roundNumber 
            ? gameState.currentRound.roundNumber 
            : gameState.currentRound;
          const isNewRound = roundNumber && roundNumber !== currentRound;
          const hasActiveTimer = gameState.timer?.isActive || gameState.timer?.timeRemaining > 60;
          
          if (isNewRound && hasActiveTimer) {
                    // console.log('🔄 waitingForWinner false + new round + active timer = new round started - clearing winner state');
        // console.log('🔓 Exiting winner state - new round confirmed');
            setIsInWinnerState(false);
            setContractWinner(null);
            setShowWinnerAnnouncement(false);
            setShowWinnerVisually(false);
            setPostWinnerLoading(false);
            setIsAnyWinnerDisplayActive(false);
            // Don't clear previousRoundBettors immediately - let carousel finish its animation
            setTimeout(() => {
              // console.log('🔄 Delayed clearing of previous round bettors (waitingForWinner)');
              setPreviousRoundBettors([]);
            }, 2000); // Give carousel time to finish
            winnerCoordinator.reset();
          } else {
            // console.log('⏳ waitingForWinner became false, but keeping winner state (no new round detected)');
          }
        }
      }
      
      // Update bettors data centrally (avoids duplicate processing)
      if (gameState.bettors && Array.isArray(gameState.bettors)) {
        // Only log if bettors count changed to reduce spam
        if (gameState.bettors.length !== gameBettorsRef.current.length) {
          // console.log('🎮 App: Updating bettors from gameState:', gameState.bettors.length, 'bettors');
          
          // Play bet sound when new bettor joins (if count increased)
          if (gameState.bettors.length > gameBettorsRef.current.length) {
            // Bet sound removed for performance
          }
          
          // Trigger slot machine animation when new bettor joins
          setSlotSpinning(true);
          setTimeout(() => setSlotSpinning(false), 3000);
        }
        
        // Store current bettors as previous round bettors when waiting for winner
        if (gameState.isWaitingForWinner && gameState.bettors.length > 0) {
          console.log('🎮 App: Storing bettors for winner matching:', gameState.bettors);
          
          // Enhance bettors with proper usernames before storing
          const enhancedBettors = gameState.bettors.map(bettor => ({
            ...bettor,
            username: bettor.username || bettor.displayName || `Player_${bettor.address?.slice(-4)}`,
            displayName: bettor.displayName || bettor.username || `Player_${bettor.address?.slice(-4)}`
          }));
          
          setPreviousRoundBettors(enhancedBettors);
        }
        
        setGameBettors(gameState.bettors);
      }
      
      // Check for winner announcement in game state (prevent duplicates with stronger protection)
      if (gameState.winnerAnnouncement) {
        showWinnerAnnouncements(gameState.winnerAnnouncement, 'gameState');
      }
    });

    // Listen for comprehensive game data updates
    socketService.on('fullGameUpdate', (gameData) => {
      //console.log('🎮 App: Full game update:', gameData);
      // These updates will trigger re-renders via useJackpotContract hook
      // The hook will detect the changes and update accordingly
    });

    // Listen for bettors updates
    socketService.on('bettorsUpdate', (data) => {
      // Bet sound removed for performance
      
      // Trigger slot machine animation on bettor updates
      setSlotSpinning(true);
      setTimeout(() => setSlotSpinning(false), 3000);
      // Force a refresh of contract state to sync with socket data
      // This ensures jackpot value and user stats stay in sync
    });

    // Listen for waiting for winner events
    socketService.on('waitingForWinner', (data) => {
      console.log('🎯 App: Waiting for winner state changed:', data);
      
      // Handle both old boolean format and new object format
      const isWaiting = typeof data === 'boolean' ? data : data.isWaiting;
      const message = typeof data === 'object' ? data.message : null;
      
      // Don't reset winner state just because waitingForWinner changed
      // Only reset when we get explicit newRound/roundReset events
      setWaitingForWinner(isWaiting);
      
      // Log but don't auto-reset winner state
      if (!isWaiting && isInWinnerStateRef.current) {
        console.log('⏳ waitingForWinner event became false, but keeping winner state until explicit new round');
      }
      
      if (message) {
        console.log('🎯 App: Winner selection message:', message);
      }
    });

    // Listen for winner announcements (primary)
    socketService.on('winner', (winnerData) => {
      console.log('🏆 App: Winner announced:', winnerData);

      console.log('🏆 App: Previous round bettors for comparison:', previousRoundBettors);
      setWaitingForWinner(false);
      setPostWinnerLoading(true);
      
      // Use centralized manager
      showWinnerAnnouncements(winnerData, 'winner event');
    });

    // Listen for direct winner announcements (fallback/reliable delivery)
    socketService.on('winnerAnnouncement', (winnerData) => {
      console.log('🎯 App: Direct winner announcement:', winnerData);
      setWaitingForWinner(false);
      
      // Use centralized manager
      showWinnerAnnouncements(winnerData, 'direct announcement');
    });

    // Listen for round reset events (when timer is reset due to no bettors)
    socketService.on('roundReset', (resetData) => {
      

      
      // Reset timer to the new duration
      setTimeRemaining(resetData.timeRemaining);
      setCurrentRound(resetData.roundNumber);
      
      // Clear ALL winner states since this is a fresh timer
      setIsInWinnerState(false);
      setWaitingForWinner(false);
      setContractWinner(null);
      setShowWinnerAnnouncement(false);
      setShowWinnerVisually(false);
      setPostWinnerLoading(false);
      setIsAnyWinnerDisplayActive(false);
      winnerCoordinator.reset();
      
      // Clear bettors list since round was reset
      setGameBettors([]);
      // Don't clear previousRoundBettors immediately on reset - let any ongoing animation finish
      setTimeout(() => {

        setPreviousRoundBettors([]);
      }, 1000);
      
      // Note: Animation reset handled by Swiper component
    });

    return () => {
      console.log('🔌 App.js: Cleaning up socket listeners...');
      socketService.off('timer');
      socketService.off('newRound');
      socketService.off('roundReset');
      socketService.off('gameState');
      socketService.off('fullGameUpdate');
      socketService.off('bettorsUpdate');
      socketService.off('waitingForWinner');
      socketService.off('winner');
      socketService.off('winnerAnnouncement');
      // Disconnect when app unmounts to prevent memory leaks
      socketService.disconnect();
    };
  }, [currentRound, showWinnerAnnouncements]); // Added missing dependencies

  const handleBetChange = (e) => {
    const inputValue = e.target.value;
    
    // Allow empty input or numbers with decimal points (both . and ,)
    if (inputValue === '' || inputValue === '.' || inputValue === ',' || /^\d*[.,]?\d*$/.test(inputValue)) {
      // Convert comma to period for consistency
      const normalizedValue = inputValue.replace(',', '.');
      
      // For empty or just "." input, keep the raw value but show comma if user typed comma
      if (normalizedValue === '' || normalizedValue === '.') {
        setBetAmount(inputValue); // Keep original input (might be comma)
        return;
      }
      
      // For valid numbers, check limits but preserve decimal typing
      const numericValue = parseFloat(normalizedValue);
      if (!isNaN(numericValue) && numericValue <= 10) {
        setBetAmount(normalizedValue); // Use normalized value to ensure consistency
      }
    }
  };

  const handleTabChange = (tab) => {
    hapticFeedback('light');
    setActiveTab(tab);
  };

  // Enhanced bet placement with real smart contract
  const handlePlaceBet = async () => {
    // Prevent betting during winner display period
    if (contractWinner || showWinnerAnnouncement) {
      showAlert('⏳ Please wait for the new round to start before placing a bet!');
      return;
    }

    if (!isConnected) {
      showAlert('Please connect your wallet first!');
      return;
    }

    // Convert comma to period before parsing for validation
    const normalizedBetAmount = betAmount.toString().replace(',', '.');
    const numericBetAmount = parseFloat(normalizedBetAmount);
    
    if (isNaN(numericBetAmount) || numericBetAmount <= 0) {
      showAlert('Please enter a valid bet amount!');
      return;
    }

    try {
      hapticFeedback('medium');
      
      await placeBet(numericBetAmount);
      
      // Bet sound removed for performance
      // Set loading state to wait for wager/balance change
      setBetLoadingState({
        isWaitingForWagerChange: true,
        lastWagerAmount: userBetTotal || 0,
        lastBalance: contractState?.userBalance || 0
      });
      
      // Reset bet amount after successful bet
      setBetAmount(0.1);
      
      hapticFeedback('success');
      showAlert(`✅ Bet of ${numericBetAmount.toFixed(3)} TON placed successfully!`);
    } catch (error) {
      hapticFeedback('error');
      showAlert(`❌ Failed to place bet: ${error.message}`);
    }
  };

  return (
    <div className="app">
        <div className="app-container">
          {/* Fixed Chat Bubble */}
          <ChatBubble telegramGroupUrl="https://t.me/yumeonton" />
          
          {/* Main Content */}
          <div className="main-content">
            {activeTab === 'profile' ? (
              <div className="profile-container">
                <Header 
                  currentUsername={currentUsername}
                  onShowUsernameInput={() => setShowUsernameInput(true)}
                  isConnected={isConnected}
                />
                <PlayerProfile />
              </div>
            ) : activeTab === 'referrals' ? (
              <div className="referrals-container">
                <Header 
                  currentUsername={currentUsername}
                  onShowUsernameInput={() => setShowUsernameInput(true)}
                  isConnected={isConnected}
                />
                <ReferralSystem />
              </div>
                          ) : (
                <div className="jackpot-container">
                  {/* Online Indicator - Just above header */}
                 
                  
                  <Header 
                    currentUsername={currentUsername}
                    onShowUsernameInput={() => setShowUsernameInput(true)}
                    isConnected={isConnected}
                    debugMode={debugMode}
                    onToggleDebug={() => setDebugMode(!debugMode)}
                  />
            <>
            {/* Betting Section */}
            <div className="betting-section">
              <div className="bet-input-section">
                <input 
                  type="text" 
                  className="bet-amount-input" 
                  value={betAmount}
                  onChange={handleBetChange}
                  placeholder="0.000"
                  inputMode="decimal"
                />
                <button className="bet-increment-btn" onClick={() => setBetAmount(prev => {
                  const currentValue = parseFloat(prev) || 0;
                  return Math.min(currentValue + 0.1, 10).toFixed(1);
                })}>
                  +0.1
          </button>
              </div>
              
              {/* Balance Section */}
              <div className="balance-section">
                <div className="balance-label">Balance</div>
                <div className="balance-amount">
                  {isConnected ? `${(contractState.userBalance || 0).toFixed(6)}` : '0.000000'}
                  <span className="balance-symbol">TON</span>
                </div>
              </div>
              
          <button 
                className="bet-button" 
                onClick={handlePlaceBet}
                disabled={isPlacingBet || betLoadingState.isWaitingForWagerChange || !isConnected || contractWinner || showWinnerAnnouncement || isLoadingContract}
          >
                {contractWinner || showWinnerAnnouncement ? 'Winner Display - Wait for New Round' :
                 isPlacingBet ? 'Betting...' :
                 betLoadingState.isWaitingForWagerChange ? 'Processing Bet...' :
                 isLoadingContract ? 'Loading...' : 'Bet'}
          </button>
        </div>

            {/* Four Card Stats Grid */}
            <div className="stats-grid four-cards">
              <div className="stat-card jackpot-card">
                <div className="stat-value">
                  <TonIcon size={14} className="wager-ton-icon" />
                  {jackpotValue.toFixed(3)}
                </div>
                <div className="stat-label">Jackpot Value</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  <TonIcon size={14} className="wager-ton-icon" />
                  {userBetTotal.toFixed(3)}
                </div>
                <div className="stat-label">Your Wager</div>
              </div>
              <div className="stat-card chance-stat">
                <div className="stat-value">{userWinChance.toFixed(2)}%</div>
                <div className="stat-label">Your Chance</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {Math.floor((timeRemaining || 0) / 60)}:{((timeRemaining || 0) % 60).toString().padStart(2, '0')}
                </div>
                <div className="stat-label">Time Remaining</div>
              </div>
            </div>

            {/* Players Carousel Section */}
            <div className="players-carousel-section">
              <div className={`carousel-header ${
                (timeRemaining === 0 && waitingForWinner) || (contractWinner && !showWinnerVisually) ? 'analyzing' : 
                showWinnerVisually ? 'winner' : ''
              }`}>
                <h3>
                  {(timeRemaining === 0 && waitingForWinner) || (contractWinner && !showWinnerVisually) ? 
                    "🔍 Analyzing Bets..." : 
                    showWinnerVisually && contractWinner ? 
                    `🏆 Winner: ${contractWinner.username || contractWinner.displayName || contractWinner.winnerName || `Player_${contractWinner.winner?.slice(-4)}` || 'Player'}` :
                    `Players (${gameBettors.length > 0 ? gameBettors.length : previousRoundBettors.length})`
                  }
                </h3>
              </div>
              
              {/* NEW: Simple Swiper Carousel */}
              <SimpleCarousel 
                players={(() => {
                  // Same data logic as before
                  const bettorsToShow = (contractWinner || waitingForWinner) ? 
                                       previousRoundBettors.length > 0 ? previousRoundBettors : gameBettors :
                                       gameBettors.length > 0 ? gameBettors : [];
                  
                  // Ensure we have at least 6 items to show (fill with waiting slots if needed)
                  return [
                    ...bettorsToShow,
                    ...Array.from({ length: Math.max(0, 6 - bettorsToShow.length) }, () => null)
                  ];
                })()}
                contractWinner={contractWinner}
                isSpinning={(timeRemaining === 0 && waitingForWinner) || (contractWinner && !showWinnerVisually)}
                                  onSpinComplete={() => {
                    // Winner animation completed
                    // Winner is already set via showWinnerVisually
                  }}
              />
        </div>
        
        {/* Bets Deflate Section */}
        <div className="bets-deflate-section">
          <div className="bets-deflate-header">
            <h3>Current Round Bets</h3>
            <div className="round-info">
              <span>#{currentRound}</span>
            </div>
          </div>
          
          <div className="bets-deflate-list">
            {(() => {
              const bettorsToShow = (contractWinner || waitingForWinner) ? 
                                   previousRoundBettors.length > 0 ? previousRoundBettors : gameBettors :
                                   gameBettors.length > 0 ? gameBettors : [];
              
                             return bettorsToShow.map((bettor, index) => {
                 const betAmount = parseFloat(bettor.amount || 0);
                 const currentJackpot = parseFloat(jackpotValue || 0);
                 const chance = currentJackpot > 0 ? ((betAmount / currentJackpot) * 100).toFixed(2) : '0.00';
                 const usdValue = (betAmount * 2.5).toFixed(1); // Approximate USD value
                
                return (
                  <div key={`${bettor.address}-${index}`} className="bet-deflate-card">
                    <div className="bet-deflate-avatar">
                      <div className="avatar-icon">
                        <Users size={20} />
                      </div>
                      <div className="avatar-count">1</div>
                    </div>
                    
                    <div className="bet-deflate-info">
                      <div className="bet-deflate-username">
                        {bettor.username || bettor.displayName || bettor.winner || `Player_${bettor.address.slice(-4)}`}
                      </div>
                      <div className="bet-deflate-amount">
                        <TonIcon size={16} className="bet-deflate-ton-icon" />
                        <span>{betAmount.toFixed(3)}</span>
                        <div className="bet-deflate-usd">~${usdValue}</div>
                      </div>
                    </div>
                    
                    <div className="bet-deflate-chance">
                      <div className="chance-label">
                        <Target size={12} />
                        <span>Chance</span>
                      </div>
                      <div className="chance-value">{chance}%</div>
                    </div>
                  </div>
                );
              });
            })()}
            
            {(() => {
              const bettorsToShow = (contractWinner || waitingForWinner) ? 
                                   previousRoundBettors.length > 0 ? previousRoundBettors : gameBettors :
                                   gameBettors.length > 0 ? gameBettors : [];
              
              if (bettorsToShow.length === 0) {
                return (
                  <div className="bet-deflate-empty">
                    <div className="empty-icon">
                      <Coins size={32} />
                    </div>
                    <div className="empty-text">No bets yet</div>
                    <div className="empty-subtext">Be the first to place a bet!</div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
        
        {/* Recent Winners Section */}
        <RecentWinners />
        
            </>
              </div>
            )}
      </div>

      {/* Mobile Navigation Bar */}
      <div className="mobile-navbar">
        <div className="navbar-items">
          <button 
            className={`navbar-item ${activeTab === 'jackpot' ? 'active' : ''}`}
            onClick={() => setActiveTab('jackpot')}
          >
            <div className="navbar-icon"><DollarSign size={20} /></div>
            <div className="navbar-label">Jackpot</div>
          </button>
          
          <button 
            className={`navbar-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <div className="navbar-icon"><User size={20} /></div>
            <div className="navbar-label">Profile</div>
          </button>
          
          <button 
            className={`navbar-item ${activeTab === 'referrals' ? 'active' : ''}`}
            onClick={() => setActiveTab('referrals')}
          >
            <div className="navbar-icon"><Share2 size={20} /></div>
            <div className="navbar-label">Referrals</div>
          </button>
        </div>
      </div>
      </div>

      {/* Contract Status Indicator */}
      {isLoadingContract && !contractWinner && !showWinnerAnnouncement && (
        <div className="loading-overlay">
          <div className="loading-spinner"><Loader2 size={24} className="animate-spin" /></div>
          <span>Loading contract data...</span>
        </div>
      )}

      {/* Winner Broadcast Component */}
      <WinnerBroadcast socketService={socketService} />
      
      {/* Username Input Modal */}
      <UsernameInput 
        isVisible={showUsernameInput}
        currentUsername={currentUsername}
        onUsernameSet={(username) => {
          setCurrentUsername(username);
          setShowUsernameInput(false);
          // Trigger a page reload to update the username everywhere
          window.location.reload();
        }}
      />
    </div>
  );
}

// Main App component with TON Connect Provider
function App() {
  return (
    <TonConnectUIProvider 
      manifestUrl={manifestUrl}
      uiPreferences={uiOptions.uiPreferences}
      language={uiOptions.language}
      restoreConnection={uiOptions.restoreConnection}
      actionsConfiguration={uiOptions.actionsConfiguration}
    >
      <AppContent />
    </TonConnectUIProvider>
  );
}

export default App; 