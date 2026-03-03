// Test script to check backend connectivity and leaderboard endpoint
const fetch = require('node-fetch');

const BACKEND_URL = 'https://ai-club-backend-iu4u.onrender.com';

async function testBackend() {
  console.log('=== Testing AI Club Backend ===\n');
  
  // Test 1: Health check
  console.log('1. Testing health check endpoint...');
  try {
    const healthResponse = await fetch(`${BACKEND_URL}/`);
    const healthData = await healthResponse.json();
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   Response:`, healthData);
  } catch (error) {
    console.error('   ❌ Health check failed:', error.message);
  }
  
  console.log('\n2. Testing leaderboard endpoint...');
  try {
    const leaderboardResponse = await fetch(`${BACKEND_URL}/api/contest/leaderboard`);
    console.log(`   Status: ${leaderboardResponse.status}`);
    
    if (leaderboardResponse.ok) {
      const data = await leaderboardResponse.json();
      console.log(`   ✓ Success!`);
      console.log(`   Total participants: ${data.totalParticipants}`);
      if (data.leaderboard && data.leaderboard.length > 0) {
        console.log(`   Top 3 entries:`);
        data.leaderboard.slice(0, 3).forEach((entry, index) => {
          console.log(`     ${index + 1}. ${entry.email} - ${entry.totalPoints} points`);
        });
      }
    } else {
      const errorData = await leaderboardResponse.json();
      console.error(`   ❌ Failed with status ${leaderboardResponse.status}`);
      console.error(`   Error:`, errorData);
    }
  } catch (error) {
    console.error('   ❌ Leaderboard test failed:', error.message);
  }
  
  console.log('\n=== Test Complete ===\n');
}

testBackend();
