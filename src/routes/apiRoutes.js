const express = require('express');
const { registerFromLiff, getDebtInfo } = require('../controllers/liffController');
const { getClientData, uploadSlipWeb } = require('../controllers/clientController');
const {
  getAdminStats,
  getContracts,
  createContract,
  deleteContract,
  getSlips,
  approveSlip,
  rejectSlip,
  syncSlips,
  remindSingleDebt,
  getDebtors,
  getAdmins,
  saveAdmin,
  deleteAdmin,
  getReminderSettings,
  saveReminderSettings,
  sendTestReminderPush,
  getReminderLogs,
  getReminderProfiles,
  createReminderProfile,
  updateReminderProfile,
  deleteReminderProfile,
  toggleReminderProfile,
  updateDebtorReminder,
  updateContractReminder,
  getAuditLogs
} = require('../controllers/adminController');
const { runDailyReminderCheck } = require('../services/reminderService');
const sheetsService = require('../services/sheetsService');
const reminderSettingsService = require('../services/reminderSettingsService');
const { generateReceiptHtml } = require('../services/receiptService');

const { isUserAdmin, requireAdminAuth, getAdminUserIds } = require('../middleware/adminAuth');

const router = express.Router();

router.get('/version', (req, res) => res.json({ version: '2.5.1', time: new Date() }));

// -------------------------------------------------------------
// 1. Client Portal Endpoints
// -------------------------------------------------------------
router.get('/client/profile/:userId', getClientData);
router.post('/client/upload-slip', uploadSlipWeb);
router.post('/liff/register', registerFromLiff);
router.get('/liff/debt/:userId', getDebtInfo);

// -------------------------------------------------------------
// 2. Admin Portal & Access Control Endpoints
// -------------------------------------------------------------
router.get('/admin/verify-access', async (req, res) => {
  const userId = req.query.userId || req.headers['x-line-userid'];
  const { authorized, isConfigured, adminCount } = await isUserAdmin(userId);
  const adminIds = await getAdminUserIds();

  return res.status(200).json({
    success: true,
    isConfigured,
    authorized,
    userId: userId || null,
    adminCount: adminCount || adminIds.length
  });
});

router.get('/admin/stats', requireAdminAuth, getAdminStats);
router.get('/admin/debtors', requireAdminAuth, getDebtors);
router.get('/admin/contracts', requireAdminAuth, getContracts);
router.post('/admin/contracts', requireAdminAuth, createContract);
router.delete('/admin/contracts/:debtId', requireAdminAuth, deleteContract);
router.get('/admin/slips', requireAdminAuth, getSlips);
router.post('/admin/slips/approve', requireAdminAuth, approveSlip);
router.post('/admin/slips/reject', requireAdminAuth, rejectSlip);
router.post('/admin/slips/sync', requireAdminAuth, syncSlips);
router.post('/admin/remind/:debtId', requireAdminAuth, remindSingleDebt);

// Admin Management (เก็บใน Google Sheet 'admin' และแก้ไขผ่านหน้าเว็บ)
router.get('/admin/admins', requireAdminAuth, getAdmins);
router.post('/admin/admins', requireAdminAuth, saveAdmin);
router.delete('/admin/admins/:userId', requireAdminAuth, deleteAdmin);

// Advanced Reminder Configurations & Logs
router.get('/admin/reminder/settings', requireAdminAuth, getReminderSettings);
router.post('/admin/reminder/settings', requireAdminAuth, saveReminderSettings);
router.post('/admin/reminder/test-push', requireAdminAuth, sendTestReminderPush);
router.get('/admin/reminder/logs', requireAdminAuth, getReminderLogs);

// Reminder Profiles CRUD & Toggle
router.get('/admin/reminder/profiles', requireAdminAuth, getReminderProfiles);
router.post('/admin/reminder/profiles', requireAdminAuth, createReminderProfile);
router.put('/admin/reminder/profiles/:profileId', requireAdminAuth, updateReminderProfile);
router.delete('/admin/reminder/profiles/:profileId', requireAdminAuth, deleteReminderProfile);
router.patch('/admin/reminder/profiles/:profileId/toggle', requireAdminAuth, toggleReminderProfile);

// Granular Reminder Overrides (Per Debtor & Per Contract)
router.patch('/admin/debtors/:userId/reminder', requireAdminAuth, updateDebtorReminder);
router.patch('/admin/contracts/:debtId/reminder', requireAdminAuth, updateContractReminder);

// Audit Trail Logs
router.get('/admin/audit-logs', requireAdminAuth, getAuditLogs);

// Official e-Receipt Viewer
router.get('/receipt/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payments = await sheetsService.getAllPayments();
    const payment = payments.find(p => p.paymentId === paymentId);
    if (!payment) {
      return res.status(404).send('<h2 style="font-family: sans-serif; text-align: center; margin-top: 50px; color: #DC2626;">❌ ไม่พบข้อมูลใบเสร็จรับเงินสำหรับรหัสนี้</h2>');
    }

    const debts = await sheetsService.getAllDebts();
    const debt = debts.find(d => d.debtId === payment.debtId) || {};

    const debtors = await sheetsService.getAllDebtors();
    const debtor = debtors.find(d => d.userId === payment.userId) || {};

    const settings = await reminderSettingsService.getSettings();

    const html = generateReceiptHtml({ payment, debt, debtor, settings });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    console.error('Error rendering receipt:', err);
    return res.status(500).send('<h2 style="font-family: sans-serif; text-align: center; margin-top: 50px; color: #DC2626;">เกิดข้อผิดพลาดในการโหลดใบเสร็จ</h2>');
  }
});

// -------------------------------------------------------------
// 3. System Configuration & Automated Reminder Control
// -------------------------------------------------------------
router.get('/config', (req, res) => {
  return res.status(200).json({
    success: true,
    liffId: process.env.LIFF_ID || '',
    timezone: process.env.TIMEZONE || 'Asia/Bangkok'
  });
});

async function handleTriggerReminder(req, res) {
  try {
    // ตรวจสอบ CRON_SECRET หากมีการตั้งค่าไว้ใน Environment
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers['authorization'];
      const querySecret = req.query.secret;
      const isValid = (authHeader && authHeader === `Bearer ${cronSecret}`) || (querySecret && querySecret === cronSecret);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Invalid Cron Secret' });
      }
    }

    const payload = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const summary = await runDailyReminderCheck(payload);
    return res.status(200).json({
      success: true,
      message: 'รันการตรวจสอบและแจ้งเตือนเรียบร้อยแล้ว',
      summary
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

router.route('/reminder/trigger-now')
  .get(handleTriggerReminder)
  .post(handleTriggerReminder);

module.exports = router;

