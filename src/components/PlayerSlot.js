import React from 'react';
import './PlayerSlot.css';

function PlayerSlot({ player, isWinner = false, isPredetermined = false, winnerPrize = null }) {
  return (
    <div className={`mobile-player-slot ${player.bet === 0 ? 'waiting' : 'active'} ${isWinner ? 'winner' : ''} ${isPredetermined ? 'predetermined' : ''}`}>
      
      {/* Player Avatar */}
      <div className="mobile-player-avatar">
        {player.bet > 0 ? (
          <div className="generated-avatar" style={{ background: `linear-gradient(135deg, ${getRandomColor()}, ${getRandomColor()})` }}>
            <img 
              src={`https://robohash.org/${player.name}.png?size=100x100`}
              alt={player.name}
              className="avatar-image"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="generated-avatar" style={{ display: 'none' }}>
              {player.avatar}
            </div>
          </div>
        ) : (
          <div className="waiting-icon">
            {player.avatar}
          </div>
        )}
        {isWinner && <div className="winner-crown">👑</div>}
        {isPredetermined && <div className="predetermined-indicator">🎯</div>}
      </div>

      {/* Player Info */}
      <div className="mobile-player-info">
        <div className="mobile-player-name">{player.name}</div>
        <div className="mobile-player-bet">{player.bet.toFixed(3)} TON</div>
        {player.bet > 0 && !isWinner && <div className="win-chance">{player.chance}% WIN</div>}
        {isWinner && winnerPrize && (
          <div className="winner-prize">Won {parseFloat(winnerPrize).toFixed(3)} TON</div>
        )}
      </div>

      {isWinner && <div className="winner-text">WINNER!</div>}
      {isPredetermined && <div className="predetermined-text">SELECTED</div>}
    </div>
  );
}

function getRandomColor() {
  const colors = ['#8b5cf6', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default PlayerSlot; 