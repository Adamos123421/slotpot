#!/usr/bin/env node

const fetch = require('node-fetch');

// Configuration
const SERVER_URL =  'https://strongly-export-anthony-prince.trycloudflare.com';
const ADMIN_KEY = process.env.ADMIN_API_KEY || 'your-admin-key-here';

async function testSimulation() {
  console.log('🎮 Testing betting simulation...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/admin/simulate-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        adminKey: ADMIN_KEY,
        playerCount: 5,        // 5 players for a good test
        sessionDuration: 15    // 15 seconds for quick testing
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Simulation started successfully!');
      console.log('📊 Result:', result);
      console.log('\n🔍 Watch the frontend to see:');
      console.log('1. Players appearing in the roulette wheel');
      console.log('2. Round timer counting down');
      console.log('3. Wheel stopping when "waiting for winner"');
      console.log('4. Wheel spinning to land on winner');
      console.log('5. Winner announcement');
    } else {
      console.error('❌ Simulation failed:', result);
    }
  } catch (error) {
    console.error('❌ Error testing simulation:', error);
  }
}

// Run the test
testSimulation();

// Test winner broadcast (simpler test)
async function testWinner() {
  console.log('🧪 Testing winner broadcast...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/admin/test-winner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminKey: ADMIN_KEY
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Test winner broadcast sent!');
      console.log('🎯 Check the frontend to see the winner announcement');
    } else {
      console.error('❌ Test winner failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error testing winner:', error.message);
  }
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
  case 'simulate':
  case 'sim':
    testSimulation();
    break;
  case 'test-winner':
  case 'winner':
    testWinner();
    break;
  default:
    console.log('🎮 Slotpot Simulation Test Tool');
    console.log('');
    console.log('Usage:');
    console.log('  node test-simulation.js simulate     # Run full betting simulation');
    console.log('  node test-simulation.js test-winner  # Test winner broadcast only');
    console.log('');
    console.log('Environment variables:');
    console.log('  SERVER_URL     - Backend server URL (default: https://strongly-export-anthony-prince.trycloudflare.com)');
    console.log('  ADMIN_API_KEY  - Admin API key for authentication');
    console.log('');
    console.log('Examples:');
    console.log('  node test-simulation.js simulate');
    console.log('  SERVER_URL=https://strongly-export-anthony-prince.trycloudflare.com node test-simulation.js simulate');
    break;
} 