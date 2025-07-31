import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import useChat from '../hooks/useChat';
import './MobileChat.css';

const MobileChat = () => {
  const [newMessage, setNewMessage] = useState('');
  const [showConnectionError, setShowConnectionError] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const lastMessageCountRef = useRef(0);

  const {
    messages,
    isConnected,
    isTyping,
    typingUsers,
    connectionError,
    serverStats,
    isLoadingStats,
    sendMessage,
    handleTyping,
    reconnect,
    refreshStats,
    getChatStats,
    userInfo
  } = useChat();

  const scrollToBottom = useCallback((force = false) => {
    if (chatMessagesRef.current && (!isUserScrolling || force)) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [isUserScrolling]);

  const checkIfUserIsAtBottom = () => {
    if (!chatMessagesRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = chatMessagesRef.current;
    return scrollHeight - scrollTop - clientHeight < 50;
  };

  const handleScroll = () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    setIsUserScrolling(!checkIfUserIsAtBottom());
    
    // Clear scrolling state after 3 seconds of no scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      scrollTimeoutRef.current = null;
    }, 3000);
    
    // Clear unread count if user scrolls to bottom
    if (checkIfUserIsAtBottom()) {
      setUnreadCount(0);
    }
  };

  const handleScrollToBottomClick = () => {
    setUnreadCount(0);
    setIsUserScrolling(false);
    scrollToBottom(true);
  };

  useEffect(() => {
    // Only auto-scroll for new messages if user hasn't manually scrolled up
    // and no scroll timeout is active (meaning user isn't currently scrolling)
    const lastMessage = messages[messages.length - 1];
    const isOwnMessage = lastMessage?.isOwnMessage;
    const newMessageAdded = messages.length > lastMessageCountRef.current;
    
    if (newMessageAdded && !scrollTimeoutRef.current) {
      if (isOwnMessage) {
        // Always scroll to bottom for user's own messages
        setIsUserScrolling(false);
        scrollToBottom(true);
      } else {
        // Only scroll if user is already at bottom
        if (!isUserScrolling) {
          scrollToBottom(false);
        } else {
          // Increment unread count if user is scrolled up
          setUnreadCount(prev => prev + 1);
        }
      }
    }
    
    lastMessageCountRef.current = messages.length;
  }, [messages, isUserScrolling, scrollToBottom]);

  // Reset user scrolling state when they send a message
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1]?.isOwnMessage) {
      setIsUserScrolling(false);
      setUnreadCount(0);
    }
  }, [messages]);

  // Show connection error temporarily
  useEffect(() => {
    if (connectionError) {
      setShowConnectionError(true);
      const timer = setTimeout(() => setShowConnectionError(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [connectionError]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected) return;

    const success = sendMessage(newMessage);
    if (success) {
      setNewMessage('');
      setIsUserScrolling(false); // Ensure we scroll to bottom after sending
      inputRef.current?.focus();
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Send typing indicator
    if (value.trim() && !isTyping) {
      handleTyping(true);
    } else if (!value.trim() && isTyping) {
      handleTyping(false);
    }
  };

  const handleInputBlur = () => {
    // Stop typing when input loses focus
    if (isTyping) {
      handleTyping(false);
    }
  };

  const getMessageType = (message) => {
    if (message.type === 'system') return 'system';
    if (message.type === 'bet') return 'bet';
    if (message.isOwnMessage) return 'own';
    return 'user';
  };

  const getUserLevel = (username) => {
    // Generate consistent level based on username
    const hash = username.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    return (hash % 50) + 1;
  };

  const generateAvatar = (name) => {
    const colors = ['#8b5cf6', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
    const colorIndex = name.charCodeAt(0) % colors.length;
    
    return (
      <div 
        className="generated-avatar-mobile"
        style={{ backgroundColor: colors[colorIndex] }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const formatTypingUsers = () => {
    if (typingUsers.length === 0) return '';
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
  };

  const stats = getChatStats();

  return (
    <div className="mobile-chat-container">
      {/* Chat Header */}
      <div className="mobile-chat-header">
        <div className="chat-title-section">
          <div className="chat-icon">💬</div>
          <div className="chat-info">
            <span className="chat-title">Degen Chat</span>
            <div className="chat-status">
              <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}>
                {isConnected ? <Wifi size={8} /> : <WifiOff size={8} />}
              </div>
              <span className="online-count">
                {isLoadingStats ? '...' : serverStats.connectedUsers}
              </span>
            </div>
          </div>
        </div>
        <div className="mobile-header-controls">
          <button 
            onClick={refreshStats} 
            className="refresh-btn-mobile"
            title="Refresh"
            disabled={isLoadingStats}
          >
            <RefreshCw size={12} className={isLoadingStats ? 'spinning' : ''} />
          </button>
          {!isConnected && (
            <button 
              onClick={reconnect} 
              className="reconnect-btn-mobile"
              title="Reconnect"
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Connection Error Banner */}
      {showConnectionError && (
        <div className="mobile-connection-error">
          <span>⚠️ Connection failed. </span>
          <button onClick={reconnect} className="error-reconnect-btn-mobile">
            Reconnect
          </button>
        </div>
      )}

      {/* Live Airdrop Section - Using real jackpot data */}
      <div className="live-airdrop-section">
        <div className="airdrop-header">
          <div className="live-indicator">
            <div className="live-dot"></div>
            <span>LIVE</span>
          </div>
          <div className="airdrop-title">JACKPOT</div>
        </div>
        <div className="airdrop-amount">
          <span className="currency-symbol">≈</span>
          <span className="amount">
            {serverStats.gameState?.jackpot?.toFixed(3) || '0.000'}
          </span>
          <Users size={16} className="users-icon" />
        </div>
      </div>

      {/* Chat Messages */}
      <div className="mobile-chat-messages" ref={chatMessagesRef} onScroll={handleScroll}>
        {messages.length === 0 && isConnected && (
          <div className="mobile-chat-empty">
            <div className="chat-icon">💬</div>
            <p>No messages yet!</p>
            <small>Start the conversation</small>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`mobile-message ${getMessageType(message)}`}>
            <div className="message-avatar">
              {generateAvatar(message.username || message.user)}
            </div>
            <div className="message-content">
              <div className="message-header">
                {message.type === 'system' ? (
                  <span className="username system">System</span>
                ) : message.type === 'bet' ? (
                  <span className="username bet">🎰 Bet</span>
                ) : (
                  <>
                    <span className="username">{message.username}</span>
                    <span className="user-level">{getUserLevel(message.username)}</span>
                    {message.username === userInfo.username && userInfo.isPremium && (
                      <span className="premium-badge-mobile">⭐</span>
                    )}
                  </>
                )}
                <span className="timestamp">{message.formattedTime}</span>
              </div>
              <div className="message-text">
                {message.message}
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="mobile-typing-indicator">
            <div className="typing-dots-mobile">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="typing-text-mobile">{formatTypingUsers()}</span>
          </div>
        )}

        <div ref={messagesEndRef} />

        {/* New Messages Indicator */}
        {isUserScrolling && unreadCount > 0 && (
          <button 
            className="new-messages-indicator"
            onClick={handleScrollToBottomClick}
          >
            <span className="new-message-count">{unreadCount}</span>
            <span className="new-message-text">new message{unreadCount > 1 ? 's' : ''}</span>
            <span className="scroll-down-arrow">↓</span>
          </button>
        )}
      </div>

      {/* Message Input */}
      <form className="mobile-message-input" onSubmit={handleSendMessage}>
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder={isConnected ? "Type Message Here..." : "Connecting..."}
          className="message-input"
          maxLength={500}
          disabled={!isConnected}
        />
        <button 
          type="submit" 
          className="send-btn" 
          disabled={!newMessage.trim() || !isConnected}
        >
          <Send size={16} />
        </button>
      </form>

      {/* Chat Footer */}
      <div className="mobile-chat-footer">
        <div className="chat-rules">
          <span>💬 Chat Rules</span>
        </div>
        <div className="user-count">
          <Users size={12} />
          <span>{stats.totalMessages}</span>
        </div>
        {userInfo.isRealUser && (
          <div className="telegram-badge-mobile">
            📱 Telegram
          </div>
        )}
        <div className="server-status-mobile">
          🌐 {serverStats.serverStatus}
        </div>
      </div>
    </div>
  );
};

export default MobileChat; 