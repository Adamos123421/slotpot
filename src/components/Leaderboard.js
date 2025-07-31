import React from 'react';
import { Trophy, TrendingUp, Crown } from 'lucide-react';
import './Leaderboard.css';

const Leaderboard = ({ currentRound }) => {
  const lastWinner = {
    username: 'HalaKka',
    level: 14,
    avatar: null,
    winAmount: 1.663,
    chance: 21.13
  };

  const recentWinners = [
    { id: 1, username: 'coli', level: 12, winAmount: 10.788, round: 52955 },
    { id: 2, username: 'Player123', level: 8, winAmount: 5.432, round: 52954 },
    { id: 3, username: 'BetMaster', level: 23, winAmount: 3.891, round: 52953 },
    { id: 4, username: 'LuckyUser', level: 15, winAmount: 7.234, round: 52952 },
    { id: 5, username: 'CryptoKing', level: 31, winAmount: 12.567, round: 52951 }
  ];

  const generateAvatar = (name) => {
    const colors = ['#8b5cf6', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
    const colorIndex = name.charCodeAt(0) % colors.length;
    
    return (
      <div 
        className="generated-avatar-small"
        style={{ backgroundColor: colors[colorIndex] }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <div className="header-title">
          <Trophy size={18} />
          <span>Round Stats</span>
        </div>
        <div className="round-number">#{currentRound}</div>
      </div>

      <div className="current-winner-section">
        <div className="section-title">
          <Crown size={16} />
          <span>LAST WINNER</span>
        </div>
        
        <div className="winner-card">
          <div className="winner-avatar">
            {lastWinner.avatar ? (
              <img src={lastWinner.avatar} alt={lastWinner.username} />
            ) : (
              generateAvatar(lastWinner.username)
            )}
            <div className="winner-crown">👑</div>
          </div>
          
          <div className="winner-info">
            <div className="winner-header">
              <span className="winner-name">{lastWinner.username}</span>
              <span className="winner-level">{lastWinner.level}</span>
            </div>
            
            <div className="winner-stats">
              <div className="stat-row">
                <span className="stat-label">Won</span>
                <span className="stat-value win-amount">≈ {lastWinner.winAmount}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Chance</span>
                <span className="stat-value chance-percent">{lastWinner.chance}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="previous-round-section">
        <div className="section-title">
          <span>ROUND</span>
          <span className="previous-round-number">#{currentRound - 1}</span>
        </div>
        
        <div className="previous-round-info">
          <div className="round-stat">
            <TrendingUp size={14} />
            <span>Total Pot: ≈ 15.234</span>
          </div>
          <div className="round-stat">
            <span>🎯 Players: 8</span>
          </div>
        </div>
      </div>

      <div className="recent-winners-section">
        <div className="section-title">
          <span>Recent Winners</span>
        </div>
        
        <div className="winners-list">
          {recentWinners.map((winner, index) => (
            <div key={winner.id} className="winner-item">
              <div className="winner-rank">#{index + 1}</div>
              <div className="winner-avatar-small">
                {generateAvatar(winner.username)}
              </div>
              <div className="winner-details">
                <div className="winner-name-small">{winner.username}</div>
                <div className="winner-round">Round #{winner.round}</div>
              </div>
              <div className="winner-amount">
                ≈ {winner.winAmount}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="luck-section">
        <div className="luck-banner">
          <span className="luck-icon">🍀</span>
          <span className="luck-text">LUCK OF THE DAY</span>
          <span className="luck-icon">🌟</span>
        </div>
        
        <div className="luck-info">
          <div className="luck-stat">
            <span className="luck-label">Won</span>
            <span className="luck-value">≈ 10.788</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard; 