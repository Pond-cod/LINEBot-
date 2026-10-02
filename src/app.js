const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const webhookRoutes = require('./routes/webhookRoutes');
const apiRoutes = require('./routes/apiRoutes');
const { initDailyReminderCron } = require('./jobs/dailyReminderJob');
const { initializeSheets } = require('./services/sheetsService');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// 1. เส้นทาง Webhook ของ LINE (ต้องอยู่ก่อน express.json() เพื่อให้ lineMiddleware ตรวจ Signature ได้)
app.use('/webhook', webhookRoutes);

// 2. Body Parsers สำหรับ API ปกติ (ขยาย limit เป็น 15mb เพื่อรองรับ base64 slip images)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// 3. Static Files สำหรับ LIFF Frontend & Portals
app.use(express.static(path.join(__dirname, '../public')));

// 4. REST API Routes
app.use('/api', apiRoutes);

// 5. Health Check & Root Route
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'LINE Bot Debt Management & Reminder System',
    time: new Date().toISOString()
  });
});

// เริ่มต้นการทำงานของเซิร์ฟเวอร์ (สำหรับ Local / VPS)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌐 LIFF URL: https://liff.line.me/${process.env.LIFF_ID || 'NOT_SET'}`);
    console.log(`👤 Client Portal: http://localhost:${PORT}/client/`);
    console.log(`🛡️ Admin Portal: http://localhost:${PORT}/admin/`);

    initializeSheets().catch(err => {
      console.warn('Google Sheets initialization notice:', err.message);
    });

    initDailyReminderCron();
  });
}

module.exports = app;
