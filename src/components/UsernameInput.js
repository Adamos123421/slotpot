import React, { useState, useEffect } from 'react';
import './UsernameInput.css';

const UsernameInput = ({ onUsernameSet, currentUsername, isVisible }) => {
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentUsername && !currentUsername.startsWith('Player_')) {
      setUsername(currentUsername);
    }
  }, [currentUsername]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || username.trim().length < 2) {
      alert('Username must be at least 2 characters long');
      return;
    }

    setIsSubmitting(true);
    try {
      // Store username in localStorage for persistence
      localStorage.setItem('slotpot_username', username.trim());
      onUsernameSet(username.trim());
    } catch (error) {
      console.error('Failed to set username:', error);
      alert('Failed to set username. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="username-input-overlay">
      <div className="username-input-modal">
        <h3>Set Your Username</h3>
        <p>Choose a username to display in the game:</p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            maxLength={20}
            disabled={isSubmitting}
            autoFocus
          />
          
          <div className="username-input-buttons">
            <button 
              type="submit" 
              disabled={isSubmitting || !username.trim()}
              className="username-submit-btn"
            >
              {isSubmitting ? 'Setting...' : 'Set Username'}
            </button>
          </div>
        </form>
        
        <p className="username-note">
          This username will be displayed in the game and leaderboards.
        </p>
      </div>
    </div>
  );
};

export default UsernameInput;
