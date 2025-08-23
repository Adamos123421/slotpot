import React, { useEffect, useState } from 'react';
import { Trophy, TrendingUp, Crown } from 'lucide-react';
import './Leaderboard.css';
import { backendApi } from '../services/backendApi';

const Leaderboard = ({ currentRound }) => {
  const [lastWinner, setLastWinner] = useState(null);
  const [recentWinners, setRecentWinners] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadStats() {
      try {
        const [games, sum] = await Promise.all([
          backendApi.getRecentGames(5),
          backendApi.getStatsSummary(),
        ]);
        if (!mounted) return;
        setSummary(sum);
        setRecentWinners(
          (games || []).map((g, idx) => ({
            id: `${g.roundNumber ?? idx}`,
            username: g.displayName || g.currentUsername || g.username || (g.winnerDisplay || '').replace(/\.\.\./, '...') || 'Unknown',
            level: null,
            winAmount: g.prize,
            round: g.roundNumber ?? '-',
            avatar: g.avatar, // Use cached avatar from backend
            winnerAddress: g.winnerAddress // For fallback avatar generation
          }))
        );
        setLastWinner(
          games && games.length > 0
            ? {
                username: games[0].displayName || games[0].currentUsername || games[0].username || 'Unknown',
                level: null,
                avatar: games[0].avatar, // Use cached avatar from backend
                winAmount: games[0].prize,
                chance: null,
                winnerAddress: games[0].winnerAddress
              }
            : null
        );
      } catch (e) {
        // silent fail keeps UI
      }
    }
    loadStats();
    const t = setInterval(loadStats, 120000); // Update every 2 minutes (120 seconds)
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const generateAvatar = (name, avatar = null, address = null) => {
    // If we have a cached Telegram avatar, use it
    if (avatar) {
      return (
        <img 
          src={avatar} 
          alt={name}
          className="telegram-avatar-small"
          onError={(e) => {
            // Fallback to generated avatar if image fails to load
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      );
    }
    
    // Generate fallback avatar using Robohash if we have address
    const fallbackSrc = address ? 
      `https://robohash.org/${address}.png?size=50x50` : 
      null;
    
    if (fallbackSrc) {
      return (
        <img 
          src={fallbackSrc} 
          alt={name}
          className="robohash-avatar-small"
          onError={(e) => {
            // Final fallback to color-based avatar
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      );
    }
    
    // Color-based generated avatar as final fallback
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
            {lastWinner && lastWinner.avatar ? (
              <img src={lastWinner.avatar} alt={lastWinner.username} />
            ) : (
              generateAvatar(lastWinner ? lastWinner.username : 'Unknown')
            )}
            <div className="winner-crown">👑</div>
          </div>
          
          <div className="winner-info">
            <div className="winner-header">
              <span className="winner-name">{lastWinner ? lastWinner.username : '—'}</span>
              {lastWinner?.level && <span className="winner-level">{lastWinner.level}</span>}
            </div>
            
            <div className="winner-stats">
              <div className="stat-row">
                <span className="stat-label">Won</span>
                <span className="stat-value win-amount">≈ {lastWinner ? lastWinner.winAmount : '—'}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Chance</span>
                <span className="stat-value chance-percent">{lastWinner?.chance ? `${lastWinner.chance}%` : '—'}</span>
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
                {generateAvatar(winner.username, winner.avatar, winner.winnerAddress)}
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