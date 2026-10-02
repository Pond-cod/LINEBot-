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

// Direct receipt view route
app.get('/receipt/:paymentId', (req, res) => {
  res.redirect(`/api/receipt/${req.params.paymentId}`);
});

// 5. Health Check & Root Route
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'LINE Bot Debt Management & Reminder System',
    time: new Date().toISOString()
  });
});

// 6. Global 404 Handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// 7. Global Express Error Handler (Always returns JSON, never HTML or plain text)
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.code || 'SERVER_ERROR',
    message: err.message || 'Internal Server Error'
  });
});

// เริ่มต้นการทำงานของเซิร์ฟเวอร์ (สำหรับ Local / VPS เมื่อสั่งรัน node src/app.js โดยตรง)
if (!process.env.VERCEL && require.main === module) {
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
