import { useState, useEffect, useCallback, useRef } from 'react';
import socketService from '../services/socketService';
import apiService from '../services/apiService';
import useTelegramWebApp from './useTelegramWebApp';

const useChat = () => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [connectionError, setConnectionError] = useState(null);
  const [serverStats, setServerStats] = useState({
    connectedUsers: 0,
    totalMessages: 0,
    serverStatus: 'Unknown',
    lastUpdated: null
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  const { user, hasRealUserData } = useTelegramWebApp();
  const typingTimeoutRef = useRef(null);
  const statsIntervalRef = useRef(null);

  // Fetch server stats from API
  const fetchServerStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const stats = await apiService.getServerStats();
      setServerStats(stats);
      
      // If we have recent messages from API and no socket messages yet, load them
      if (stats.recentMessages && stats.recentMessages.length > 0 && messages.length === 0) {
        setMessages(stats.recentMessages);
      }
    } catch (error) {
      console.error('Failed to fetch server stats:', error);
      setServerStats(prev => ({
        ...prev,
        serverStatus: 'Error',
        error: error.message
      }));
    } finally {
      setIsLoadingStats(false);
    }
  }, [messages.length]);

  // Initialize API data fetching
  useEffect(() => {
    // Fetch initial stats
    fetchServerStats();

    // Set up periodic stats updates every 30 seconds
    statsIntervalRef.current = setInterval(fetchServerStats, 30000);

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, [fetchServerStats]);

  // Initialize socket listeners (connection handled by App.js)
  useEffect(() => {
    console.log('🔌 Setting up chat listeners...');
    
    // Socket connection is handled by App.js - just set up listeners

    // Subscribe to messages
    socketService.on('chat:message', (message) => {
      setMessages(prev => {
        // Prevent duplicate messages
        const exists = prev.some(msg => msg.id === message.id);
        if (exists) return prev;
        
        return [...prev, message].slice(-50); // Keep last 50 messages
      });
      
      // Update message count in stats
      setServerStats(prev => ({
        ...prev,
        totalMessages: prev.totalMessages + 1,
        lastUpdated: new Date()
      }));
    });

    // Subscribe to connection status
    socketService.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      
      // Refresh stats when connected
      fetchServerStats();
      
      if (user) {
        // Auto-join chat when connected
        socketService.emit('user:join', {
          username: user.displayName,
          avatar: '👤',
          isPremium: user.isPremium
        });
      }
    });

    socketService.on('disconnect', () => {
      setIsConnected(false);
    });

    socketService.on('connect_error', (error) => {
      setIsConnected(false);
      setConnectionError(error || new Error('Connection failed'));
    });

    // Subscribe to typing indicators
    socketService.on('user:typing', (data) => {
      setTypingUsers(prev => {
        if (data.isTyping) {
          // Add user to typing list
          if (!prev.includes(data.username)) {
            return [...prev, data.username];
          }
          return prev;
        } else {
          // Remove user from typing list
          return prev.filter(username => username !== data.username);
        }
      });

      // Auto-remove typing indicator after 3 seconds
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(username => username !== data.username));
      }, 3000);
    });

    // Cleanup on unmount (don't disconnect - shared connection)
    return () => {
      socketService.off('chat:message');
      socketService.off('connect');
      socketService.off('disconnect');
      socketService.off('connect_error');
      socketService.off('user:typing');
      // Don't disconnect here - App.js manages the connection
    };
  }, [user, fetchServerStats]);

  // Send a message
  const sendMessage = useCallback((messageText) => {
    if (!messageText.trim() || !isConnected) {
      return false;
    }

    socketService.emit('chat:message', { message: messageText });
    
    // Stop typing indicator
    setIsTyping(false);
    socketService.emit('user:typing', { isTyping: false });
    
    return true;
  }, [isConnected]);

  // Handle typing indicators
  const handleTyping = useCallback((typing) => {
    if (!isConnected) return;

    setIsTyping(typing);
    socketService.emit('user:typing', { isTyping: typing });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop typing after 3 seconds
    if (typing) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        socketService.emit('user:typing', { isTyping: false });
      }, 3000);
    }
  }, [isConnected]);

  // Send bet notification to chat
  const sendBetNotification = useCallback((amount) => {
    if (!isConnected) return;
    socketService.emit('game:bet', { amount });
  }, [isConnected]);

  // Reconnect to server (handled by App.js)
  const reconnect = useCallback(() => {
    setConnectionError(null);
    // App.js handles the actual reconnection
    fetchServerStats(); // Just refresh API data
  }, [fetchServerStats]);

  // Refresh server stats manually
  const refreshStats = useCallback(() => {
    fetchServerStats();
  }, [fetchServerStats]);

  // Get chat statistics
  const getChatStats = useCallback(() => {
    return {
      totalMessages: Math.max(messages.length, serverStats.totalMessages),
      isConnected,
      hasError: !!connectionError,
      typingUsersCount: typingUsers.length,
      connectedUsers: serverStats.connectedUsers,
      serverStatus: serverStats.serverStatus,
      lastUpdated: serverStats.lastUpdated,
      isLoadingStats
    };
  }, [messages.length, isConnected, connectionError, typingUsers.length, serverStats, isLoadingStats]);

  // Format message for display
  const formatMessage = useCallback((message) => {
    return {
      ...message,
      timestamp: new Date(message.timestamp),
      isOwnMessage: message.username === user?.displayName,
      formattedTime: new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  }, [user?.displayName]);

  return {
    // State
    messages: messages.map(formatMessage),
    isConnected,
    isTyping,
    typingUsers,
    connectionError,
    serverStats,
    isLoadingStats,
    
    // Actions
    sendMessage,
    handleTyping,
    sendBetNotification,
    reconnect,
    refreshStats,
    
    // Utils
    getChatStats,
    
    // Connection info
            serverUrl: 'http://localhost:5002',
    userInfo: {
      username: user?.displayName || 'Anonymous',
      isRealUser: hasRealUserData,
      isPremium: user?.isPremium || false
    }
  };
};

export default useChat; 