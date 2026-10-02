const express = require('express');
const { lineMiddleware } = require('../config/line');
const { handleWebhookEvent } = require('../controllers/webhookController');

const router = express.Router();

// LINE Webhook Endpoint
// ใช้ safeLineMiddleware เพื่อตรวจสอบ X-Line-Signature อย่างปลอดภัย
const safeLineMiddleware = (req, res, next) => {
  if (typeof lineMiddleware === 'function') {
    return lineMiddleware(req, res, next);
  }
  console.warn('⚠️ LINE Webhook received but LINE_CHANNEL_SECRET is not configured.');
  return res.status(503).json({ error: 'LINE_CONFIG_MISSING', message: 'LINE Channel Secret is not configured' });
};

router.post('/', safeLineMiddleware, async (req, res) => {
  try {
    const events = req.body?.events || [];
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(200).json({ status: 'ok' });
    }

    // ประมวลผลทุก Events ที่ส่งเข้ามาแบบ allSettled เพื่อไม่ให้ error ตัวเดียวทำให้ตัวอื่นล้ม
    await Promise.allSettled(
      events.map(event => handleWebhookEvent(event))
    );

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Webhook Processing Error:', error);
    // ตอบ 200 เสมอเมื่อ Signature ถูกต้องแล้ว เพื่อป้องกัน LINE Retry Loop
    return res.status(200).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
