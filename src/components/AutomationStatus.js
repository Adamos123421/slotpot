import React from 'react';
import { Bot, Clock, Users, Coins, Trophy, Activity, Settings, Info } from 'lucide-react';
import './AutomationStatus.css';

const AutomationStatus = ({ adminInfo, contractState }) => {
  const {
    isAutoManaged,
    roundDuration,
    minBetsToEnd,
    timerActive,
    timeRemaining
  } = adminInfo;

  const {
    totalJackpot,
    isActive,
    betCount,
    lastWinner,
    lastPrizeAmount,
    formattedJackpot,
    formattedLastPrize
  } = contractState;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRoundStatus = () => {
    if (!isActive) return { text: 'Starting Soon', color: '#f59e0b', icon: '⏳' };
    if (betCount === 0) return { text: 'Waiting for Bets', color: '#06b6d4', icon: '🎯' };
    if (betCount < minBetsToEnd) return { text: 'Accepting Bets', color: '#10b981', icon: '💰' };
    return { text: 'Ready to End', color: '#8b5cf6', icon: '⚡' };
  };

  const roundStatus = getRoundStatus();

  return (
    <div className="automation-status">
      {/* Header */}
      <div className="automation-header">
        <div className="automation-title">
          <Bot size={24} />
          <h2>Automated Management</h2>
        </div>
        <div className="automation-status-badge">
          <div className={`status-indicator ${isAutoManaged ? 'active' : 'inactive'}`}>
            {isAutoManaged ? '🟢' : '🔴'}
          </div>
          <span>{isAutoManaged ? 'ACTIVE' : 'INACTIVE'}</span>
        </div>
      </div>

      {/* Current Round Status */}
      <div className="current-round-status">
        <h3>Current Round Status</h3>
        <div className="round-status-card">
          <div className="round-status-main">
            <div className="round-status-icon" style={{ color: roundStatus.color }}>
              {roundStatus.icon}
            </div>
            <div className="round-status-content">
              <div className="round-status-text">{roundStatus.text}</div>
              <div className="round-status-details">
                {isActive ? `${betCount} bet${betCount !== 1 ? 's' : ''} • ${formattedJackpot} TON` : 'Preparing next round...'}
              </div>
            </div>
          </div>
          {timerActive && timeRemaining > 0 && (
            <div className="round-timer">
              <Clock size={16} />
              <span>{formatTime(timeRemaining)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Automation Settings */}
      <div className="automation-settings">
        <h3>Automation Settings</h3>
        <div className="settings-grid">
          <div className="setting-item">
            <div className="setting-icon">
              <Clock size={20} />
            </div>
            <div className="setting-content">
              <div className="setting-label">Round Duration</div>
              <div className="setting-value">{Math.floor(roundDuration / 60)} minutes</div>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-icon">
              <Users size={20} />
            </div>
            <div className="setting-content">
              <div className="setting-label">Min Bets to End</div>
              <div className="setting-value">{minBetsToEnd} bets</div>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-icon">
              <Activity size={20} />
            </div>
            <div className="setting-content">
              <div className="setting-label">Auto Timer</div>
              <div className="setting-value">{timerActive ? 'Running' : 'Stopped'}</div>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-icon">
              <Settings size={20} />
            </div>
            <div className="setting-content">
              <div className="setting-label">Management</div>
              <div className="setting-value">{isAutoManaged ? 'Automated' : 'Manual'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Statistics */}
      <div className="contract-stats">
        <h3>Contract Statistics</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Coins size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Current Jackpot</div>
              <div className="stat-value">{formattedJackpot} TON</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Active Bets</div>
              <div className="stat-value">{betCount}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Trophy size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Last Prize</div>
              <div className="stat-value">{formattedLastPrize} TON</div>
            </div>
          </div>
        </div>
      </div>

      {/* Last Winner Info */}
      {lastWinner && (
        <div className="last-winner-info">
          <h3>Last Round Winner</h3>
          <div className="winner-card">
            <div className="winner-icon">🏆</div>
            <div className="winner-content">
              <div className="winner-address">{lastWinner.slice(0, 12)}...</div>
              <div className="winner-prize">Won {formattedLastPrize} TON</div>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="automation-info">
        <h3>How Automation Works</h3>
        <div className="info-list">
          <div className="info-item">
            <Info size={16} />
            <span>Rounds start automatically when no active round is detected</span>
          </div>
          <div className="info-item">
            <Info size={16} />
            <span>Rounds end after {Math.floor(roundDuration / 60)} minutes or when conditions are met</span>
          </div>
          <div className="info-item">
            <Info size={16} />
            <span>Winner selection is handled by the smart contract's random algorithm</span>
          </div>
          <div className="info-item">
            <Info size={16} />
            <span>5% fees are automatically sent to the admin wallet</span>
          </div>
          <div className="info-item">
            <Info size={16} />
            <span>System runs 24/7 without manual intervention</span>
          </div>
        </div>
      </div>

      {/* Status Footer */}
      <div className="automation-footer">
        <div className="footer-status">
          {isAutoManaged ? (
            <>
              <div className="footer-icon">🤖</div>
              <span>Fully automated jackpot management is active</span>
            </>
          ) : (
            <>
              <div className="footer-icon">⚠️</div>
              <span>Automation is currently disabled</span>
            </>
          )}
        </div>
        <div className="footer-timestamp">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default AutomationStatus; 