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
        totalContracts: debts.length
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
      return res.status(404).json({ success: false, message: 'Debt record not found' });
    }

    const debtor = await sheetsService.getDebtorByUserId(target.userId);
    const flex = createReminderFlex({
      debtorName: debtor?.fullName || target.debtorName || 'คุณลูกค้า',
      debtId: target.debtId,
      installmentAmount: target.installmentAmount,
      remainingBalance: target.remainingBalance,
      dueDate: target.dueDate,
      reminderType: 'DUE_TODAY'
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
  remindSingleDebt
};
