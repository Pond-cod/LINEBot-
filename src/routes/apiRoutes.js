const express = require('express');
const { registerFromLiff, getDebtInfo } = require('../controllers/liffController');
const { getClientData, uploadSlipWeb } = require('../controllers/clientController');
const {
  getAdminStats,
  getContracts,
  createContract,
  getSlips,
  approveSlip,
  rejectSlip,
  remindSingleDebt,
  getDebtors
} = require('../controllers/adminController');
const { runDailyReminderCheck } = require('../services/reminderService');

const router = express.Router();

router.get('/version', (req, res) => res.json({ version: '2.2.0', time: new Date() }));

// -------------------------------------------------------------
// 1. Client Portal Endpoints
// -------------------------------------------------------------
router.get('/client/profile/:userId', getClientData);
router.post('/client/upload-slip', uploadSlipWeb);
router.post('/liff/register', registerFromLiff);
router.get('/liff/debt/:userId', getDebtInfo);

// -------------------------------------------------------------
// 2. Admin Portal Endpoints
// -------------------------------------------------------------
router.get('/admin/stats', getAdminStats);
router.get('/admin/debtors', getDebtors);
router.get('/admin/contracts', getContracts);
router.post('/admin/contracts', createContract);
router.get('/admin/slips', getSlips);
router.post('/admin/slips/approve', approveSlip);
router.post('/admin/slips/reject', rejectSlip);
router.post('/admin/remind/:debtId', remindSingleDebt);

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
