import { useEffect, useState } from 'react';
import { backendApi } from '../services/backendApi';
import useTonConnect from './useTonConnect';
import useTelegramWebApp from './useTelegramWebApp';

const useReferralAutoRegistration = () => {
  const { address, isConnected } = useTonConnect();
  const { user } = useTelegramWebApp();
  const [referralCode, setReferralCode] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [hasRegistered, setHasRegistered] = useState(false);

  // Check for referral code when user data loads
  useEffect(() => {
    if (user?.referralCode && !referralCode) {
      console.log('🎯 Global referral detection: Found referral code:', user.referralCode.slice(0, 8) + '...');
      setReferralCode(user.referralCode);
    }
  }, [user, referralCode]);

  // Auto-register referral when all conditions are met
  useEffect(() => {
    if (referralCode && address && isConnected && !hasRegistered && !isRegistering) {
      console.log('🎯 Global auto-registration: All conditions met');
      console.log('  - referralCode:', referralCode.slice(0, 8) + '...');
      console.log('  - address:', address.slice(0, 8) + '...');
      console.log('  - user:', user?.id || 'no telegram data');
      console.log('  - isConnected:', isConnected);
      
      // Check if it's a self-referral
      if (referralCode === address) {
        console.log('❌ Self-referral detected, skipping registration');
        setHasRegistered(true);
        return;
      }

      handleAutoRegistration();
    }
  }, [referralCode, address, user, isConnected, hasRegistered, isRegistering]);

  const handleAutoRegistration = async () => {
    if (!address || !referralCode) return;

    console.log('🎯 Global auto-registration: Starting registration...');
    setIsRegistering(true);

    try {
      const response = await backendApi.fetchJson('/api/referral/register', {
        method: 'POST',
        body: JSON.stringify({
          address,
          referrer: referralCode,
          telegramId: user?.id || null,
          username: user?.username || user?.first_name || `Player_${address.slice(-4)}`
        })
      });

      if (response.success) {
        console.log('✅ Global auto-registration: Success!');
        console.log(`🎯 Referral registered successfully! You: ${address.slice(0, 8)}... Referrer: ${referralCode.slice(0, 8)}...`);
        setHasRegistered(true);
      } else {
        console.log('❌ Global auto-registration: Failed -', response.error);
        console.log(`❌ Referral registration failed: ${response.error}`);
        setHasRegistered(true); // Mark as attempted to prevent retries
      }
    } catch (error) {
      console.error('❌ Global auto-registration: Error -', error);
      console.log('❌ Referral registration error. Please try again.');
      setHasRegistered(true); // Mark as attempted to prevent retries
    } finally {
      setIsRegistering(false);
    }
  };

  return {
    referralCode,
    isRegistering,
    hasRegistered,
    handleAutoRegistration
  };
};

export default useReferralAutoRegistration;
