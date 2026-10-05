const dayjs = require('dayjs');
const sheetsService = require('../services/sheetsService');
const driveService = require('../services/driveService');
const lineService = require('../services/lineService');
const { checkDuplicateSlip, computeImageHash } = require('../services/slipVerificationService');
const { maskIdCard, maskPhone } = require('../services/receiptService');
const { createSlipReceivedFlex } = require('../templates/flexMessages');

/**
 * ล้างชื่อลูกหนี้สำหรับจับคู่: ตัด Emoji ทุกชนิด, สัญลักษณ์พิเศษ, ช่องว่าง, และแปลงเป็น lowercase
 * รองรับทั้ง: '😾POND-IT😸', '🐱 POND-IT 🐱', 'POND-IT', 'pond-it' -> 'pondit'
 */
function normalizeDebtorName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/[\u{1F000}-\u{1FFFF}\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}]/gu, '')
    .replace(/[^a-zA-Z0-9\u0E00-\u0E7F]/g, '')
    .toLowerCase()
}

/**
 * เรียงลำดับสัญญาหนี้: สัญญาที่ยังไม่ชำระและถึงรอบชำระก่อนให้แสดงก่อนเสมอ
 */
function sortDebtsByDueDate(debtsList) {
  if (!Array.isArray(debtsList)) return [];

  return [...debtsList].sort((a, b) => {
    const aRemain = Number(a.remainingBalance) || 0;
    const bRemain = Number(b.remainingBalance) || 0;
    const aActive = (a.debtStatus === 'ACTIVE' || a.debtStatus === 'OVERDUE') && aRemain > 0;
    const bActive = (b.debtStatus === 'ACTIVE' || b.debtStatus === 'OVERDUE') && bRemain > 0;

    // 1. สัญญาที่ยังต้องชำระ (Active/Overdue) ต้องมาก่อนสัญญาที่จ่ายครบแล้ว (PAID)
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    // 2. ถ้าทั้งคู่ยังต้องชำระ ให้เรียงตามวันครบกำหนดชำระ (dueDate) ที่ถึงรอบก่อน (น้อยไปมาก)
    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
    if (dateA !== dateB) {
      return dateA - dateB;
    }

    // 3. หากวันครบกำหนดตรงกัน ให้เรียงตามแถวล่าสุด
    return (b.rowIndex || 0) - (a.rowIndex || 0);
  });
}

/**
 * ดึงข้อมูลครบวงจรสำหรับ Client Portal (โปรไฟล์, สัญญาทั้งหมด, ยอดหนี้, ประวัติการชำระ)
 * มีระบบ Multi-Tier Matching Engine ทนทานต่อ Provider Mismatch และ Emoji ที่ต่างกัน
 */
