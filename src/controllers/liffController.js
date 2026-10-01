const sheetsService = require('../services/sheetsService');
const lineService = require('../services/lineService');
const { createDebtSummaryFlex } = require('../templates/flexMessages');

/**
 * บันทึกข้อมูลลูกหนี้และสัญญาหนี้จาก LIFF Form
 */
async function registerFromLiff(req, res) {
  try {
    const {
      userId,
      displayName,
      fullName,
      phone,
      idCardNumber,
      totalAmount,
      installmentAmount,
      dueDate,
      cycleDays
    } = req.body;

    if (!userId || !fullName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (userId, fullName, phone)'
      });
    }

    // 1. บันทึก/อัปเดตข้อมูลผู้ใช้ในแท็บ Debtors
    await sheetsService.registerDebtor({
      userId,
      displayName,
      fullName,
      phone,
      idCardNumber
    });

    let createdDebt = null;

    // 2. ถ้ามีการระบุยอดหนี้ ให้เปิดสัญญาหนี้ใหม่ในแท็บ Debts
    if (totalAmount && installmentAmount && dueDate) {
      createdDebt = await sheetsService.createDebt({
        userId,
        totalAmount: Number(totalAmount),
        installmentAmount: Number(installmentAmount),
        dueDate,
        cycleDays: Number(cycleDays) || 30
      });

      // ส่งข้อความยืนยันเข้า LINE ของผู้ใช้
      try {
        const summaryFlex = createDebtSummaryFlex({
          debtorName: fullName,
          debtId: createdDebt.debtId,
          totalAmount: createdDebt.totalAmount,
          remainingBalance: createdDebt.totalAmount,
          installmentAmount: createdDebt.installmentAmount,
          dueDate: createdDebt.dueDate,
          debtStatus: 'ACTIVE'
        });
        await lineService.pushMessage(userId, summaryFlex);
      } catch (lineErr) {
        console.warn('Could not push confirmation message:', lineErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'บันทึกข้อมูลเรียบร้อยแล้ว',
      debtId: createdDebt?.debtId || null
    });
  } catch (error) {
    console.error('❌ Error registering from LIFF:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'
    });
  }
}

/**
 * ดึงข้อมูลหนี้ของผู้ใช้สำหรับแสดงบน LIFF
 */
async function getDebtInfo(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing userId' });
    }

    const [debtor, activeDebt] = await Promise.all([
      sheetsService.getDebtorByUserId(userId),
      sheetsService.getActiveDebtByUserId(userId)
    ]);

    return res.status(200).json({
      success: true,
      debtor,
      activeDebt
    });
  } catch (error) {
    console.error('❌ Error getting debt info:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

module.exports = {
  registerFromLiff,
  getDebtInfo
};
