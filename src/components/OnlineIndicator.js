import React from 'react';
import { Wifi, WifiOff, Users } from 'lucide-react';
import useOnlineCount from '../hooks/useOnlineCount';
import './OnlineIndicator.css';

const OnlineIndicator = ({ isConnected }) => {
  const { onlineCount, isLoading } = useOnlineCount();

  return (
    <div className="online-indicator">
      <div className="indicator-content">
        {isConnected ? (
          <>
            <Wifi size={16} className="wifi-icon connected" />
            <span className="online-count">
              {isLoading ? '...' : (onlineCount || 0)}
            </span>
          </>
        ) : (
          <>
            <WifiOff size={16} className="wifi-icon disconnected" />
            <span className="status-text">Off</span>
          </>
        )}
      </div>
    </div>
  );
};

export default OnlineIndicator;
