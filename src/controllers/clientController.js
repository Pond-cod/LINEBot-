const dayjs = require('dayjs');
const sheetsService = require('../services/sheetsService');
const driveService = require('../services/driveService');
const lineService = require('../services/lineService');
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

    const activeDebt = await sheetsService.getActiveDebtByUserId(userId);
    const payments = await sheetsService.getPaymentsByUserId(userId);

    return res.status(200).json({
      success: true,
      data: {
        debtor,
        activeDebt,
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

    // แปลง base64 เป็น Buffer
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // ค้นหาสัญญาหากไม่ได้ระบุมา
    let targetDebtId = debtId;
    if (!targetDebtId) {
      const activeDebt = await sheetsService.getActiveDebtByUserId(userId);
      targetDebtId = activeDebt?.debtId || '';
    }

    // อัปโหลดเข้า Google Drive
    const timestamp = dayjs().format('YYYYMMDD_HHmmss');
    const fileName = `SLIP_WEB_${userId}_${timestamp}.jpg`;
    const driveResult = await driveService.uploadSlipBuffer(buffer, fileName, mimeType, userId, targetDebtId, amount);

    // บันทึกลง Google Sheets (หากยังไม่ได้บันทึกโดย GAS)
    let paymentRecord = null;
    if (driveResult.paymentId) {
      paymentRecord = {
        paymentId: driveResult.paymentId,
        debtId: targetDebtId,
        userId,
        amount: Number(amount) || 0,
        driveFileId: driveResult.fileId,
        slipViewUrl: driveResult.webViewLink,
        uploadedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      };
    } else {
      paymentRecord = await sheetsService.recordPayment({
        debtId: targetDebtId,
        userId,
        amount: amount ? Number(amount) : 0,
        driveFileId: driveResult.fileId,
        slipViewUrl: driveResult.webViewLink,
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
