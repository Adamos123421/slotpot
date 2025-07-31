import React from 'react';
import { Shield, Play, Square, RefreshCw, Users, Coins, Trophy, Clock } from 'lucide-react';
import './AdminPanel.css';

const AdminPanel = ({ 
  contractState, 
  onStartJackpot, 
  onEndJackpot, 
  isLoadingContract 
}) => {
  const {
    totalJackpot,
    isActive,
    betCount,
    lastWinner,
    lastPrizeAmount,
    contractBalance,
    formattedJackpot,
    formattedLastPrize,
    error
  } = contractState;

  const handleStartJackpot = async () => {
    if (window.confirm('Are you sure you want to start a new jackpot round?')) {
      await onStartJackpot();
    }
  };

  const handleEndJackpot = async () => {
    if (betCount === 0) {
      alert('Cannot end jackpot with no bets placed!');
      return;
    }
    
    if (window.confirm(`Are you sure you want to end the current jackpot?\n\nCurrent pot: ${formattedJackpot} TON\nTotal bets: ${betCount}`)) {
      await onEndJackpot();
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-title">
          <Shield size={24} />
          <h2>Admin Panel</h2>
        </div>
        <div className="admin-status">
          <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
            {isActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}
          </span>
        </div>
      </div>

      {error && (
        <div className="admin-error">
          <span>⚠️ Contract Error: {error}</span>
        </div>
      )}

      {/* Quick Actions */}
      <div className="admin-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <button 
            className="action-btn start-btn"
            onClick={handleStartJackpot}
            disabled={isActive || isLoadingContract}
          >
            <Play size={20} />
            Start Jackpot
            {isActive && <small>Already Active</small>}
          </button>
          
          <button 
            className="action-btn end-btn"
            onClick={handleEndJackpot}
            disabled={!isActive || betCount === 0 || isLoadingContract}
          >
            <Square size={20} />
            End Jackpot
            {!isActive && <small>Not Active</small>}
            {isActive && betCount === 0 && <small>No Bets</small>}
          </button>

          <button 
            className="action-btn refresh-btn"
            onClick={() => window.location.reload()}
            disabled={isLoadingContract}
          >
            <RefreshCw size={20} className={isLoadingContract ? 'spinning' : ''} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Contract Stats */}
      <div className="admin-stats">
        <h3>Contract Statistics</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Coins size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Current Jackpot</div>
              <div className="stat-value">{formattedJackpot} TON</div>
              <div className="stat-subtext">
                {isActive ? 'Accepting bets' : 'Jackpot inactive'}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Bets</div>
              <div className="stat-value">{betCount}</div>
              <div className="stat-subtext">
                {betCount > 0 ? 'Players participating' : 'No bets yet'}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Trophy size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Last Prize</div>
              <div className="stat-value">{formattedLastPrize} TON</div>
              <div className="stat-subtext">
                {lastWinner ? `Winner: ${lastWinner.slice(0, 8)}...` : 'No winner yet'}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Contract Balance</div>
              <div className="stat-value">{(contractBalance || 0).toFixed(3)} TON</div>
              <div className="stat-subtext">Available in contract</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Info */}
      <div className="admin-info">
        <h3>Contract Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Contract Status:</span>
            <span className={`info-value ${isActive ? 'active' : 'inactive'}`}>
              {isActive ? 'Active & Accepting Bets' : 'Inactive'}
            </span>
          </div>
          
          <div className="info-item">
            <span className="info-label">Minimum Bet:</span>
            <span className="info-value">0.11 TON</span>
          </div>
          
          <div className="info-item">
            <span className="info-label">Fee Percentage:</span>
            <span className="info-value">5% (500 basis points)</span>
          </div>
          
          <div className="info-item">
            <span className="info-label">Last Update:</span>
            <span className="info-value">
              {contractState.timestamp ? new Date(contractState.timestamp).toLocaleTimeString() : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {lastWinner && (
        <div className="admin-activity">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-icon">🏆</div>
              <div className="activity-content">
                <div className="activity-title">Last Jackpot Winner</div>
                <div className="activity-details">
                  <strong>{lastWinner.slice(0, 12)}...</strong> won <strong>{formattedLastPrize} TON</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="admin-instructions">
        <h3>Instructions</h3>
        <ul>
          <li><strong>Start Jackpot:</strong> Activates the contract to accept new bets</li>
          <li><strong>End Jackpot:</strong> Closes betting, selects winner, and distributes prize</li>
          <li><strong>Winner Selection:</strong> Uses weighted random based on bet amounts</li>
          <li><strong>Fees:</strong> 5% automatically sent to admin wallet</li>
          <li><strong>Minimum Bet:</strong> 0.11 TON (gas fees deducted automatically)</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminPanel; 