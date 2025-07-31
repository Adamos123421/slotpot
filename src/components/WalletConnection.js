import React from 'react';
import { Wallet, LogOut } from 'lucide-react';
import useTonConnect from '../hooks/useTonConnect';
import useTelegramWebApp from '../hooks/useTelegramWebApp';
import './WalletConnection.css';

const WalletConnection = () => {
  const { 
    isConnected, 
    isLoading, 
    wallet, 
    connectWallet, 
    disconnectWallet
  } = useTonConnect();
  
  const { hapticFeedback, user } = useTelegramWebApp();

  const handleConnect = async () => {
    hapticFeedback('medium');
    await connectWallet();
  };

  const handleDisconnect = async () => {
    hapticFeedback('light');
    await disconnectWallet();
  };

  return (
    <div className="wallet-connection-header">
      {!isConnected ? (
        <button 
          className="connect-wallet-btn-header"
          onClick={handleConnect}
          disabled={isLoading}
        >
          <Wallet size={16} />
          {isLoading ? 'Connecting...' : 'Connect'}
        </button>
      ) : (
        <button 
          className="disconnect-btn-header"
          onClick={handleDisconnect}
          disabled={isLoading}
          title={`Connected: ${wallet?.formattedAddress}`}
        >
          <Wallet size={16} />
          {user?.username || user?.first_name || 'Connected'}
          <LogOut size={14} />
        </button>
      )}
    </div>
  );
};

export default WalletConnection; 