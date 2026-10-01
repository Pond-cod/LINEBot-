const sheetsService = require('./sheetsService');
const lineService = require('./lineService');
const { createReminderFlex } = require('../templates/flexMessages');

/**
 * สแกนและส่งข้อความแจ้งเตือนหนี้ครบกำหนดชำระ
 */
async function runDailyReminderCheck() {
  console.log('⏰ [Daily Reminder] Starting reminder scan...');
  
  const dueDebts = await sheetsService.getDueDebtsForReminder();
  console.log(`📋 Found ${dueDebts.length} candidate debt records for reminder.`);

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const debt of dueDebts) {
    try {
      // ตรวจสอบว่าเคยส่งแจ้งเตือนประเภทนี้ในวันนี้แล้วหรือไม่
      const alreadySent = await sheetsService.hasBeenRemindedToday(debt.debtId, debt.reminderType);
      if (alreadySent) {
        console.log(`⏭️ Skipped debt ${debt.debtId} for ${debt.userId} (already sent today)`);
        skippedCount++;
        continue;
      }

      // สร้าง Flex Message สำหรับแจ้งเตือน
      const flexMsg = createReminderFlex({
        debtorName: debt.debtorName,
        debtId: debt.debtId,
        installmentAmount: debt.installmentAmount,
        remainingBalance: debt.remainingBalance,
        dueDate: debt.dueDate,
        reminderType: debt.reminderType
      });

      // ยิง Push Message ไปยัง LINE ของลูกหนี้
      await lineService.pushMessage(debt.userId, flexMsg);

      // บันทึก Log ลง Google Sheets
      await sheetsService.logReminder({
        debtId: debt.debtId,
        userId: debt.userId,
        reminderType: debt.reminderType,
        status: 'SUCCESS'
      });

      console.log(`✅ Sent ${debt.reminderType} reminder to user ${debt.userId} (Debt: ${debt.debtId})`);
      sentCount++;
    } catch (err) {
      console.error(`❌ Failed to send reminder for debt ${debt.debtId}:`, err.message);
      await sheetsService.logReminder({
        debtId: debt.debtId,
        userId: debt.userId,
        reminderType: debt.reminderType,
        status: `FAILED: ${err.message}`
      });
      failedCount++;
    }
  }

  const summary = {
    totalCandidates: dueDebts.length,
    sent: sentCount,
    skipped: skippedCount,
    failed: failedCount
  };

  console.log(`🏁 [Daily Reminder] Finished: ${JSON.stringify(summary)}`);
  return summary;
}

module.exports = {
  runDailyReminderCheck
};
