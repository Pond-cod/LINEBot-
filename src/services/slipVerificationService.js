const crypto = require('crypto');
const dayjs = require('dayjs');

/**
 * คำนวณ Hash (SHA-256) ของข้อมูลรูปภาพสลิปเพื่อตรวจจับสลิปซ้ำ
 */
function computeImageHash(base64Data) {
  if (!base64Data) return '';
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  return crypto.createHash('sha256').update(cleanBase64).digest('hex');
}

/**
 * ตรวจสอบความถูกต้องและตรวจจับสลิปซ้ำ (Anti-Fraud Check)
 * @param {string} imageBase64 - ข้อมูลภาพ Base64
 * @param {number} amount - ยอดเงินที่ระบุ
 * @param {Array} existingPayments - ประวัติการชำระเงินที่มีอยู่ในระบบ
 * @returns {{ isDuplicate: boolean, reason?: string, matchedPaymentId?: string }}
 */
function checkDuplicateSlip(imageBase64, amount, existingPayments = []) {
  if (!imageBase64 || !Array.isArray(existingPayments) || existingPayments.length === 0) {
    return { isDuplicate: false };
  }

  const incomingHash = computeImageHash(imageBase64);

  // 1. ตรวจสอบ Hash สลิปที่ตรงกัน 100%
  for (const p of existingPayments) {
    // ถ้ามีบันทึก fileHash ไว้
    if (p.fileHash && p.fileHash === incomingHash) {
      return {
        isDuplicate: true,
        reason: `สลิปรูปนี้ตรงกับรายการชำระเงินเดิม (${p.paymentId}) ที่บันทึกไว้เมื่อ ${p.uploadedAt || '-'}`,
        matchedPaymentId: p.paymentId
      };
    }
  }

  return { isDuplicate: false, imageHash: incomingHash };
}

/**
 * Slip Verification API Adapter (รองรับเชื่อมต่อ EasySlip / SlipOK / Bank Mini-QR)
 * ออกแบบให้เป็น Plug-and-Play สามารถเปิดใช้งานเมื่อผู้ใช้ใส่ API KEY ใน .env
 */
async function verifySlipWithProvider({ imageBase64, expectedAmount, targetBankAccount }) {
  const apiKey = process.env.SLIP_VERIFY_API_KEY || process.env.SLIPOK_API_KEY || process.env.EASYSLIP_API_KEY;

  if (!apiKey) {
    return {
      configured: false,
      verified: false,
      manualReviewRequired: true,
      message: 'ไม่ได้ตั้งค่า SLIP_VERIFY_API_KEY ระบบจะใช้การตรวจสอบด้วยเจ้าหน้าที่ (Manual Review)'
    };
  }

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await fetch(`https://api.slipok.com/api/line/apikey/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: cleanBase64,
        amount: expectedAmount ? Number(expectedAmount) : undefined
      })
    });

    const result = await response.json();
    if (result.success && result.data && result.data.success) {
      return {
        configured: true,
        verified: true,
        transactionId: result.data.transRef,
        amount: result.data.amount,
        sender: result.data.sender,
        receiver: result.data.receiver,
        transTimestamp: result.data.transTimestamp || result.data.transDate,
        message: 'ตรวจสอบสลิปผ่านระบบ SlipOK เรียบร้อยแล้ว'
      };
    }

    return {
      configured: true,
      verified: false,
      manualReviewRequired: true,
      message: result.message || 'ไม่สามารถยืนยันสลิปอัตโนมัติได้ กรุณาให้เจ้าหน้าที่ตรวจสอบ'
    };
  } catch (error) {
    console.error('Slip Verification API error:', error.message);
    return {
      configured: true,
      verified: false,
      manualReviewRequired: true,
      error: error.message
    };
  }
}

module.exports = {
  computeImageHash,
  checkDuplicateSlip,
  verifySlipWithProvider
};
