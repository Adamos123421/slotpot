import { useState, useEffect, useRef } from 'react';
import { jackpotContract } from '../services/jackpotContract';
import { backendApi } from '../services/backendApi';
import useTonConnect from './useTonConnect';
import useTelegramWebApp from './useTelegramWebApp';
import socketService from '../services/socketService';

// API polling removed - all data now comes via socket broadcasts

const useJackpotContract = () => {
  // Debug: Log when hook initializes (only on real initialization)
  const initRef = useRef(false);
  if (!initRef.current) {
    console.log('🔧 useJackpotContract hook initializing...');
    initRef.current = true;
  }
  
  // Contract state
  const [contractState, setContractState] = useState({
    totalJackpot: 0,
    isActive: false,
    betCount: 0,
    lastWinner: null,
    lastWinnerAddress: null,
    lastPrizeAmount: 0,
    contractBalance: 0,
    timestamp: 0,
    error: null,
    // Winner detection
    roundJustEnded: false,
    hasWinner: false,
    winnerAnnouncement: null,
    // Timer information (now integrated)
    timer: {
      isActive: false,
      timeRemaining: 0,
      timeElapsed: 0,
      roundNumber: 0
    },
    roundDuration: 300,
    bettors: []
  });

  // Current round bettors
  const [currentBettors, setCurrentBettors] = useState([]);

  // Admin info now comes via socket in contract state

  // User-specific state
  const [userStats] = useState({
    betAmount: 0,
    winningProbability: 0,
    winChancePercentage: '0.00',
    loading: false,
    error: null
  });

  // Loading states
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isLoadingContract, setIsLoadingContract] = useState(true);

  // Essential refs for hook functionality
  const prevIsActiveRef = useRef(contractState.isActive);
  const socketInitializedRef = useRef(false);

  // Get wallet connection status
  const { 
    isConnected, 
    address, 
    sendTransaction, 
    isLoading: walletLoading,
    isRestoringConnection 
  } = useTonConnect();

  // Get user info for bet notifications
  const { user } = useTelegramWebApp();

  // REMOVED: All bettor and contract data now comes via socket broadcasts

  // REMOVED: All contract state now comes via socket broadcasts

  // REMOVED: All address tracking and API calls - now handled via socket broadcasts

  // User stats refresh - handled in consolidated polling system
  // Removed separate useEffect to prevent duplicate API calls
  // This fixes the issue where APIs were being called 4 times simultaneously

  // Track round changes with ref to prevent re-renders
  useEffect(() => {
    const prevIsActive = prevIsActiveRef.current;
    const currentIsActive = contractState.isActive;
    
    // Detect new round start (inactive -> active)
    // But only clear bettors if timer > 0 (actual new round, not waiting for winner)
    if (!prevIsActive && currentIsActive && contractState.timer?.timeRemaining > 0) {
      console.log('🔄 New round detected, clearing bettors list');
      setCurrentBettors([]); // Clear bettors list for new round
    }
    
    // Update ref for next comparison
    prevIsActiveRef.current = currentIsActive;
  }, [contractState.isActive, contractState.timer?.timeRemaining]);

  // REMOVED: All API polling - now handled entirely via socket broadcasts

  // Socket handling for contract state updates (prevent re-initialization)
  useEffect(() => {
    // Prevent duplicate initialization
    if (socketInitializedRef.current) {
      console.log('🔧 Hook: Socket already initialized, skipping');
      return;
    }
    
    socketInitializedRef.current = true;
    console.log('🔧 Hook: Setting up socket listeners (ONCE ONLY)');
    
    // Listen for full game updates to sync contract state
    const handleFullGameUpdate = (gameData) => {
      // Set loading to false when first data is received
      setIsLoadingContract(false);
      
      setContractState(prevState => ({
        ...prevState,
        ...gameData,
        // Ensure timer data is preserved/updated
        timer: {
          ...prevState.timer,
          ...gameData.timer,
          // Fallback to direct properties if timer object doesn't exist
          isActive: gameData.timer?.isActive ?? gameData.isActive,
          timeRemaining: gameData.timer?.timeRemaining ?? gameData.timeRemaining,
          roundNumber: gameData.timer?.roundNumber ?? gameData.currentRound?.roundNumber
        }
      }));
      
      // Update bettors if included in game data
      if (gameData.bettors && Array.isArray(gameData.bettors)) {
        console.log('🔧 Hook: Updating bettors from game data:', gameData.bettors.length, 'bettors');
        setCurrentBettors(gameData.bettors);
      }
    };

    const handleContractUpdate = (contractData) => {
      // Set loading to false when first data is received
      setIsLoadingContract(false);
      
      setContractState(prevState => ({
        ...prevState,
        ...contractData
      }));
    };

    const handleBettorsUpdate = (bettorsData) => {
      // Set loading to false when first data is received
      setIsLoadingContract(false);
      
      if (bettorsData.bettors) {
        setCurrentBettors(bettorsData.bettors);
      }
    };

    // Set up listeners (removed gameState to avoid duplicates with App.js)
    socketService.on('fullGameUpdate', handleFullGameUpdate);
    socketService.on('contractStateUpdate', handleContractUpdate);
    socketService.on('bettorsUpdate', handleBettorsUpdate);

    return () => {
      console.log('🔧 Hook: Cleaning up socket listeners');
      socketService.off('fullGameUpdate', handleFullGameUpdate);
      socketService.off('contractStateUpdate', handleContractUpdate);
      socketService.off('bettorsUpdate', handleBettorsUpdate);
      socketInitializedRef.current = false;
    };
  }, []); // Empty dependency array - only run once

  // Place a bet (sends real transaction and notifies backend)
  const placeBet = async (betAmount) => {
    console.log(`🎰 placeBet() called with amount: ${betAmount} TON`);
    
    if (!isConnected || !address) {
      throw new Error('Wallet not connected');
    }

    if (!contractState.isActive) {
      throw new Error('Jackpot is not active');
    }

    // Ensure betAmount is a number and check minimum with proper precision
    const numericBetAmount = Number(betAmount);
    if (isNaN(numericBetAmount) || numericBetAmount < 0.05) {
      throw new Error('Minimum bet is 0.05 TON');
    }

    if (numericBetAmount > 10) {
      throw new Error('Maximum bet is 10 TON');
    }

    try {
      setIsPlacingBet(true);
      console.log(`🎰 Placing bet: ${numericBetAmount} TON from ${address}`);
      console.log(`📋 Contract state: active=${contractState.isActive}, jackpot=${contractState.totalJackpot}`);

      // Build transaction for the smart contract using the contract service
      console.log(`🔧 Building transaction with opcode 0x03...`);
      const transaction = jackpotContract.buildBetTransaction(numericBetAmount, "EQDhuMbM_cT3dXuJulXmlkA12YF8k5VdpPc1UxkuEqLpCo9K");
      
      console.log(`📤 Sending transaction to contract:`, {
        contractAddress: transaction.messages[0].address,
        amount: transaction.messages[0].amount,
        payloadLength: transaction.messages[0].payload.length
      });
      
      // Send transaction via TON Connect
      const result = await sendTransaction(transaction);
      
      console.log('✅ Bet transaction sent to contract:', result);

      // Show transaction notification
      if (typeof window !== 'undefined' && window.showTransactionNotification) {
        window.showTransactionNotification(`💰 Transaction sent! Your ${betAmount} TON bet will take effect shortly.`, 'success');
      }

      // Notify backend about the bet with full user data including Telegram ID
      try {
        // Try to get the best available username
        let username;
        
        // Check if we're in Telegram WebApp and have real user data
        const isTelegramWebApp = window.Telegram?.WebApp;
        const hasRealTelegramData = user?.id && user.id !== 123456789; // Not mock data
        
        // First, try to get stored username from localStorage
        const storedUsername = localStorage.getItem('slotpot_username');
        
        if (storedUsername && storedUsername.trim().length >= 2) {
          username = storedUsername.trim();
        } else if (hasRealTelegramData && user?.displayName && user.displayName !== 'Test User') {
          username = user.displayName;
        } else if (hasRealTelegramData && user?.shortName && user.shortName !== 'Test') {
          username = user.shortName;
        } else if (hasRealTelegramData && user?.username && user.username !== 'testuser') {
          username = user.username;
        } else {
          // Create a more user-friendly fallback username
          const addressSuffix = address?.slice(-4) || 'user';
          username = `Player_${addressSuffix}`;
          
          // Log that we're using fallback username
          console.log('👤 Using fallback username because Telegram data not available:', {
            isTelegramWebApp: !!isTelegramWebApp,
            hasRealTelegramData,
            userData: user,
            storedUsername
          });
        }
        console.log('👤 Bet notification - User data:', { 
          displayName: user?.displayName, 
          shortName: user?.shortName, 
          username: user?.username,
          finalUsername: username,
          telegramId: user?.id,
          hasRealUserData: !!user?.id
        });
        
        const userData = {
          amount: numericBetAmount,
          address: address,
          username: username,
          // Include Telegram data for profile picture fetching
          telegramId: user?.id,
          firstName: user?.firstName,
          lastName: user?.lastName
        };
        
        await backendApi.notifyBetPlacement(userData);
        console.log('✅ Backend notified about bet placement with full user data:', userData);
      } catch (notifyError) {
        console.warn('⚠️ Failed to notify backend about bet:', notifyError);
        // Don't fail the whole transaction for notification errors
      }

      // Also send chat notification via socket with full user data
      try {
        // Emit socket event for chat notification with Telegram data
        socketService.emit('game:bet', { 
          amount: numericBetAmount,
          address: address,
          username: username, // Use the same username from above
          telegramId: user?.id,
          firstName: user?.firstName,
          lastName: user?.lastName
        });
        console.log('✅ Chat bet notification sent via socket with full user data');
      } catch (socketError) {
        console.warn('⚠️ Failed to send chat bet notification:', socketError);
      }

      // Backend will automatically detect the bet through contract polling
      console.log('✅ Bet sent to contract - backend will automatically detect via polling');

      // Simple success response - no bet verification polling
      console.log('✅ Bet placed successfully - relying on normal polling for updates');

      return {
        success: true,
        txHash: result.boc || 'unknown',
        amount: numericBetAmount,
        address: address
      };
    } catch (error) {
      console.error('❌ Bet placement faissled: numericBetAmount', numericBetAmount, error);
      
      // Show error notification
      if (typeof window !== 'undefined' && window.showTransactionNotification) {
        window.showTransactionNotification(`❌ Bet failed: ${error.message}`, 'error');
      }
      
      throw error;
    } finally {
      setIsPlacingBet(false);
    }
  };

  // Helper function to format address
  const formatAddress = (addr) => {
    if (!addr) return null;
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  // Helper function to format TON amounts
  const formatTonAmount = (amount) => {
    if (!amount) return '0.000';
    return parseFloat(amount).toFixed(3);
  };

  return {
    // Contract state
    contractState: {
      ...contractState,
      formattedJackpot: formatTonAmount(contractState.totalJackpot),
      formattedLastPrize: formatTonAmount(contractState.lastPrizeAmount)
    },
    
    // Admin info (now included in contract state)
    
    // User state
    userStats: {
      ...userStats,
      formattedBetAmount: formatTonAmount(userStats.betAmount)
    },
    
    // Loading states
    isPlacingBet,
    isRestoringConnection,
    walletLoading,
    isLoadingContract,
    
    // Actions
    placeBet,
    
    // Utility
    isConnected,
    address: address ? formatAddress(address) : null,
    fullAddress: address,
    
    // Backend admin controls (for emergency use only)
    emergencyControls: {
      forceStartRound: (adminKey) => backendApi.forceStartRound(adminKey),
      forceEndRound: (adminKey) => backendApi.forceEndRound(adminKey),
      updateSettings: (settings) => backendApi.updateAdminSettings(settings)
    },
    
    // Current bettors
    currentBettors
  };
};

export default useJackpotContract;