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
  getReminderLogs
} = require('../controllers/adminController');
const { runDailyReminderCheck } = require('../services/reminderService');

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

// -------------------------------------------------------------
// 3. Automated Reminder Control
// -------------------------------------------------------------
router.post('/reminder/trigger-now', async (req, res) => {
  try {
    const summary = await runDailyReminderCheck();
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
});

module.exports = router;
