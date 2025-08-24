import React from 'react';
import { User } from 'lucide-react';
import WalletConnection from './WalletConnection';
import './Header.css';

const Header = ({ onShowUsernameInput, currentUsername, isConnected = true }) => {
  // Check if user has a proper username (not a fallback)
  const hasProperUsername = currentUsername && 
    currentUsername.trim().length >= 2 && 
    !currentUsername.startsWith('Player_');
  
  return (
    <div className="page-header">
      <div className="header-content">
        <div className="header-left">
          {isConnected && <img src="/logo.jpg" alt="SlotPot Logo" className="logo-image" />}
          <div className="app-title">SlotPot</div>
        </div>
        
        <div className="header-right">
          {!hasProperUsername && onShowUsernameInput && (
            <button 
              className="username-setup-btn"
              onClick={onShowUsernameInput}
              title="Set your username"
            >
              <User size={16} />
              <span>Set Username</span>
            </button>
          )}
          <WalletConnection />
        </div>
      </div>
    </div>
  );
};

export default Header;