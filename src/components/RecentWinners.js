import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Award, Star } from 'lucide-react';
import { backendApi } from '../services/backendApi';
import './Leaderboard.css'; // Reuse the existing styles

const RecentWinners = () => {
  const [lastWinner, setLastWinner] = useState(null);
  const [luckiestWinner, setLuckiestWinner] = useState(null);
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

    async function loadWinners() {
      if (!active) return;
      setLoading(true);
      try {
        // Get last winner (most recent game)
        const recentGames = await backendApi.getRecentGames(1);
        if (active && recentGames && recentGames.length > 0) {
          const lastGame = recentGames[0];
          setLastWinner({
            id: 'last',
            round: lastGame.roundNumber || 'N/A',
            username: lastGame.displayName || lastGame.currentUsername || lastGame.username || (lastGame.winnerDisplay || '').replace(/\.\.\./, '...') || 'Unknown',
            avatar: lastGame.avatar,
            winAmount: lastGame.prize ? `${lastGame.prize.toFixed(3)} TON` : 'Unknown',
            winnerAddress: lastGame.winnerAddress
          });
        }

        // Get luckiest winner of the day
        const luckiest = await backendApi.getLuckiestWinner();
        if (active && luckiest) {
          setLuckiestWinner({
            id: 'luckiest',
            round: luckiest.roundNumber || 'N/A',
            username: luckiest.displayName || luckiest.currentUsername || luckiest.username || (luckiest.winnerDisplay || '').replace(/\.\.\./, '...') || 'Unknown',
            avatar: luckiest.avatar,
            winAmount: luckiest.prize ? `${luckiest.prize.toFixed(3)} TON` : 'Unknown',
            winnerAddress: luckiest.winnerAddress
          });
        }
      } catch (error) {
        console.error('Failed to load winners:', error);
        if (active) {
          setLastWinner(null);
          setLuckiestWinner(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWinners();
    const interval = setInterval(loadWinners, 120000); // Update every 2 minutes (120 seconds)

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (loading && !lastWinner && !luckiestWinner) {
    return (
      <div className="recent-winners-section">
        <div className="section-title">
          <Trophy size={16} />
          <span>Recent Winners</span>
        </div>
        <div className="loading-state">Loading winners...</div>
      </div>
    );
  }

  return (
    <>
      {/* Last Winner Section */}
      {lastWinner && (
        <div className="recent-winners-section">
          <div className="section-title">
            <Trophy size={16} />
            <span>Last Winner</span>
          </div>
          
          <div className="winners-list">
            <div key={lastWinner.id} className="winner-item">
              <div className="winner-rank">
                <Trophy size={14} />
              </div>
              <div className="winner-avatar-small">
                {generateAvatar(lastWinner.username, lastWinner.avatar, lastWinner.winnerAddress)}
              </div>
              <div className="winner-details">
                <div className="winner-name-small">{lastWinner.username}</div>
                <div className="winner-round">Round #{lastWinner.round}</div>
              </div>
              <div className="winner-amount">
                {lastWinner.winAmount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Luckiest Winner of the Day Section */}
      {luckiestWinner && (
        <div className="recent-winners-section luck-of-day">
          <div className="section-title">
            <Star size={16} />
            <span>Luck of the Day</span>
          </div>
          
          <div className="winners-list">
            <div key={luckiestWinner.id} className="winner-item">
              <div className="winner-rank">
                <Star size={14} />
              </div>
              <div className="winner-avatar-small">
                {generateAvatar(luckiestWinner.username, luckiestWinner.avatar, luckiestWinner.winnerAddress)}
              </div>
              <div className="winner-details">
                <div className="winner-name-small">{luckiestWinner.username}</div>
                <div className="winner-round">Round #{luckiestWinner.round}</div>
              </div>
              <div className="winner-amount">
                {luckiestWinner.winAmount}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!lastWinner && !luckiestWinner && !loading && (
        <div className="recent-winners-section">
          <div className="section-title">
            <Trophy size={16} />
            <span>Recent Winners</span>
          </div>
          <div className="no-winners">
            <Award size={20} />
            <span>No winners yet</span>
          </div>
        </div>
      )}
    </>
  );
};

export default RecentWinners;