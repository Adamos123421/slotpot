import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Award } from 'lucide-react';
import { backendApi } from '../services/backendApi';
import './Leaderboard.css'; // Reuse the existing styles

const RecentWinners = () => {
  const [recentWinners, setRecentWinners] = useState([]);
  const [loading, setLoading] = useState(false);

  // Generate avatar function (copied from Leaderboard)
  const generateAvatar = (name, avatar = null, address = null) => {
    if (avatar) {
      return <img src={avatar} alt={name} className="telegram-avatar-small" />;
    }

    const fallbackSrc = address ? `https://robohash.org/${address}.png?size=50x50` : null;
    if (fallbackSrc) {
      return <img src={fallbackSrc} alt={name} className="robohash-avatar-small" />;
    }

    // Color-based fallback
    const colors = ['#8b5cf6', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'];
    const colorIndex = name.length % colors.length;
    const backgroundColor = colors[colorIndex];
    const initial = name.charAt(0).toUpperCase();

    return (
      <div 
        className="avatar-fallback-small"
        style={{ backgroundColor }}
      >
        {initial}
      </div>
    );
  };

  useEffect(() => {
    let active = true;

    async function loadRecentWinners() {
      if (!active) return;
      setLoading(true);
      try {
        const data = await backendApi.fetchJson('/api/stats/recent-games');
        if (!active) return;
        
        setRecentWinners(
          (data || []).map((g, idx) => ({
            id: idx,
            round: g.roundNumber || 'N/A',
            username: g.displayName || g.currentUsername || g.username || (g.winnerDisplay || '').replace(/\.\.\./, '...') || 'Unknown',
            avatar: g.avatar, // Use cached avatar from backend
            winAmount: g.prize ? `${g.prize.toFixed(3)} TON` : 'Unknown',
            winnerAddress: g.winnerAddress // For fallback avatar generation
          }))
        );
      } catch (error) {
        console.error('Failed to load recent winners:', error);
        if (active) setRecentWinners([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadRecentWinners();
    const interval = setInterval(loadRecentWinners, 120000); // Update every 2 minutes (120 seconds)

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (loading && recentWinners.length === 0) {
    return (
      <div className="recent-winners-section">
        <div className="section-title">
          <Trophy size={16} />
          <span>Recent Winners</span>
        </div>
        <div className="loading-state">Loading recent winners...</div>
      </div>
    );
  }

  return (
    <div className="recent-winners-section">
      <div className="section-title">
        <Trophy size={16} />
        <span>Recent Winners</span>
      </div>
      
      <div className="winners-list">
        {recentWinners.slice(0, 5).map((winner, index) => (
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
              {winner.winAmount}
            </div>
          </div>
        ))}
        
        {recentWinners.length === 0 && !loading && (
          <div className="no-winners">
            <Award size={20} />
            <span>No recent winners yet</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentWinners;