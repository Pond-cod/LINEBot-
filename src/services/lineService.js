const { lineClient } = require('../config/line');

/**
 * ส่งข้อความตอบกลับ (Reply)
 */
async function replyMessage(replyToken, messages) {
  try {
    const msgArray = Array.isArray(messages) ? messages : [messages];
    return await lineClient.replyMessage({
      replyToken,
      messages: msgArray
    });
  } catch (error) {
    console.error('❌ Error replying message:', error.originalError?.response?.data || error.message);
    throw error;
  }
}

/**
 * ส่งข้อความแบบ Push Message ไปยังผู้ใช้โดยตรง
 */
async function pushMessage(toUserId, messages) {
  try {
    const msgArray = Array.isArray(messages) ? messages : [messages];
    return await lineClient.pushMessage({
      to: toUserId,
      messages: msgArray
    });
  } catch (error) {
    console.error(`❌ Error pushing message to ${toUserId}:`, error.originalError?.response?.data || error.message);
    throw error;
  }
}

/**
 * ดึง Binary Stream ของรูปภาพหรือไฟล์จาก LINE Platform
 */
async function getMessageStream(messageId) {
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
