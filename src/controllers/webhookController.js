const dayjs = require('dayjs');
const lineService = require('../services/lineService');
const sheetsService = require('../services/sheetsService');
const driveService = require('../services/driveService');
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
    const liffUrl = `https://liff.line.me/${process.env.LIFF_ID}`;

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

        // 1. สตรีมไฟล์ภาพจาก LINE API
        const imageStream = await lineService.getMessageStream(message.id);

        // 2. ค้นหาสัญญาหนี้ที่ใช้งานอยู่ของผู้ใช้รายนี้
        const activeDebt = await sheetsService.getActiveDebtByUserId(userId);
        const debtId = activeDebt?.debtId || '';

        // 3. บันทึกรูปภาพลง Google Drive
        const timestamp = dayjs().format('YYYYMMDD_HHmmss');
        const fileName = `SLIP_${userId}_${timestamp}.jpg`;
        const driveResult = await driveService.uploadSlipStream(imageStream, fileName, 'image/jpeg', userId, debtId);

        // 5. บันทึกลง Google Sheets (หากยังไม่ได้บันทึกโดย GAS)
        let paymentRecord = null;
        if (driveResult.paymentId) {
          paymentRecord = {
            paymentId: driveResult.paymentId,
            debtId,
            userId,
            uploadedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            slipViewUrl: driveResult.webViewLink
          };
        } else {
          paymentRecord = await sheetsService.recordPayment({
            debtId,
            userId,
            amount: 0,
            driveFileId: driveResult.fileId,
            slipViewUrl: driveResult.webViewLink,
            adminNote: 'ส่งผ่าน LINE Chat'
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
            text: `ไม่พบข้อมูลสัญญาหนี้ที่กำลังเปิดใช้งานของคุณในระบบครับ 📋\n\nหากต้องการลงทะเบียนหรือบันทึกข้อมูล สามารถเปิดฟอร์มได้ที่: https://liff.line.me/${process.env.LIFF_ID}`
          });
        }
      }

      if (['ส่งสลิป', 'แนบสลิป', 'ส่งรูปสลิป', 'แจ้งโอน', 'แนบรูป'].some(kw => text.includes(kw))) {
        const liffUrl = `https://liff.line.me/${process.env.LIFF_ID || ''}`;
        return await lineService.replyMessage(replyToken, {
          type: 'text',
          text: `📸 คุณสามารถถ่ายภาพหรือแนบรูปสลิปส่งเข้ามาในแชทนี้ได้เลยครับ ระบบจะบันทึกเข้า Google Drive และตัดยอดให้อัตโนมัติครับ ✨\n\nหรือกดส่งและตรวจสอบยอดผ่านระบบได้ที่:\n${liffUrl}`
        });
      }

      if (['วิธีชำระเงิน', 'เลขบัญชี', 'โอนเงิน', 'ชำระเงิน'].some(kw => text.includes(kw))) {
        return await lineService.replyMessage(replyToken, {
          type: 'text',
          text: `💳 ช่องทางการชำระเงิน:\n\n• ธนาคาร: กสิกรไทย (KBANK)\n• เลขที่บัญชี: 123-4-56789-0\n• ชื่อบัญชี: ระบบจัดการหนี้\n\nเมื่อโอนเงินเรียบร้อยแล้ว สามารถถ่ายภาพหรือส่งรูปสลิปเข้ามาในแชทนี้ได้ทันทีครับ 📸`
        });
      }

      if (['ลงทะเบียน', 'กรอกข้อมูล', 'ฟอร์ม'].some(kw => text.includes(kw))) {
        const liffUrl = `https://liff.line.me/${process.env.LIFF_ID}`;
        return await lineService.replyMessage(replyToken, {
          type: 'text',
          text: `📝 คุณสามารถเปิดฟอร์มลงทะเบียนและจัดการข้อมูลได้ที่ลิงก์นี้ครับ:\n${liffUrl}`
        });
      }

      // Default Help Text
      return await lineService.replyMessage(replyToken, {
        type: 'text',
        text: `สวัสดีครับ 🙏 คุณสามารถใช้งานระบบได้ดังนี้:\n\n• ส่ง "รูปสลิป" เพื่อบันทึกการชำระเงิน\n• พิมพ์ "เช็กยอด" เพื่อดูยอดหนี้คงเหลือ\n• พิมพ์ "วิธีชำระเงิน" เพื่อดูเลขบัญชี\n• พิมพ์ "ลงทะเบียน" เพื่อกรอกข้อมูลใหม่ผ่าน LIFF`
      });
    }
  }

  return null;
}

module.exports = {
  handleWebhookEvent
};
