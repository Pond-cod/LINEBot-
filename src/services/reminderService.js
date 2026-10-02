const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const sheetsService = require('./sheetsService');
const lineService = require('./lineService');
const reminderSettingsService = require('./reminderSettingsService');
const { createReminderFlex, createAdminDailySummaryFlex } = require('../templates/flexMessages');
const { getAdminUserIds } = require('../middleware/adminAuth');

/**
 * สแกนและส่งข้อความแจ้งเตือนหนี้ครบกำหนดชำระตามการตั้งค่าแบบละเอียด
 */
async function runDailyReminderCheck(options = {}) {
  const settings = options.customSettings || await reminderSettingsService.getSettings();
  const triggerType = options.triggerType || 'อัตโนมัติ (Schedule)';
  const tz = settings.timezone || 'Asia/Bangkok';

  console.log(`⏰ [Reminder Check] Starting scan (${triggerType})...`);

  // ตรวจสอบสวิตช์หลัก
  if (!settings.enabled && !options.forceRun) {
    console.log('⏸️ [Reminder Check] Automated reminders are currently disabled in settings.');
    return {
      disabled: true,
      message: 'ระบบแจ้งเตือนถูกปิดการใช้งานอยู่ในการตั้งค่า'
    };
  }

  // 1. ดึงข้อมูลสัญญาและลูกหนี้ทั้งหมด
  const debts = await sheetsService.getAllDebts();
  const debtors = await sheetsService.getAllDebtors();
  const debtorsMap = new Map();
  debtors.forEach(d => debtorsMap.set(d.userId, d));

  const todayDateObj = dayjs().tz(tz);
  const todayStr = todayDateObj.format('YYYY-MM-DD');
  const todayDay = todayDateObj.date();
  const isLastDayOfMonth = todayDateObj.endOf('month').format('YYYY-MM-DD') === todayStr;

  const monthlyEnabled = Boolean(settings.monthlySchedule?.enabled);
  const matchMonthlyDay = monthlyEnabled && (
    (settings.monthlySchedule?.daysOfMonth || []).map(Number).includes(todayDay) ||
    (settings.monthlySchedule?.lastDayOfMonth && isLastDayOfMonth)
  );

  const beforeDays = settings.rules?.remindBeforeDays || 1;
  const beforeTargetDate = todayDateObj.add(beforeDays, 'day').format('YYYY-MM-DD');

  const candidates = [];

  for (const d of debts) {
    const debtStatus = (d.debtStatus || 'ACTIVE').toUpperCase();
    if (!d.dueDate || debtStatus === 'PAID' || debtStatus === 'SETTLED') continue;
    if ((d.remainingBalance || 0) <= 0) continue;

    let reminderType = null;

    // เงื่อนไข 1: เตือนในวันครบกำหนด (Due Today)
    if (settings.rules?.remindDueTodayEnabled && d.dueDate === todayStr) {
      reminderType = 'DUE_TODAY';
    }
    // เงื่อนไข 2: เตือนล่วงหน้า (Pre-due)
    else if (settings.rules?.remindBeforeEnabled && d.dueDate === beforeTargetDate) {
      reminderType = `DUE_BEFORE_${beforeDays}_DAYS`;
    }
    // เงื่อนไข 3: เตือนค้างชำระ / เกินกำหนด (Overdue)
    else if (settings.rules?.remindOverdueEnabled && dayjs(d.dueDate).isBefore(todayDateObj, 'day')) {
      const daysOverdue = todayDateObj.diff(dayjs(d.dueDate), 'day');
      const freq = settings.rules?.overdueFrequency || 'DAILY';

      let shouldRemind = false;
      if (freq === 'DAILY') shouldRemind = true;
      else if (freq === 'EVERY_2_DAYS' && daysOverdue % 2 === 1) shouldRemind = true;
      else if (freq === 'EVERY_3_DAYS' && daysOverdue % 3 === 1) shouldRemind = true;
      else if (freq === 'WEEKLY' && daysOverdue % 7 === 1) shouldRemind = true;

      if (shouldRemind) {
        reminderType = 'OVERDUE';
      }
    }
    // เงื่อนไข 4: แจ้งเตือนรอบประจำเดือน / วันที่ระบุของเดือน (Monthly Scheduled Day)
    else if (matchMonthlyDay) {
      reminderType = 'MONTHLY_SCHEDULE';
    }

    if (reminderType) {
      const debtorInfo = debtorsMap.get(d.userId) || { fullName: d.debtorName || 'คุณลูกค้า' };
      candidates.push({
        debtId: d.debtId,
        userId: d.userId,
        debtorName: debtorInfo.fullName || debtorInfo.displayName || 'คุณลูกค้า',
        installmentAmount: d.installmentAmount,
        remainingBalance: d.remainingBalance,
        dueDate: d.dueDate,
        debtStatus: d.debtStatus,
        reminderType
      });
    }
  }

  console.log(`📋 Found ${candidates.length} candidate debt records matching reminder rules.`);

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const tpl = settings.template || {};
  const bankAccountStr = tpl.bankName && tpl.accountNumber
    ? `${tpl.bankName} ${tpl.accountNumber}`
    : 'กสิกรไทย (KBANK) 123-4-56789-0';

  for (const debt of candidates) {
    try {
      // ตรวจสอบว่าเคยส่งแจ้งเตือนประเภทนี้ในวันนี้แล้วหรือไม่
      const alreadySent = await sheetsService.hasBeenRemindedToday(debt.debtId, debt.reminderType);
      if (alreadySent && !options.ignoreDuplicate) {
        console.log(`⏭️ Skipped debt ${debt.debtId} for ${debt.userId} (already sent today)`);
        skippedCount++;
        continue;
      }

      // สร้าง Flex Message สำหรับแจ้งเตือนตามเทมเพลตที่กำหนด
      const flexMsg = createReminderFlex({
        debtorName: debt.debtorName,
        debtId: debt.debtId,
        installmentAmount: debt.installmentAmount,
        remainingBalance: debt.remainingBalance,
        dueDate: debt.dueDate,
        reminderType: debt.reminderType,
        tone: tpl.tone || 'POLITE',
        bankAccount: bankAccountStr,
        accountName: tpl.accountName || 'ชื่อบัญชีผู้รับโอน',
        promptPayNumber: tpl.promptPayNumber || '',
        customHeader: tpl.customHeader || '',
        customFooter: tpl.customFooter || ''
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
    totalCandidates: candidates.length,
    sent: sentCount,
    skipped: skippedCount,
    failed: failedCount,
    time: dayjs().tz(tz).format('YYYY-MM-DD HH:mm:ss')
  };

  // แจ้งเตือนสรุปผลไปยังแอดมิน (ถ้าเปิดไว้)
  if (settings.notifyAdminOnRun && (sentCount > 0 || failedCount > 0 || options.forceRun)) {
    try {
      const adminIds = await getAdminUserIds();
      if (adminIds && adminIds.length > 0) {
        const adminSummaryFlex = createAdminDailySummaryFlex({
          triggerType,
          totalCandidates: summary.totalCandidates,
          sent: summary.sent,
          skipped: summary.skipped,
          failed: summary.failed,
          time: summary.time
        });

        for (const adminId of adminIds) {
          await lineService.pushMessage(adminId, adminSummaryFlex).catch(e => console.warn('Failed admin push:', e.message));
        }
      }
    } catch (adminErr) {
      console.warn('Could not push summary to admin:', adminErr.message);
    }
  }

  console.log(`🏁 [Reminder Check] Finished: ${JSON.stringify(summary)}`);
  return summary;
}

module.exports = {
  runDailyReminderCheck
};
