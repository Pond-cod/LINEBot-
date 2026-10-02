const { lineClient } = require('../config/line');

/**
 * ส่งข้อความตอบกลับ (Reply)
 */
async function replyMessage(replyToken, messages) {
  if (!lineClient) {
    console.warn('⚠️ LINE Client is not initialized (missing LINE_CHANNEL_ACCESS_TOKEN). Skipping replyMessage.');
    return { mock: true, success: false, reason: 'LINE_CHANNEL_ACCESS_TOKEN_NOT_SET' };
  }
  try {
    const msgArray = Array.isArray(messages) ? messages : [messages];
    return await lineClient.replyMessage(replyToken, msgArray);
  } catch (error) {
    console.error('❌ Error replying message:', error.originalError?.response?.data || error.message);
    throw error;
  }
}

/**
 * ส่งข้อความแบบ Push Message ไปยังผู้ใช้โดยตรง
 */
async function pushMessage(toUserId, messages) {
  if (!lineClient) {
    console.warn(`⚠️ LINE Client is not initialized. Skipping pushMessage to ${toUserId}.`);
    return { mock: true, success: false, reason: 'LINE_CHANNEL_ACCESS_TOKEN_NOT_SET' };
  }
  try {
    const msgArray = Array.isArray(messages) ? messages : [messages];
    return await lineClient.pushMessage(toUserId, msgArray);
  } catch (error) {
    console.error(`❌ Error pushing message to ${toUserId}:`, error.originalError?.response?.data || error.message);
    throw error;
  }
}

/**
 * ดึง Binary Stream ของรูปภาพหรือไฟล์จาก LINE Platform
 */
async function getMessageStream(messageId) {
  if (!lineClient) {
    throw new Error('LINE Client is not initialized. Please set LINE_CHANNEL_ACCESS_TOKEN in environment variables.');
  }
  try {
    return await lineClient.getMessageContent(messageId);
  } catch (error) {
    console.error(`❌ Error getting message content stream for ${messageId}:`, error.message);
    throw error;
  }
}

/**
 * ดึงโปรไฟล์ LINE User
 */
async function getProfile(userId) {
  if (!lineClient) {
    return { displayName: `User (${(userId || '').slice(0, 6)}...)`, pictureUrl: '' };
  }
  try {
    return await lineClient.getProfile(userId);
  } catch (error) {
    console.warn(`Could not get profile for ${userId}:`, error.message);
    return null;
  }
}

module.exports = {
  replyMessage,
  pushMessage,
  getMessageStream,
  getProfile
};
