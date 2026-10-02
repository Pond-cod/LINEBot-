require('dotenv').config();
const { pushMessage } = require('../src/services/lineService');

async function testPush() {
  const userId = 'U16565ee5abb9acecbbaf08d123f06cd2';
  try {
    const res = await pushMessage(userId, {
      type: 'text',
      text: '🔔 [ทดสอบระบบ] ทดสอบการเชื่อมต่อระบบแจ้งเตือน LINE Bot สำเร็จเรียบร้อยแล้วครับ!'
    });
    console.log('✅ Push message sent successfully!', res);
  } catch (err) {
    console.error('❌ Push message failed:', err.message);
    if (err.originalError?.response?.data) {
      console.error('Details:', err.originalError.response.data);
    }
  }
}

testPush();
