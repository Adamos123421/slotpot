// Test script for referral system
const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:5002';

async function testReferralSystem() {
  console.log('🧪 Testing Referral System...\n');

  // Test 1: Get referral info for existing user
  console.log('1. Testing referral info for existing user...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/referral/info/EQAXphchCzlO8CfbqvvTQZcuU7ku7JCCZyBAN7AamEET-oVb`);
    const data = await response.json();
    console.log('✅ Referral info response:', data);
  } catch (error) {
    console.log('❌ Error getting referral info:', error.message);
  }

  // Test 2: Test referral registration with test endpoint
  console.log('\n2. Testing referral registration...');
  try {
    const testResponse = await fetch(`${BACKEND_URL}/api/referral/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referrer: 'EQAXphchCzlO8CfbqvvTQZcuU7ku7JCCZyBAN7AamEET-oVb', // Adam Ton
        newUser: 'EQDtest123456789012345678901234567890123456789012345678901234567890' // Test user
      })
    });
    const testData = await testResponse.json();
    console.log('✅ Test referral response:', testData);
  } catch (error) {
    console.log('❌ Error testing referral:', error.message);
  }

  // Test 3: Get referral leaderboard
  console.log('\n3. Testing referral leaderboard...');
  try {
    const leaderboardResponse = await fetch(`${BACKEND_URL}/api/referral/leaderboard`);
    const leaderboardData = await leaderboardResponse.json();
    console.log('✅ Leaderboard response:', leaderboardData);
  } catch (error) {
    console.log('❌ Error getting leaderboard:', error.message);
  }

  console.log('\n🧪 Referral system test completed!');
}

// Run the test
testReferralSystem().catch(console.error);


