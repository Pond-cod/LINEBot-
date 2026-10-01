const cron = require('node-cron');
const { runDailyReminderCheck } = require('../services/reminderService');

/**
 * เริ่มต้นการทำงานของ Cron Job แจ้งเตือนยอดหนี้ทุกวันเวลา 08:00 น.
 */
function initDailyReminderCron() {
  const timezone = process.env.TIMEZONE || 'Asia/Bangkok';

  // รูปแบบ Cron: 'วินาที(optional) นาที ชั่วโมง วันที่ เดือน วันในสัปดาห์'
  // '0 8 * * *' = ทำงานทุกวัน เวลา 08:00 น.
  cron.schedule(
    '0 8 * * *',
    async () => {
      console.log('⏰ [Cron Job] Executing scheduled daily debt reminder check at 08:00 AM...');
      try {
        await runDailyReminderCheck();
      } catch (error) {
        console.error('❌ [Cron Job Error]:', error.message);
      }
    },
    {
      scheduled: true,
      timezone: timezone
    }
  );

  console.log(`⏱️ Cron Job Scheduled: Daily debt reminder at 08:00 AM (${timezone})`);
}

module.exports = {
  initDailyReminderCron
};
