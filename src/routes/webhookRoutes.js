const express = require('express');
const { lineMiddleware } = require('../config/line');
const { handleWebhookEvent } = require('../controllers/webhookController');

const router = express.Router();

// LINE Webhook Endpoint
// ใช้ lineMiddleware เพื่อตรวจสอบ X-Line-Signature
router.post('/', lineMiddleware, async (req, res) => {
  try {
    const events = req.body.events;

    // ประมวลผลทุก Events ที่ส่งเข้ามา
    await Promise.all(
      events.map(event => handleWebhookEvent(event))
    );

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Webhook Processing Error:', error);
    return res.status(500).end();
  }
});

module.exports = router;
