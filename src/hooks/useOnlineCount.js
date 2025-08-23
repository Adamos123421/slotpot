import { useState, useEffect } from 'react';
import socketService from '../services/socketService';

const useOnlineCount = () => {
  const [onlineCount, setOnlineCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Listen for user join/leave events to update count
    const handleUserJoined = (data) => {
      console.log('👤 User joined, updating count:', data.totalUsers);
      setOnlineCount(data.totalUsers || 0);
    };

    const handleUserLeft = (data) => {
      console.log('👤 User left, updating count:', data.totalUsers);
      setOnlineCount(data.totalUsers || 0);
    };

    // Request current count when connected
    const handleConnect = () => {
      console.log('🔌 Socket connected, requesting online count...');
      if (socketService.socket) {
        socketService.socket.emit('getOnlineCount');
      }
    };

    // Set up event listeners
    socketService.on('user:joined', handleUserJoined);
    socketService.on('user:left', handleUserLeft);
    socketService.on('connect', handleConnect);
    socketService.on('onlineCount', (data) => {
      console.log('📊 Received online count:', data);
      setOnlineCount(data.count || 0);
    });

    // Request initial count if already connected
    if (socketService.isConnected && socketService.socket) {
      socketService.socket.emit('getOnlineCount');
    }

    return () => {
      socketService.off('user:joined', handleUserJoined);
      socketService.off('user:left', handleUserLeft);
      socketService.off('connect', handleConnect);
      socketService.off('onlineCount');
    };
  }, []);

  return { onlineCount, isLoading };
};

export default useOnlineCount;
