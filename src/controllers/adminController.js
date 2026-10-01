const dayjs = require('dayjs');
const sheetsService = require('../services/sheetsService');
const lineService = require('../services/lineService');
const { createPaymentStatusFlex, createReminderFlex } = require('../templates/flexMessages');

/**
 * 1. ดึงข้อมูลสถิติภาพรวม (Admin Dashboard Overview)
 */
async function getAdminStats(req, res) {
  try {
    const debts = await sheetsService.getAllDebts();
    const payments = await sheetsService.getAllPayments();
    const debtors = await sheetsService.getAllDebtors();

    const todayStr = dayjs().format('YYYY-MM-DD');

    let totalPrincipal = 0;
    let totalRemaining = 0;
    let activeCount = 0;
    let overdueCount = 0;
    let dueTodayCount = 0;

    for (const d of debts) {
      if (d.debtStatus === 'ACTIVE' || d.debtStatus === 'OVERDUE') {
        totalPrincipal += d.totalAmount || 0;
        totalRemaining += d.remainingBalance || 0;
        activeCount++;

        if (d.dueDate === todayStr) {
          dueTodayCount++;
        }
        if (d.debtStatus === 'OVERDUE' || (d.dueDate && dayjs(d.dueDate).isBefore(dayjs(), 'day'))) {
          overdueCount++;
        }
      }
    }

    const pendingSlipsCount = payments.filter(p => p.verificationStatus === 'PENDING').length;
    const verifiedSlipsCount = payments.filter(p => p.verificationStatus === 'VERIFIED').length;

    return res.status(200).json({
      success: true,
      stats: {
        totalPrincipal,
        totalRemaining,
        activeCount,
        overdueCount,
        dueTodayCount,
        pendingSlipsCount,
        verifiedSlipsCount,
        totalContracts: debts.length,
        totalDebtors: debtors.length
      }
    });
  } catch (error) {
    console.error('Error getting admin stats:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 2. ดึงรายการสัญญาทั้งหมด
 */
async function getContracts(req, res) {
  try {
    const contracts = await sheetsService.getAllDebts();
    return res.status(200).json({ success: true, contracts });
  } catch (error) {
    console.error('Error getting contracts:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

const recentContractCreations = new Map();

/**
 * 3. สร้างสัญญาหนี้ใหม่จากฝั่งแอดมิน
 */
async function createContract(req, res) {
  try {
    const { userId, debtorName, phone, idCardNumber, totalAmount, installmentAmount, dueDate, cycleDays } = req.body;

    if (!userId || !totalAmount || !installmentAmount || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลที่จำเป็น: userId, totalAmount, installmentAmount, dueDate'
      });
    }

    // ป้องกันการกดสร้างสัญญาซ้ำเบิ้ลหลายครั้งภายใน 15 วินาที
    const dedupeKey = `${userId}_${totalAmount}_${installmentAmount}_${dueDate}`;
    const lastCreation = recentContractCreations.get(dedupeKey);
    if (lastCreation && (Date.now() - lastCreation.timestamp < 15000)) {
      return res.status(200).json({
        success: true,
        message: 'สัญญาได้รับการสร้างเรียบร้อยแล้ว (ระบบป้องกันการสร้างซ้ำ)',
        debt: lastCreation.debt
      });
    }

    // ลงทะเบียนหรืออัปเดตข้อมูลลูกหนี้
    await sheetsService.registerDebtor({
      userId,
      displayName: debtorName,
      fullName: debtorName,
      phone: phone || '',
      idCardNumber: idCardNumber || ''
    });

    // สร้างสัญญา
    const newDebt = await sheetsService.createDebt({
      userId,
      totalAmount,
      installmentAmount,
      dueDate,
      cycleDays: cycleDays || 30
    });

    recentContractCreations.set(dedupeKey, {
      timestamp: Date.now(),
      debt: newDebt
    });

    return res.status(200).json({
      success: true,
      message: 'สร้างสัญญาใหม่สำเร็จ',
      debt: newDebt
    });
  } catch (error) {
    console.error('Error creating contract:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 4. ดึงรายการสลิปทั้งหมด
 */
async function getSlips(req, res) {
  try {
    const slips = await sheetsService.getAllPayments();
    return res.status(200).json({ success: true, slips });
  } catch (error) {
    console.error('Error getting slips:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 5. อนุมัติสลิป + หักลดยอดหนี้คงเหลือ + ส่ง Push แจ้งเตือนลูกหนี้
 */
async function approveSlip(req, res) {
  try {
    const { paymentId, confirmedAmount, note } = req.body;

    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'Missing paymentId' });
    }

    const result = await sheetsService.approvePayment({
      paymentId,
      confirmedAmount,
      note: note || 'อนุมัติผ่านระบบแอดมิน'
    });

    // ส่ง LINE Push แจ้งลูกหนี้
    if (result.userId) {
      try {
        const debtor = await sheetsService.getDebtorByUserId(result.userId);
        const flex = createPaymentStatusFlex({
          debtorName: debtor?.fullName || 'คุณลูกค้า',
          paymentId: result.paymentId,
          debtId: result.debtId,
          status: 'VERIFIED',
          amount: result.paidAmount,
          remainingBalance: result.updatedDebt?.remainingBalance
        });
        await lineService.pushMessage(result.userId, flex);
      } catch (pushErr) {
        console.warn('Could not push approval message to user:', pushErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'อนุมัติสลิปและปรับลดยอดหนี้เรียบร้อยแล้ว',
      data: result
    });
  } catch (error) {
    console.error('Error approving slip:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 6. ปฏิเสธสลิป + ส่ง Push แจ้งเหตุผลให้ลูกหนี้
 */
async function rejectSlip(req, res) {
  try {
    const { paymentId, reason } = req.body;

    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'Missing paymentId' });
    }

    const result = await sheetsService.rejectPayment({
      paymentId,
      reason: reason || 'สลิปไม่ถูกต้อง หรือยอดเงินไม่ตรง'
    });

    // ส่ง LINE Push แจ้งลูกหนี้
    if (result.userId) {
      try {
        const debtor = await sheetsService.getDebtorByUserId(result.userId);
        const flex = createPaymentStatusFlex({
          debtorName: debtor?.fullName || 'คุณลูกค้า',
          paymentId: result.paymentId,
          debtId: result.debtId,
          status: 'REJECTED',
          reason: result.reason
        });
        await lineService.pushMessage(result.userId, flex);
      } catch (pushErr) {
        console.warn('Could not push reject message to user:', pushErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'ปฏิเสธสลิปเรียบร้อยแล้ว',
      data: result
    });
  } catch (error) {
    console.error('Error rejecting slip:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 7. ยิงแจ้งเตือนหนี้เฉพาะรายบุคคล (Manual Push)
 */
async function remindSingleDebt(req, res) {
  try {
    const { debtId } = req.params;
    const debts = await sheetsService.getAllDebts();
    const target = debts.find(d => d.debtId === debtId);

    if (!target) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสัญญาที่ระบุ' });
    }

    if (!target.userId) {
      return res.status(400).json({ success: false, message: 'สัญญานี้ไม่มี LINE User ID ไม่สามารถส่งข้อความได้' });
    }

    const debtor = await sheetsService.getDebtorByUserId(target.userId);
    const reminderSettingsService = require('../services/reminderSettingsService');
    const settings = await reminderSettingsService.getSettings();
    const tpl = settings.template || {};
    const bankStr = tpl.bankName && tpl.accountNumber ? `${tpl.bankName} ${tpl.accountNumber}` : 'ธนาคารกสิกรไทย (KBANK) 123-4-56789-0';

    const flex = createReminderFlex({
      debtorName: debtor?.fullName || target.debtorName || 'คุณลูกค้า',
      debtId: target.debtId,
      installmentAmount: target.installmentAmount,
      remainingBalance: target.remainingBalance,
      dueDate: target.dueDate,
      reminderType: 'DUE_TODAY',
      tone: tpl.tone || 'POLITE',
      bankAccount: bankStr,
      accountName: tpl.accountName || 'ชื่อบัญชีผู้รับโอน',
      promptPayNumber: tpl.promptPayNumber || '',
      customFooter: tpl.customFooter || ''
    });

    await lineService.pushMessage(target.userId, flex);
    await sheetsService.logReminder({
      debtId: target.debtId,
      userId: target.userId,
      reminderType: 'MANUAL_ADMIN',
      status: 'SUCCESS'
    });

    return res.status(200).json({
      success: true,
      message: `ส่งข้อความแจ้งเตือนไปยังคุณ ${target.debtorName} เรียบร้อยแล้ว`
    });
  } catch (error) {
    console.error('Error sending single reminder:', error);
    const errMsg = error.originalError?.response?.data?.message || error.message;
    return res.status(500).json({ success: false, message: errMsg });
  }
}

/**
 * 7.1 ลบสัญญาหนี้ (Delete Contract)
 */
async function deleteContract(req, res) {
  try {
    const { debtId } = req.params;
    if (!debtId) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรหัสสัญญา' });
    }

    const result = await sheetsService.deleteDebt(debtId);
    return res.status(200).json({
      success: true,
      message: `ลบสัญญา ${debtId} เรียบร้อยแล้ว`,
      result
    });
  } catch (error) {
    console.error('Error deleting contract:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 8. ดึงรายชื่อลูกหนี้ทั้งหมด (Debtors)
 */
async function getDebtors(req, res) {
  try {
    const debtors = await sheetsService.getAllDebtors();
    return res.status(200).json({ success: true, debtors });
  } catch (error) {
    console.error('Error getting debtors:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 9. ดึงรายชื่อผู้ดูแลระบบทั้งหมด (Admins)
 */
async function getAdmins(req, res) {
  try {
    const admins = await sheetsService.getAllAdmins();
    const envAdmins = (process.env.ADMIN_LINE_USER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    // ทำ flag ระบุว่าแอดมินคนไหนเป็น Master / Super Admin จาก Env
    const enriched = admins.map(a => ({
      ...a,
      isSuperAdmin: envAdmins.includes(a.userId) || a.role === 'SUPER_ADMIN'
    }));

    return res.status(200).json({
      success: true,
      admins: enriched,
      envAdmins
    });
  } catch (error) {
    console.error('Error getting admins:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 10. เพิ่มหรือแก้ไขผู้ดูแลระบบ
 */
async function saveAdmin(req, res) {
  try {
    const { userId, displayName, role, phone, note, status } = req.body;
    if (!userId || !userId.trim()) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ LINE User ID' });
    }

    const result = await sheetsService.saveAdmin({
      userId: userId.trim(),
      displayName: displayName ? displayName.trim() : '',
      role: role || 'ADMIN',
      phone: phone ? phone.trim() : '',
      note: note ? note.trim() : '',
      status: status || 'ACTIVE'
    });

    const { invalidateAdminCache } = require('../middleware/adminAuth');
    invalidateAdminCache();

    return res.status(200).json({
      success: true,
      message: result.action === 'created' ? 'เพิ่มผู้ดูแลระบบเรียบร้อยแล้ว' : 'อัปเดตข้อมูลผู้ดูแลระบบเรียบร้อยแล้ว',
      data: result
    });
  } catch (error) {
    console.error('Error saving admin:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 11. ลบผู้ดูแลระบบ
 */
async function deleteAdmin(req, res) {
  try {
    const { userId } = req.params;
    const currentUserId = req.headers['x-line-userid'];

    if (!userId) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ userId ที่ต้องการลบ' });
    }

    if (currentUserId && currentUserId === userId) {
      return res.status(400).json({ success: false, message: 'ไม่สามารถลบบัญชีแอดมินของตนเองที่กำลังล็อกอินอยู่ได้' });
    }

    const result = await sheetsService.deleteAdmin(userId);
    const { invalidateAdminCache } = require('../middleware/adminAuth');
    invalidateAdminCache();

    return res.status(200).json({
      success: true,
      message: 'ลบผู้ดูแลระบบออกจากระบบเรียบร้อยแล้ว',
      result
    });
  } catch (error) {
    console.error('Error deleting admin:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 12. ดึงการตั้งค่าระบบแจ้งเตือนอัตโนมัติ
 */
async function getReminderSettings(req, res) {
  try {
    const reminderSettingsService = require('../services/reminderSettingsService');
    const settings = await reminderSettingsService.getSettings();
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    console.error('Error getting reminder settings:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 13. บันทึกการตั้งค่าระบบแจ้งเตือนอัตโนมัติ
 */
async function saveReminderSettings(req, res) {
  try {
    const reminderSettingsService = require('../services/reminderSettingsService');
    const updated = await reminderSettingsService.saveSettings(req.body);
    return res.status(200).json({
      success: true,
      message: 'บันทึกการตั้งค่าระบบแจ้งเตือนเรียบร้อยแล้ว',
      settings: updated
    });
  } catch (error) {
    console.error('Error saving reminder settings:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 14. ส่งข้อความแจ้งเตือนตัวอย่างไปยัง LINE แอดมิน (Test Preview)
 */
async function sendTestReminderPush(req, res) {
  try {
    const targetUserId = req.headers['x-line-userid'] || req.body?.adminUserId;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'ไม่พบ LINE User ID ของแอดมินสำหรับส่งตัวอย่าง' });
    }

    const { template, tone, reminderType } = req.body || {};
    const tpl = template || {};
    const bankStr = tpl.bankName && tpl.accountNumber ? `${tpl.bankName} ${tpl.accountNumber}` : 'ธนาคารกสิกรไทย (KBANK) 123-4-56789-0';

    const { createReminderFlex } = require('../templates/flexMessages');
    const flex = createReminderFlex({
      debtorName: 'ตัวอย่าง: คุณทดสอบ ระบบ',
      debtId: 'DB-TEST-999',
      installmentAmount: 2500,
      remainingBalance: 12500,
      dueDate: dayjs().format('YYYY-MM-DD'),
      reminderType: reminderType || 'DUE_TODAY',
      tone: tone || tpl.tone || 'POLITE',
      bankAccount: bankStr,
      accountName: tpl.accountName || 'ชื่อบัญชีตัวอย่าง',
      promptPayNumber: tpl.promptPayNumber || '',
      customFooter: tpl.customFooter || ''
    });

    await lineService.pushMessage(targetUserId, flex);

    return res.status(200).json({
      success: true,
      message: 'ส่งข้อความตัวอย่างเข้าแชท LINE ของคุณเรียบร้อยแล้ว'
    });
  } catch (error) {
    console.error('Error sending test push:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 15. ดึงประวัติการส่งแจ้งเตือนล่าสุด
 */
async function getReminderLogs(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 15;
    const logs = await sheetsService.getRecentReminderLogs(limit);
    return res.status(200).json({ success: true, logs });
  } catch (error) {
    console.error('Error getting reminder logs:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getAdminStats,
  getContracts,
  createContract,
  getSlips,
  approveSlip,
  rejectSlip,
  remindSingleDebt,
  getDebtors,
  getAdmins,
  saveAdmin,
  deleteAdmin,
  deleteContract,
  getReminderSettings,
  saveReminderSettings,
  sendTestReminderPush,
  getReminderLogs
};
