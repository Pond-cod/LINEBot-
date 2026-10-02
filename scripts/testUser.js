require('dotenv').config();
const { lineClient } = require('../src/config/line');

async function testUser() {
  const userId = 'U16565ee5abb9acecbbaf08d123f06cd2';
  try {
    const profile = await lineClient.getProfile(userId);
    console.log('✅ User Profile fetched successfully:', profile);
  } catch (err) {
    console.error('❌ Could not get profile:', err.message);
    if (err.originalError?.response?.data) {
      console.error('Error detail:', err.originalError.response.data);
    }
  }
}

testUser();
