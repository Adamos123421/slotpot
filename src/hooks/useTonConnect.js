import { useState, useEffect, useCallback } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { Address } from '@ton/core';
import userService from '../services/userService';
import useTelegramWebApp from './useTelegramWebApp';

const useTonConnect = () => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [balance, setBalance] = useState(null);
  const [isRestoringConnection, setIsRestoringConnection] = useState(true);
  const { user } = useTelegramWebApp();

  // Get bounceable address using proper TON Core Address handling
  const rawAddress = tonConnectUI.account?.address;
  const address = rawAddress ? Address.parse(rawAddress).toString({ bounceable: true, urlSafe: true }) : undefined;
  
  // Handle connection restoration loading state
  useEffect(() => {
    if (rawAddress && address) {
      setIsRestoringConnection(false);
    } else if (!wallet && !tonConnectUI.account) {
      // No wallet at all - stop loading
      setIsRestoringConnection(false);
    }
  }, [wallet, tonConnectUI.account, rawAddress, address, isRestoringConnection]);

  // Timeout for restoration loading (prevent infinite loading)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isRestoringConnection) {
        setIsRestoringConnection(false);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [isRestoringConnection]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if wallet is connected and has an address
  const isConnected = !!(wallet && address);

  // Get formatted address
  const getFormattedAddress = () => {
    if (!address) return null;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get wallet info
  const getWalletInfo = () => {
    if (!wallet) return null;
    
    return {
      name: wallet.device.appName,
      address: address,
      formattedAddress: getFormattedAddress(),
      imageUrl: wallet.device.appImage || null,
      platform: wallet.device.platform
    };
  };

  // Connect wallet
  const connectWallet = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await tonConnectUI.connectWallet();
    } catch (err) {
      setError(err.message || 'Failed to connect wallet');
      console.error('Wallet connection error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    try {
      setIsLoading(true);
      await tonConnectUI.disconnect();
      setBalance(null);
    } catch (err) {
      setError(err.message || 'Failed to disconnect wallet');
      console.error('Wallet disconnect error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get wallet balance (mock for now)
  const getBalance = useCallback(async () => {
    if (!address) return null;
    
    try {
      setIsLoading(true);
      // Mock balance for testing - in production you'd call TON API
      const mockBalance = (Math.random() * 100).toFixed(2);
      setBalance(mockBalance);
      return mockBalance;
    } catch (err) {
      setError(err.message || 'Failed to get balance');
      console.error('Balance fetch error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Send transaction to smart contract
  const sendTransaction = async (transaction) => {
    if (!wallet || !address) {
      throw new Error('Wallet not connected');
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('📤 Sending transaction:', transaction);

      // Send transaction using TON Connect UI
      const result = await tonConnectUI.sendTransaction(transaction);
      
      console.log('✅ Transaction sent successfully:', result);
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Transaction failed';
      setError(errorMessage);
      console.error('❌ Transaction error:', err);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Legacy placeBet function for backward compatibility
  const placeBet = async (betAmount) => {
    try {
      console.log(`🎰 Legacy placeBet called with ${betAmount} TON`);
      
      // For development, just simulate the bet
      if (process.env.NODE_ENV === 'development') {
        console.log('🎰 Simulating bet in development mode');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        return {
          success: true,
          txHash: 'mock_tx_' + Date.now(),
          amount: betAmount
        };
      }

      // This should not be used anymore - use the contract hook instead
      throw new Error('Please use the contract hook for placing bets');
    } catch (err) {
      console.error('Bet placement error:', err);
      throw err;
    }
  };

  // Auto-refresh balance when wallet connects
  useEffect(() => {
    if (isConnected && !balance) {
      getBalance();
    }
  }, [isConnected, balance, getBalance]);

  // Register user with backend when wallet connects
  useEffect(() => {
    if (isConnected && address && user) {

      userService.registerUser(address, user, user?.referralCode || undefined);
    }
  }, [isConnected, address, user]);

  return {
    // Connection state
    isConnected,
    isLoading,
    isRestoringConnection,
    error,
    
    // Wallet info
    wallet: getWalletInfo(),
    address,
    formattedAddress: getFormattedAddress(),
    balance,
    
    // Actions
    connectWallet,
    disconnectWallet,
    getBalance,
    sendTransaction,
    placeBet, // Legacy - use contract hook instead
    
    // Utils
    setError: (err) => setError(err)
  };
};

export default useTonConnect; 