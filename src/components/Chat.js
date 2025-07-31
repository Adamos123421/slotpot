import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Wifi, WifiOff, RefreshCw, Users, Server } from 'lucide-react';
import useChat from '../hooks/useChat';
import './Chat.css';

const Chat = () => {
  const [newMessage, setNewMessage] = useState('');
  const [showConnectionError, setShowConnectionError] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Show connection error temporarily
  useEffect(() => {
    if (connectionError) {
      setShowConnectionError(true);
      const timer = setTimeout(() => setShowConnectionError(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [connectionError]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected) return;

    const success = sendMessage(newMessage);
    if (success) {
      setNewMessage('');
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

  const formatTypingUsers = () => {
    if (typingUsers.length === 0) return '';
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
  };

  const stats = getChatStats();

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-title">
          <MessageCircle size={18} />
          <span>Degen Chat</span>
          {!isConnected && (
            <button 
              onClick={reconnect} 
              className="reconnect-btn"
              title="Reconnect to chat"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
        <div className="chat-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          </div>
          <div className="status-info">
            <div className="connection-status">
              {isConnected ? 'Online' : 'Offline'}
            </div>
            <div className="user-count">
              <Users size={10} />
              <span>{isLoadingStats ? '...' : serverStats.connectedUsers}</span>
            </div>
          </div>
          <button 
            onClick={refreshStats} 
            className="refresh-stats-btn"
            title="Refresh server stats"
            disabled={isLoadingStats}
          >
            <Server size={12} className={isLoadingStats ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Connection Error Banner */}
      {showConnectionError && (
        <div className="connection-error">
          <span>⚠️ Connection failed. </span>
          <button onClick={reconnect} className="error-reconnect-btn">
            Reconnect
          </button>
        </div>
      )}

      {/* Server Status Info */}
      {serverStats.serverStatus && (
        <div className={`server-status-bar ${serverStats.serverStatus.toLowerCase()}`}>
          <div className="server-info">
            <span className="server-label">Server:</span>
            <span className="server-status">{serverStats.serverStatus}</span>
            {serverStats.lastUpdated && (
              <span className="last-update">
                Updated: {serverStats.lastUpdated.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
          </div>
          <div className="server-stats">
            <span>Messages: {stats.totalMessages}</span>
            <span>Users: {serverStats.connectedUsers}</span>
          </div>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && isConnected && (
          <div className="chat-empty">
            <MessageCircle size={24} />
            <p>No messages yet. Start the conversation!</p>
            <small>Connected users: {serverStats.connectedUsers}</small>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`message ${getMessageType(message)}`}>
            <div className="message-header">
              <div className="user-info">
                {message.type === 'system' ? (
                  <span className="system-label">System</span>
                ) : message.type === 'bet' ? (
                  <span className="bet-label">🎰 Bet</span>
                ) : (
                  <>
                    <span className="username">{message.username}</span>
                    <span className="user-level">{getUserLevel(message.username)}</span>
                    {message.username === userInfo.username && userInfo.isPremium && (
                      <span className="premium-badge">⭐</span>
                    )}
                  </>
                )}
              </div>
              <span className="timestamp">{message.formattedTime}</span>
            </div>
            <div className="message-content">
              {message.message}
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="typing-text">{formatTypingUsers()}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <div className="chat-input-container">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder={isConnected ? "Type Message Here..." : "Connecting..."}
            className="chat-input"
            maxLength={500}
            disabled={!isConnected}
          />
          <button 
            type="submit" 
            className="send-button" 
            disabled={!newMessage.trim() || !isConnected}
          >
            <Send size={16} />
          </button>
        </div>
      </form>

      <div className="chat-rules">
        <span>💬 Chat Rules</span>
        <span className="rules-count">{stats.totalMessages}</span>
        {userInfo.isRealUser && (
          <span className="user-badge">📱 Telegram</span>
        )}
        <span className="server-badge">
          🌐 {serverStats.serverStatus}
        </span>
      </div>
    </div>
  );
};

export default Chat; 