const cron = require('node-cron');
const { runDailyReminderCheck } = require('../services/reminderService');
const reminderSettingsService = require('../services/reminderSettingsService');

let scheduledTasks = [];

/**
 * แปลงสตริงเวลา HH:mm เป็น cron expression
 */
function parseTimeToCron(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return '0 8 * * *';
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const hour = isNaN(h) ? 8 : Math.max(0, Math.min(23, h));
  const min = isNaN(m) ? 0 : Math.max(0, Math.min(59, m));
  return `${min} ${hour} * * *`;
}

/**
 * เริ่มต้นหรือปรับตั้งเวลา Cron Job แบบไดนามิกตามการตั้งค่าของผู้ดูแลระบบ
 */
async function initDailyReminderCron() {
  const timezone = process.env.TIMEZONE || 'Asia/Bangkok';

  // ล้าง Task เก่าที่รันอยู่
  if (scheduledTasks.length > 0) {
    scheduledTasks.forEach(task => task.stop());
    scheduledTasks = [];
  }

  try {
    const settings = await reminderSettingsService.getSettings();
    const primaryCron = parseTimeToCron(settings.primaryTime || '08:00');

    const primaryTask = cron.schedule(
      primaryCron,
      async () => {
        console.log(`⏰ [Cron Job] Executing primary reminder check (${settings.primaryTime || '08:00'})...`);
        try {
          await runDailyReminderCheck({ triggerType: `อัตโนมัติ (รอบหลัก ${settings.primaryTime || '08:00'})` });
        } catch (error) {
          console.error('❌ [Cron Job Error]:', error.message);
        }
      },
      { scheduled: true, timezone }
    );
    scheduledTasks.push(primaryTask);
    console.log(`⏱️ Cron Job Scheduled: Primary at ${settings.primaryTime || '08:00'} (${timezone}) [${primaryCron}]`);

    // รอบรอง (ถ้าเปิดใช้งาน)
    if (settings.secondaryTimeEnabled && settings.secondaryTime) {
      const secondaryCron = parseTimeToCron(settings.secondaryTime);
      const secondaryTask = cron.schedule(
        secondaryCron,
        async () => {
          console.log(`⏰ [Cron Job] Executing secondary reminder check (${settings.secondaryTime})...`);
          try {
            await runDailyReminderCheck({ triggerType: `อัตโนมัติ (รอบเสริม ${settings.secondaryTime})` });
          } catch (error) {
            console.error('❌ [Cron Job Error]:', error.message);
          }
        },
        { scheduled: true, timezone }
      );
      scheduledTasks.push(secondaryTask);
      console.log(`⏱️ Cron Job Scheduled: Secondary at ${settings.secondaryTime} (${timezone}) [${secondaryCron}]`);
    }
  } catch (err) {
    console.warn('Fallback to default 08:00 AM cron schedule:', err.message);
    const defaultTask = cron.schedule(
      '0 8 * * *',
      async () => {
        try {
          await runDailyReminderCheck({ triggerType: 'อัตโนมัติ (รอบมาตรฐาน 08:00)' });
        } catch (error) {
          console.error('❌ [Cron Job Error]:', error.message);
        }
      },
      { scheduled: true, timezone }
    );
    scheduledTasks.push(defaultTask);
  }
}

module.exports = {
  initDailyReminderCron,
  rescheduleDailyReminderCron: initDailyReminderCron
};
