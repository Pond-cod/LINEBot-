const dayjs = require('dayjs');
const sheetsService = require('../services/sheetsService');
const driveService = require('../services/driveService');
const lineService = require('../services/lineService');
const { checkDuplicateSlip } = require('../services/slipVerificationService');
const { createSlipReceivedFlex } = require('../templates/flexMessages');

/**
 * ดึงข้อมูลครบวงจรสำหรับ Client Portal (โปรไฟล์, สัญญาที่เปิดอยู่, ประวัติการชำระ)
 */
async function getClientData(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing userId' });
    }

    let debtor = await sheetsService.getDebtorByUserId(userId);
    const displayName = req.query.displayName;

    // ถ้ายังไม่มีข้อมูลใน Google Sheets และเป็นผู้ใช้จริงจาก LINE (ขึ้นต้นด้วย U) ให้ลงทะเบียนเริ่มต้นให้อัตโนมัติ
    if (!debtor && displayName && userId.startsWith('U') && userId !== 'U_DEMO_CLIENT' && userId !== 'U_DEMO_GUEST') {
      try {
        await sheetsService.registerDebtor({
          userId,
          displayName,
          fullName: displayName,
          phone: '',
          idCardNumber: ''
        });
        debtor = await sheetsService.getDebtorByUserId(userId);
      } catch (regErr) {
        console.warn('Auto register debtor warning:', regErr.message);
      }
    }

    let debts = await sheetsService.getDebtsByUserId(userId);

    // Fallback: หากไม่พบสัญญาด้วย userId โดยตรง ให้ค้นหาด้วย displayName / debtorName
    // (ป้องกันกรณี LIFF Channel อยู่คนละ Provider กับ LINE Bot ทำให้ userId เป็นคนละชุดกัน)
    if (debts.length === 0 && displayName) {
      const cleanName = displayName.trim().toLowerCase();
      const allDebts = await sheetsService.getAllDebts();
      const matchedByName = allDebts.filter(d => 
        (d.debtorName && d.debtorName.trim().toLowerCase() === cleanName) ||
        (debtor && d.userId === debtor.userId)
      );

      if (matchedByName.length > 0) {
        debts = matchedByName.sort((a, b) => {
          const aActive = a.debtStatus === 'ACTIVE' || a.debtStatus === 'OVERDUE';
          const bActive = b.debtStatus === 'ACTIVE' || b.debtStatus === 'OVERDUE';
          if (aActive && !bActive) return -1;
          if (!aActive && bActive) return 1;
          return (b.rowIndex || 0) - (a.rowIndex || 0);
        });
      }

      if (!debtor) {
        const allDebtors = await sheetsService.getAllDebtors();
        debtor = allDebtors.find(d => 
          (d.displayName && d.displayName.trim().toLowerCase() === cleanName) ||
          (d.fullName && d.fullName.trim().toLowerCase() === cleanName)
        ) || null;
      }
    }

    const activeDebts = debts.filter(d => d.debtStatus === 'ACTIVE' || d.debtStatus === 'OVERDUE');
    const activeDebt = activeDebts.length > 0 ? activeDebts[0] : (debts.length > 0 ? debts[0] : null);

    const totalRemainingAll = activeDebts.reduce((sum, d) => sum + (Number(d.remainingBalance) || 0), 0);
    let payments = await sheetsService.getPaymentsByUserId(userId);
    if (payments.length === 0 && debts.length > 0) {
      const debtIds = new Set(debts.map(d => d.debtId));
      const allPayments = await sheetsService.getAllPayments();
      payments = allPayments.filter(p => debtIds.has(p.debtId) || p.userId === userId);
    }

    return res.status(200).json({
      success: true,
      data: {
        debtor,
        activeDebt,
        debts,
        totalRemainingAll,
        totalContractsCount: debts.length,
        activeContractsCount: activeDebts.length,
        payments
      }
    });
  } catch (error) {
    console.error('Error getting client data:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * รับอัปโหลดรูปภาพสลิปโดยตรงจากหน้าเว็บ LIFF (Base64)
 */
async function uploadSlipWeb(req, res) {
  try {
    const { userId, debtId, amount, imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!userId || !imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาส่ง userId และไฟล์รูปภาพสลิป (imageBase64)'
      });
    }

    // ตรวจสอบสลิปซ้ำ (Anti-Fraud Duplicate Detection)
    try {
      const existingPayments = await sheetsService.getAllPayments();
      const dupCheck = checkDuplicateSlip(imageBase64, amount, existingPayments);
      if (dupCheck.isDuplicate) {
        return res.status(400).json({
          success: false,
          isDuplicate: true,
          message: dupCheck.reason || 'รูปภาพสลิปนี้เคยถูกส่งเข้าระบบแล้ว กรุณาตรวจสอบหรือติดต่อเจ้าหน้าที่'
        });
      }
    } catch (checkErr) {
      console.warn('Duplicate check warning:', checkErr.message);
    }

    // แปลง base64 เป็น Buffer
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // ค้นหาสัญญาหากไม่ได้ระบุมา
    let targetDebtId = debtId;
    if (!targetDebtId) {
      const activeDebt = await sheetsService.getActiveDebtByUserId(userId);
      targetDebtId = activeDebt?.debtId || '';
    }

    // อัปโหลดเข้า Google Drive (พร้อม Fallback หาก DriveApp มีข้อจำกัดสิทธิ์)
    const timestamp = dayjs().format('YYYYMMDD_HHmmss');
    const fileName = `SLIP_WEB_${userId}_${timestamp}.jpg`;
    let driveResult = { fileId: '', webViewLink: '', paymentId: null };

    try {
      driveResult = await driveService.uploadSlipBuffer(buffer, fileName, mimeType, userId, targetDebtId, amount);
    } catch (driveErr) {
      console.warn('Google Drive upload warning (continuing to record payment):', driveErr.message);
    }

    // บันทึกลง Google Sheets
    let paymentRecord = null;
    if (driveResult && driveResult.paymentId) {
      paymentRecord = {
        paymentId: driveResult.paymentId,
        debtId: targetDebtId,
        userId,
        amount: Number(amount) || 0,
        driveFileId: driveResult.fileId || '',
        slipViewUrl: driveResult.webViewLink || (driveResult.fileId ? `https://lh3.googleusercontent.com/d/${driveResult.fileId}` : ''),
        uploadedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      };
    } else {
      paymentRecord = await sheetsService.recordPayment({
        debtId: targetDebtId,
        userId,
        amount: amount ? Number(amount) : 0,
        driveFileId: driveResult?.fileId || '',
        slipViewUrl: driveResult?.webViewLink || (driveResult?.fileId ? `https://lh3.googleusercontent.com/d/${driveResult.fileId}` : ''),
        adminNote: 'อัปโหลดผ่านเว็บ LIFF'
      });
    }

    // ส่ง Flex Message ยืนยันเข้า LINE Chat ของผู้ใช้ด้วย
    try {
      const confirmFlex = createSlipReceivedFlex({
        paymentId: paymentRecord.paymentId,
        debtId: targetDebtId || 'สัญญาหลัก',
        uploadedAt: paymentRecord.uploadedAt,
        slipViewUrl: driveResult.webViewLink
      });
      await lineService.pushMessage(userId, confirmFlex);
    } catch (lineErr) {
      console.warn('Could not push slip confirmation:', lineErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'อัปโหลดสลิปเรียบร้อยแล้ว',
      data: paymentRecord
    });
  } catch (error) {
    console.error('Error uploading slip via web:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getClientData,
  uploadSlipWeb
};
