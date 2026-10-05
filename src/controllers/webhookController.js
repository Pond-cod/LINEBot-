const dayjs = require('dayjs');
const lineService = require('../services/lineService');
const sheetsService = require('../services/sheetsService');
const driveService = require('../services/driveService');
const reminderSettingsService = require('../services/reminderSettingsService');
const { checkDuplicateSlip, computeImageHash } = require('../services/slipVerificationService');
const {
  createSlipReceivedFlex,
  createDebtSummaryFlex,
  createWelcomeFlex
} = require('../templates/flexMessages');

/**
 * จัดการ LINE Webhook Events
 */
async function handleWebhookEvent(event) {
  const userId = event.source?.userId;
  const replyToken = event.replyToken;

  // 1. จัดการ Event: มีการเพิ่มเพื่อนใหม่ (Follow)
  if (event.type === 'follow') {
    const profile = await lineService.getProfile(userId);
    const displayName = profile?.displayName || 'ผู้ใช้งาน';
    const liffUrl = 'https://lineautomatic.vercel.app/client/#';

    const welcomeMsg = createWelcomeFlex({ displayName, liffUrl });
    return await lineService.replyMessage(replyToken, welcomeMsg);
  }

  // 2. จัดการ Event: ได้รับข้อความ (Message)
  if (event.type === 'message') {
    const message = event.message;

    // 2.1 กรณีส่งรูปภาพ (Image) -> จัดเก็บสลิปโอนเงิน
    if (message.type === 'image') {
      try {
        console.log(`📸 Received image message from user: ${userId} (MsgID: ${message.id})`);

        // 1. สตรีมไฟล์ภาพจาก LINE API และแปลงเป็น Buffer
        const imageStream = await lineService.getMessageStream(message.id);
        const chunks = [];
        for await (const chunk of imageStream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const imageBase64 = buffer.toString('base64');
        const fileHash = computeImageHash(imageBase64);

        // 2. ตรวจสอบสลิปซ้ำ (Anti-Fraud Duplicate Detection)
        try {
          const existingPayments = await sheetsService.getAllPayments();
          const dupCheck = checkDuplicateSlip(imageBase64, 0, existingPayments);
          if (dupCheck.isDuplicate) {
            console.warn(`⚠️ Duplicate slip rejected for user ${userId}: ${dupCheck.reason}`);
            return await lineService.replyMessage(replyToken, {
              type: 'text',
              text: `⚠️ ระบบตรวจพบว่ารูปภาพสลิปนี้เคยถูกส่งเข้าระบบแล้วครับ\n\n📌 รายการอ้างอิง: ${dupCheck.matchedPaymentId || '-'}\nหากท่านมีข้อสงสัย กรุณาติดต่อเจ้าหน้าที่ได้เลยครับ`
            });
          }
        } catch (dupErr) {
          console.warn('Duplicate check warning:', dupErr.message);
        }

        // 3. ค้นหาสัญญาหนี้ที่ใช้งานอยู่ของผู้ใช้รายนี้
        const activeDebt = await sheetsService.getActiveDebtByUserId(userId);
        const debtId = activeDebt?.debtId || '';

        // 4. บันทึกรูปภาพลง Google Drive
        const timestamp = dayjs().format('YYYYMMDD_HHmmss');
        const fileName = `SLIP_${userId}_${timestamp}.jpg`;
        const driveResult = await driveService.uploadSlipBuffer(buffer, fileName, 'image/jpeg', userId, debtId);

        // 5. บันทึกลง Google Sheets
        let paymentRecord = null;
        if (driveResult && driveResult.paymentId) {
          paymentRecord = {
            paymentId: driveResult.paymentId,
            debtId,
            userId,
            uploadedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            slipViewUrl: driveResult.webViewLink,
            fileHash
          };
        } else {
          paymentRecord = await sheetsService.recordPayment({
            debtId,
            userId,
            amount: 0,
            driveFileId: driveResult?.fileId || '',
            slipViewUrl: driveResult?.webViewLink || (driveResult?.fileId ? `https://lh3.googleusercontent.com/d/${driveResult.fileId}` : ''),
            adminNote: 'ส่งผ่าน LINE Chat',
            fileHash
          });
        }

        // 6. ส่ง Flex Message ตอบกลับยืนยันการรับสลิป
        const flexConfirm = createSlipReceivedFlex({
          paymentId: paymentRecord.paymentId,
          debtId: debtId || 'ยังไม่มีสัญญาผูกไว้',
          uploadedAt: paymentRecord.uploadedAt,
          slipViewUrl: driveResult.webViewLink
        });

        return await lineService.replyMessage(replyToken, flexConfirm);
      } catch (error) {
        console.error('❌ Error handling image slip:', error);
        return await lineService.replyMessage(replyToken, {
          type: 'text',
          text: '⚠️ ขออภัยครับ ระบบไม่สามารถบันทึกสลิปของคุณได้ในขณะนี้ กรุณาติดต่อเจ้าหน้าที่ หรือลองใหม่อีกครั้ง'
        });
      }
    }

    // 2.2 กรณีส่งข้อความตัวอักษร (Text)
    if (message.type === 'text') {
      const text = message.text.trim();

      // ตรวจสอบคีย์เวิร์ด
      if (['เช็กยอด', 'เช็คยอด', 'ยอดหนี้', 'ดูยอด', 'ยอดคงเหลือ'].some(kw => text.includes(kw))) {
        const [activeDebt, debtor] = await Promise.all([
          sheetsService.getActiveDebtByUserId(userId),
          sheetsService.getDebtorByUserId(userId)
        ]);

        if (activeDebt) {
          const summaryFlex = createDebtSummaryFlex({
            debtorName: debtor?.fullName || debtor?.displayName || 'คุณลูกค้า',
            debtId: activeDebt.debtId,
            totalAmount: activeDebt.totalAmount,
            remainingBalance: activeDebt.remainingBalance,
            installmentAmount: activeDebt.installmentAmount,
            dueDate: activeDebt.dueDate,
            debtStatus: activeDebt.debtStatus
          });
          return await lineService.replyMessage(replyToken, summaryFlex);
        } else {
          return await lineService.replyMessage(replyToken, {
            type: 'text',
            text: `ไม่พบข้อมูลสัญญาหนี้ที่กำลังเปิดใช้งานของคุณในระบบครับ 📋\n\nหากต้องการลงทะเบียนหรือบันทึกข้อมูล สามารถเปิดฟอร์มได้ที่: https://lineautomatic.vercel.app/client/#`
          });
        }
      }

      if (['ส่งสลิป', 'แนบสลิป', 'ส่งรูปสลิป', 'แจ้งโอน', 'แนบรูป'].some(kw => text.includes(kw))) {
        const liffUrl = 'https://lineautomatic.vercel.app/client/#';
        return await lineService.replyMessage(replyToken, {
          type: 'text',
          text: `📸 คุณสามารถถ่ายภาพหรือแนบรูปสลิปส่งเข้ามาในแชทนี้ได้เลยครับ ระบบจะบันทึกเข้า Google Drive และตัดยอดให้อัตโนมัติครับ ✨\n\nหรือกดส่งและตรวจสอบยอดผ่านระบบได้ที่:\n${liffUrl}`
        });
      }

      if (['วิธีชำระเงิน', 'เลขบัญชี', 'โอนเงิน', 'ชำระเงิน', 'ข้อมูลการชำระเงิน'].some(kw => text.includes(kw))) {
        let bankName = 'ธนาคารกสิกรไทย (KBANK)';
        let accountNumber = '123-4-56789-0';
        let accountName = 'ชื่อบัญชีผู้รับโอน';
        let promptPay = '';
        let customFooter = 'เมื่อโอนเงินเรียบร้อยแล้ว สามารถถ่ายภาพหรือส่งรูปสลิปเข้ามาในแชทนี้ได้ทันทีครับ 📸';

        try {
          const settings = await reminderSettingsService.getSettings();
          const tpl = settings.template || {};
          if (tpl.bankName) bankName = tpl.bankName;
          if (tpl.accountNumber) accountNumber = tpl.accountNumber;
          if (tpl.accountName) accountName = tpl.accountName;
          if (tpl.promptPayNumber) promptPay = `\n• พร้อมเพย์: ${tpl.promptPayNumber}`;
          if (tpl.customFooter) customFooter = tpl.customFooter;
        } catch (settingsErr) {
          console.warn('Could not load dynamic bank settings:', settingsErr.message);
        }

        return await lineService.replyMessage(replyToken, {
          type: 'text',
          text: `💳 ช่องทางการชำระเงิน:\n\n• ธนาคาร: ${bankName}\n• เลขที่บัญชี: ${accountNumber}\n• ชื่อบัญชี: ${accountName}${promptPay}\n\n${customFooter}`
        });
      }

      if (['ติดต่อเจ้าหน้าที่', 'ติดต่อแอดมิน', 'ติดต่อสอบถาม', 'โทร', 'เจ้าหน้าที่'].some(kw => text.includes(kw))) {
        let contactPhone = '02-123-4567';
        try {
          const settings = await reminderSettingsService.getSettings();
          if (settings.contactPhone || settings.companyPhone) {
            contactPhone = settings.contactPhone || settings.companyPhone;
          }
        } catch (e) {}

        return await lineService.replyMessage(replyToken, {
          type: 'text',
          text: `📞 ฝ่ายบริการลูกค้าและติดต่อเจ้าหน้าที่:\n\n• โทรศัพท์: ${contactPhone}\n• เวลาทำการ: จันทร์ - ศุกร์ 08:30 - 17:30 น.\n\nหากท่านต้องการแจ้งชำระเงิน สามารถถ่ายภาพและส่งรูปสลิปในแชทนี้ได้ตลอด 24 ชม. ครับ 📋`
        });
      }

      if (['ลงทะเบียน', 'กรอกข้อมูล', 'ฟอร์ม'].some(kw => text.includes(kw))) {
        const liffUrl = 'https://lineautomatic.vercel.app/client/#';
        return await lineService.replyMessage(replyToken, {
          type: 'text',
          text: `📝 คุณสามารถเปิดฟอร์มลงทะเบียนและจัดการข้อมูลได้ที่ลิงก์นี้ครับ:\n${liffUrl}`
        });
      }

      // Default Help Text
      return await lineService.replyMessage(replyToken, {
        type: 'text',
        text: `สวัสดีครับ 🙏 คุณสามารถใช้งานระบบได้ดังนี้:\n\n• ส่ง "รูปสลิป" เพื่อบันทึกการชำระเงิน\n• พิมพ์ "เช็กยอด" เพื่อดูยอดหนี้คงเหลือ\n• พิมพ์ "วิธีชำระเงิน" เพื่อดูเลขบัญชี\n• พิมพ์ "ติดต่อเจ้าหน้าที่" เพื่อสอบถามข้อมูล\n• พิมพ์ "ลงทะเบียน" เพื่อกรอกข้อมูลใหม่ผ่าน LIFF`
      });
    }
  }

  return null;
}

module.exports = {
  handleWebhookEvent
};
