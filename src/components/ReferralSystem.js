import React, { useState, useEffect, memo } from 'react';
import { backendApi } from '../services/backendApi';
import useTonConnect from '../hooks/useTonConnect';
import useTelegramWebApp from '../hooks/useTelegramWebApp';
import { Share2, Users, DollarSign, Copy, Check } from 'lucide-react';
import './ReferralSystem.css';

const ReferralSystem = () => {
  // ReferralSystem component loaded
  
  const { address, isConnected } = useTonConnect();
  const { user } = useTelegramWebApp();
  
  // Hooks loaded successfully
  
  const [referralInfo, setReferralInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');



  useEffect(() => {
    let active = true;
    async function loadReferralInfo() {
      if (!address) {
        setReferralInfo(null);
        return;
      }
      setLoading(true);
      try {
        const data = await backendApi.getReferralInfo(address);
        if (!active) return;
        setReferralInfo(data);
      } catch (err) {
        if (!active) return;
        console.error('❌ Failed to load referral info:', err);
        setReferralInfo(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadReferralInfo();
    const interval = setInterval(loadReferralInfo, 30000); // Update every 30 seconds
    return () => { active = false; clearInterval(interval); };
  }, [address]);

  // Check for referral code in Telegram start parameter
  useEffect(() => {
    const tgStartParam = user?.referralCode;
    
    if (tgStartParam && tgStartParam !== referralCode) {
      setReferralCode(tgStartParam);
    }
  }, [user, referralCode]);

  // Auto-register referral when code is detected and user is connected
  useEffect(() => {
    if (referralCode && address && user && !referralInfo?.referrer && referralCode !== address) {
          // Auto-registering referral for new user
      
      handleRegisterReferral();
          }
  }, [referralCode, address, user, referralInfo]);

  const handleCopyReferralLink = async () => {
    if (!referralInfo?.referralCode) return;
    
    const botLink = 'https://t.me/SniffThePotBot_bot/sloot';
    const fullLink = `${botLink}?startapp=${referralInfo.referralCode}`;
    
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRegisterReferral = async () => {
    if (!address || !referralCode || !user) return;
    
    // Attempting to register referral
    
    setRegistering(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await backendApi.registerReferral({
        address,
        referrer: referralCode,
        telegramId: user.id,
        username: user.username || user.first_name
      });
      
      if (response.success) {
        setSuccess('Referral registered successfully! You\'ll earn 10% of our fees when your referrals win.');
        setReferralCode(''); // Clear the code after successful registration
        // Reload referral info
        const updatedInfo = await backendApi.getReferralInfo(address);
        setReferralInfo(updatedInfo);
      } else {
        setError(response.error || 'Failed to register referral');
      }
    } catch (err) {
      console.error('Referral registration error:', err);
     
    } finally {
      setRegistering(false);
    }
  };

  const canRegisterReferral = referralCode && 
                             address && 
                             user && 
                             !referralInfo?.referrer && 
                             referralCode !== address;

  if (!isConnected) {
    return (
      <div className="referral-system">
        <div className="referral-header">
          <Share2 size={20} />
          <span>Referral System</span>
        </div>
        <div className="referral-empty">Connect your wallet to access referrals.</div>
      </div>
    );
  }


  
  return (
    <div className="referral-system">
      <div className="referral-header">
        <Share2 size={20} />
        <span>Referral System</span>
      </div>

      {loading && <div className="referral-loading">Loading...</div>}

      {!loading && referralInfo && (
        <>
          {/* Referral Earnings */}
          <div className="referral-card referral-earnings">
            <div className="referral-card-header">
              <DollarSign size={18} />
              <span>Referral Earnings</span>
            </div>
            <div className="referral-amount">
              {referralInfo.referralEarnings.toFixed(6)} TON
            </div>
            <div className="referral-subtitle">
              Earn 10% of our fees when your referrals win
            </div>
          </div>

          {/* Referral Stats */}
          <div className="referral-stats">
            <div className="referral-stat">
              <div className="referral-stat-label">Referred Users</div>
              <div className="referral-stat-value">
                <Users size={16} />
                <span>{referralInfo.referralCount}</span>
              </div>
            </div>
          </div>

          {/* Your Referral Link */}
          <div className="referral-card">
            <div className="referral-card-header">
              <Share2 size={18} />
              <span>Your Referral Link</span>
            </div>
            <div className="referral-link-container">
              <div className="referral-link">
                {referralInfo.botLink}?startapp={referralInfo.referralCode}
              </div>
              <button 
                className="referral-copy-btn"
                onClick={handleCopyReferralLink}
                disabled={copied}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <div className="referral-subtitle">
              Share this link to earn 10% of our fees when your referrals win
            </div>
          </div>

                     {/* Who Section */}
           <div className="referral-card">
             <div className="referral-card-header">
               <Users size={18} />
               <span>Who</span>
             </div>
             
             {/* Your Referrer */}
             {referralInfo.referrer && (
               <div className="referral-who-item">
                 <div className="referral-who-label">Your Referrer:</div>
                 <div className="referral-who-value">
                   {referralInfo.referrer.slice(0, 8)}...{referralInfo.referrer.slice(-8)}
                 </div>
                 <div className="referral-who-subtitle">
                   You were referred by this user
                 </div>
               </div>
             )}
             
             {/* Your Referrals */}
             {referralInfo.referralCount > 0 && (
               <div className="referral-who-item">
                 <div className="referral-who-label">Your Referrals:</div>
                 <div className="referral-who-value">
                   {referralInfo.referralCount} user{referralInfo.referralCount !== 1 ? 's' : ''}
                 </div>
                 <div className="referral-who-subtitle">
                   People you've referred to the app
                 </div>
               </div>
             )}
             
             {/* No Referrals Yet */}
             {!referralInfo.referrer && referralInfo.referralCount === 0 && (
               <div className="referral-who-item">
                 <div className="referral-who-label">No Referrals Yet</div>
                 <div className="referral-who-subtitle">
                   Share your referral link to start earning commissions
                 </div>
               </div>
             )}
           </div>
        </>
      )}

      {/* Referral Registration */}
      {referralCode && referralCode !== address && (
        <div className="referral-card referral-register">
          <div className="referral-card-header">
            <Users size={18} />
            <span>Register Referral</span>
          </div>
          <div className="referral-code">
            Referral Code: {referralCode.slice(0, 8)}...{referralCode.slice(-8)}
          </div>
          <div className="referral-subtitle">
            {referralInfo?.referrer ? 
              'You already have a referrer' : 
              'Register this referral to earn 10% of our fees when they win'
            }
          </div>
          
          {error && <div className="referral-error">{error}</div>}
          {success && <div className="referral-success">{success}</div>}
          
          <button 
            className="referral-register-btn"
            onClick={handleRegisterReferral}
            disabled={registering || referralInfo?.referrer}
          >
            {registering ? 'Registering...' : 
             referralInfo?.referrer ? 'Already Referred' : 'Register Referral'
            }
          </button>
        </div>
      )}

      {/* How it works */}
      <div className="referral-card referral-info">
        <div className="referral-card-header">
          <span>How Referrals Work</span>
        </div>
        <div className="referral-info-list">
          <div className="referral-info-item">
            • <strong>You earn 10% of our fees</strong> when your referrals win
          </div>
          <div className="referral-info-item">
            • <strong>Your referrer gets 5%</strong> of your bonus (0.5% of total prize)
          </div>
          <div className="referral-info-item">
            • <strong>Only works for new users</strong> with no betting history
          </div>
          <div className="referral-info-item">
            • <strong>Distributed annually</strong> - commissions paid out yearly
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ReferralSystem);
