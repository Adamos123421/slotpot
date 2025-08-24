import React from 'react';
import useOnlineCount from '../hooks/useOnlineCount';
import './OnlineIndicator.css';

const OnlineIndicator = ({ isConnected }) => {
  const { onlineCount, isLoading } = useOnlineCount();

  return (
    <div className="online-indicator">
      <div className="indicator-content">
        {isConnected ? (
          <span className="online-count">
            {isLoading ? '...' : (onlineCount || 0)}
          </span>
        ) : (
          <span className="status-text">Off</span>
        )}
      </div>
    </div>
  );
};

export default OnlineIndicator;
