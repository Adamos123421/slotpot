import React, { useEffect, useState, memo } from 'react';
import './PlayerProfile.css';
import { backendApi } from '../services/backendApi';
import useTonConnect from '../hooks/useTonConnect';
import { TonIcon } from './IconComponents';


const PlayerProfile = () => {
  console.log('🎯 PlayerProfile: Component function called');
  
  const { address, formattedAddress, isConnected } = useTonConnect();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [range, setRange] = useState('Last 7 Days');
  
  console.log('🎯 PlayerProfile: isConnected =', isConnected);
  console.log('🎯 PlayerProfile: address =', address);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!address) {
        setStats(null);
        return;
      }
      setLoading(true);
      try {
        const data = await backendApi.fetchJson(`/api/stats/player/${encodeURIComponent(address)}`);
        if (!active) return;
        setStats(data);
      } catch (_) {
        if (!active) return;
        setStats(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 10000); // More frequent for profile stats
    return () => { active = false; clearInterval(t); };
  }, [address]);

  const totalBets = stats?.totalBets ?? 0;
  const totalAmountBet = Number(stats?.totalAmountBet ?? 0)*0.95;
  const totalPrize = Number(stats?.totalPrize ?? 0);
  const netProfit = +(totalPrize - totalAmountBet).toFixed(3);
  const referralEarnings = Number(stats?.referralEarnings ?? 0);
  const referralCount = Number(stats?.referralCount ?? 0);
  const referrer = stats?.referrer || null;

  const short = (addr) => {
    if (!addr || typeof addr !== 'string') return '';
    return `${addr.slice(0,6)}...${addr.slice(-6)}`;
  };

  if (!isConnected) {
    return (
      <div className="player-profile">
        <div className="pp-head">
          <div className="pp-title">Profile</div>
        </div>
        <div className="pp-empty">Connect your wallet to see your stats.</div>
      </div>
    );
  }

  console.log('🎯 PlayerProfile: About to render component');
  
  return (
    <div className="player-profile">
      <div className="pp-head">
        <div className="pp-title">Profile</div>
        <div className="pp-address">{formattedAddress || address}</div>
      </div>

      {/* Net Profit and Total Wagered Card */}
      <div className="pp-card pp-profit">
        <div className="pp-row">
          <div className="pp-card-title">Net Profit</div>
          <div className={`pp-amount ${netProfit >= 0 ? 'pos' : 'neg'}`}>
            <TonIcon size={18} className="pp-amount-icon" />
            <span>{isNaN(netProfit) ? '0' : netProfit}</span>
          </div>
        </div>
        <div className="pp-row">
          <div className="pp-card-title">Total Wagered</div>
          <div className="pp-amount">
            <TonIcon size={18} className="pp-amount-icon" />
            <span>{totalAmountBet.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* Wager Stats header */}
      <div className="pp-section-header">
        <div className="pp-section-title">Wager Stats</div>
        <div className="pp-filter">
          <button className="pp-filter-btn" onClick={() => setRangeOpen(v => !v)}>
            {range} <span className="pp-caret">▾</span>
          </button>
          {rangeOpen && (
            <div className="pp-filter-menu" onMouseLeave={() => setRangeOpen(false)}>
              {['Last 7 Days', 'Last 30 Days', 'All Time'].map(opt => (
                <div
                  key={opt}
                  className={`pp-filter-item ${range === opt ? 'active' : ''}`}
                  onClick={() => { setRange(opt); setRangeOpen(false); }}
                >
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Wager Chart placeholder */}
      <div className="pp-card pp-chart">
        {totalBets > 0 ? (
          <div className="pp-chart-placeholder">Chart coming soon</div>
        ) : (
          <div className="pp-chart-empty">No bets</div>
        )}
      </div>

      {/* Summary cards - removed duplicate profit/wagered since they're now in main card */}

      

      {/* Details grid */}
      <div className="pp-grid">
        <div className="pp-stat">
          <div className="pp-label">Total Bets</div>
          <div className="pp-value">{totalBets}</div>
        </div>
        <div className="pp-stat pp-wins">
          <div className="pp-label">Wins</div>
          <div className="pp-value pp-wins-value">{stats?.totalWins ?? 0}</div>
        </div>
        <div className="pp-stat">
          <div className="pp-label">Prize Won</div>
          <div className="pp-value">{totalPrize.toFixed(3)}</div>
        </div>
        <div className="pp-stat">
          <div className="pp-label">Amount Bet</div>
          <div className="pp-value">{totalAmountBet.toFixed(3)}</div>
        </div>
      </div>

      {loading && <div className="pp-loading">Loading…</div>}
      {!loading && !stats && (
        <div className="pp-empty">No stats yet. Place your first bet!</div>
      )}

      {/* Referral System moved to separate tab */}
    </div>
  );
};

export default memo(PlayerProfile);