async function getClientData(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing userId' });
    }

    const displayName = (req.query.displayName || '').trim();
    const targetUserId = (req.query.targetUserId || req.query.userIdOverride || '').trim();
    const effectiveUserId = targetUserId || userId;

    // 1. ดึงข้อมูลทั้งหมดพร้อมกัน (3 requests แทนที่จะเป็น 4) — getAllDebts เรียก getAllDebtors ภายใน
    //    ดังนั้นเราดึง allDebts+allDebtors+allPayments แบบ parallel แล้ว filter ใน memory แทน
    const [allDebts, allDebtors, allPayments] = await Promise.all([
      sheetsService.getAllDebts(),
      sheetsService.getAllDebtors(),
      sheetsService.getAllPayments()
    ]);

    // หา debtor และ debts จากข้อมูลที่ดึงมาแล้ว (ไม่ยิง request เพิ่ม)
    let debtor = allDebtors.find(d => d.userId === effectiveUserId) || null;
    let debts = allDebts.filter(d => d.userId === effectiveUserId);

    // 2. Matching Engine: หากไม่พบสัญญาด้วย userId โดยตรง ให้ค้นหาจากชื่อลูกหนี้ที่ตรงกัน
    if (debts.length === 0) {
      const normInputName = normalizeDebtorName(displayName);

      // Tier 2: ค้นหาจากฐานข้อมูลลูกหนี้ (allDebtors) ด้วยชื่อที่ตรงกัน
      let matchedDebtor = null;
      if (normInputName) {
        matchedDebtor = allDebtors.find(d => {
          const dNorm = normalizeDebtorName(d.fullName || d.displayName);
          return dNorm && dNorm === normInputName;
        });
      }

      // หากเจอลูกหนี้ที่ชื่อตรงกันพอดี ให้ดึงสัญญาหนี้ทั้งหมดตาม userId ของลูกหนี้รายนั้น
      if (matchedDebtor && matchedDebtor.userId) {
        debtor = matchedDebtor;
        debts = allDebts.filter(d => d.userId === matchedDebtor.userId);
      }

      // Tier 3: ค้นหาจาก debtorName ใน allDebts ที่ตรงกันพอดี
      if (debts.length === 0 && normInputName) {
        debts = allDebts.filter(d => {
          const normDebtorName = normalizeDebtorName(d.debtorName);
          return normDebtorName && normDebtorName === normInputName;
        });
      }

      // อัปเดตข้อมูลโปรไฟล์ debtor ให้ตรงกับสัญญาที่ค้นพบ
      if (debts.length > 0 && !debtor) {
        const debtOwnerUserId = debts[0].userId;
        debtor = allDebtors.find(d => d.userId === debtOwnerUserId) || null;
      }

      // เรียงลำดับสัญญา Active/Overdue ขึ้นก่อน และสัญญาที่ถึงรอบก่อนขึ้นก่อน
      if (debts.length > 0) {
        debts = sortDebtsByDueDate(debts);
      }
    }

    // เรียงลำดับสัญญาหนี้ทั้งหมด: สัญญาที่ถึงรอบชำระก่อนให้แสดงก่อนเสมอ
    if (debts.length > 0) {
      debts = sortDebtsByDueDate(debts);
    }

    // 3. Auto-Register: เฉพาะผู้ใช้จริงรายใหม่ที่ไม่มีข้อมูลในระบบเลย และไม่ตรงกับลูกหนี้เดิม
    if (!debtor && debts.length === 0 && displayName && userId.startsWith('U') && userId !== 'U_DEMO_CLIENT' && userId !== 'U_DEMO_GUEST') {
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

    // 4. คัดแยกสัญญาที่ยังต้องผ่อนชำระ (ACTIVE หรือ OVERDUE ที่ remainingBalance > 0)
    // สัญญาที่ชำระครบแล้ว (PAID หรือ remainingBalance <= 0) จะถูกตัดออกจากหน้าลูกหนี้ และเก็บไว้ในระบบประวัติหน้าแอดมิน (LINE Debt Admin)
    const unpaidDebts = debts.filter(d => {
      const remain = Number(d.remainingBalance) || 0;
      const status = String(d.debtStatus || '').toUpperCase();
      return status !== 'PAID' && status !== 'COMPLETED' && remain > 0;
    });

    const paidDebts = debts.filter(d => {
      const remain = Number(d.remainingBalance) || 0;
      const status = String(d.debtStatus || '').toUpperCase();
      return status === 'PAID' || status === 'COMPLETED' || remain <= 0;
    });

    const activeDebts = unpaidDebts;
    const activeDebt = activeDebts.length > 0 ? activeDebts[0] : null;
    const totalPrincipalAll = unpaidDebts.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
    const totalRemainingAll = unpaidDebts.reduce((sum, d) => sum + (Number(d.remainingBalance) || 0), 0);
    const totalPaidAll = Math.max(0, totalPrincipalAll - totalRemainingAll);

    // 5. รวบรวมประวัติการชำระเงินของสัญญาทั้งหมด (ใช้ allPayments จาก Promise.all ด้านบน — ไม่ยิง request ซ้ำ)
    let payments = [];
    if (debts.length > 0) {
      const debtIds = new Set(debts.map(d => d.debtId));
      const targetUserIds = new Set([userId, debtor?.userId, ...debts.map(d => d.userId)].filter(Boolean));
      payments = allPayments.filter(p => debtIds.has(p.debtId) || targetUserIds.has(p.userId));
    } else {
      payments = allPayments.filter(p => p.userId === userId);
    }

    // ป้องกันการรั่วไหลของข้อมูลอ่อนไหว (PDPA Compliance Data Masking)
    const safeDebtor = debtor ? {
      ...debtor,
      idCardNumber: maskIdCard(debtor.idCardNumber),
      phone: maskPhone(debtor.phone)
    } : null;

    return res.status(200).json({
      success: true,
      data: {
        debtor: safeDebtor,
        activeDebt,
        debts: unpaidDebts,
        paidDebts,
        totalPrincipalAll,
        totalRemainingAll,
        totalPaidAll,
        totalContractsCount: unpaidDebts.length,
        activeContractsCount: unpaidDebts.length,
        allContractsCount: debts.length,
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

    // แปลง base64 เป็น Buffer และคำนวณ Hash
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const fileHash = computeImageHash(cleanBase64);
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
        uploadedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        fileHash
      };
    } else {
      paymentRecord = await sheetsService.recordPayment({
        debtId: targetDebtId,
        userId,
        amount: amount ? Number(amount) : 0,
        driveFileId: driveResult?.fileId || '',
        slipViewUrl: driveResult?.webViewLink || (driveResult?.fileId ? `https://lh3.googleusercontent.com/d/${driveResult.fileId}` : ''),
        adminNote: 'อัปโหลดผ่านเว็บ LIFF',
        fileHash
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
