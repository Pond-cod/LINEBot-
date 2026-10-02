const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const sheetsService = require('./sheetsService');
const lineService = require('./lineService');
const reminderSettingsService = require('./reminderSettingsService');
const reminderProfileService = require('./reminderProfileService');
const { createReminderFlex, createAdminDailySummaryFlex } = require('../templates/flexMessages');
const { getAdminUserIds } = require('../middleware/adminAuth');

/**
 * สแกนและส่งข้อความแจ้งเตือนหนี้ครบกำหนดชำระตามระบบ Reminder Engine v5.0
 * รองรับ 3-Tier Hierarchy:
 * 1. Contract-level override (highest)
 * 2. Debtor-level default
 * 3. System Global Default Profile
 */
async function runDailyReminderCheck(options = {}) {
  const globalSettings = options.customSettings || await reminderSettingsService.getSettings();
  const triggerType = options.triggerType || 'อัตโนมัติ (Schedule)';
  const tz = globalSettings.timezone || 'Asia/Bangkok';

  console.log(`⏰ [Reminder Engine v5.0] Starting scan (${triggerType})...`);

  // ตรวจสอบสวิตช์หลักของระบบ
  if (!globalSettings.enabled && !options.forceRun) {
    console.log('⏸️ [Reminder Check] Automated reminders are currently disabled in global settings.');
    return {
      disabled: true,
      message: 'ระบบแจ้งเตือนหลักถูกปิดการใช้งานอยู่ในการตั้งค่า'
    };
  }

  // 1. โหลดโปรไฟล์แจ้งเตือนทั้งหมด
  const allProfiles = await reminderProfileService.getAllProfiles();
  const profileMap = new Map();
  allProfiles.forEach(p => profileMap.set(p.profileId, p));

  const defaultProfile = allProfiles.find(p => p.isDefault && p.status === 'ACTIVE') ||
                         allProfiles.find(p => p.status === 'ACTIVE') ||
                         allProfiles[0];

  // 2. ดึงข้อมูลสัญญาและลูกหนี้ทั้งหมด
  const debts = await sheetsService.getAllDebts();
  const debtors = await sheetsService.getAllDebtors();
  const debtorsMap = new Map();
  debtors.forEach(d => debtorsMap.set(d.userId, d));

  const todayDateObj = dayjs().tz(tz);
  const todayStr = todayDateObj.format('YYYY-MM-DD');
  const todayDay = todayDateObj.date();
  const isLastDayOfMonth = todayDateObj.endOf('month').format('YYYY-MM-DD') === todayStr;

  const candidates = [];

  for (const d of debts) {
    const debtStatus = (d.debtStatus || 'ACTIVE').toUpperCase();
    if (!d.dueDate || debtStatus === 'PAID' || debtStatus === 'SETTLED') continue;
    if ((d.remainingBalance || 0) <= 0) continue;

    const debtor = debtorsMap.get(d.userId) || { fullName: d.debtorName || 'คุณลูกค้า', reminderEnabled: true, reminderProfileId: '' };

    // 3-Tier Hierarchy Check:
    // Tier 1: Contract-level toggle
    if (d.reminderEnabled === false) {
      continue; // ปิดเตือนระดับสัญญา
    }

    // Tier 2: Debtor-level toggle
    if (debtor.reminderEnabled === false) {
      continue; // ปิดเตือนระดับลูกหนี้
    }

    // Resolve Effective Profile
    let effectiveProfile = null;
    let resolvedProfileSource = 'DEFAULT';

    if (d.reminderProfileId && profileMap.has(d.reminderProfileId)) {
      const p = profileMap.get(d.reminderProfileId);
      if (p && p.status === 'ACTIVE') {
        effectiveProfile = p;
        resolvedProfileSource = 'CONTRACT';
      }
    }

    if (!effectiveProfile && debtor.reminderProfileId && profileMap.has(debtor.reminderProfileId)) {
      const p = profileMap.get(debtor.reminderProfileId);
      if (p && p.status === 'ACTIVE') {
        effectiveProfile = p;
        resolvedProfileSource = 'DEBTOR';
      }
    }

    if (!effectiveProfile) {
      if (defaultProfile && defaultProfile.status === 'ACTIVE') {
        effectiveProfile = defaultProfile;
        resolvedProfileSource = 'GLOBAL_DEFAULT';
      }
    }

    // หากไม่มีโปรไฟล์ที่เปิดใช้งาน ให้ข้าม
    if (!effectiveProfile) continue;

    // ประเมินเงื่อนไขการส่งแจ้งเตือนตาม Profile Frequency & Rules
    let reminderType = null;
    const rules = effectiveProfile.rulesConfig || {};
    const sched = effectiveProfile.scheduleConfig || {};
    const freq = effectiveProfile.frequencyType || 'DAILY';

    const beforeDays = Number(rules.remindBeforeDays) || 1;
    const beforeTargetDate = todayDateObj.add(beforeDays, 'day').format('YYYY-MM-DD');

    // Rule A: เตือนตรงวันครบกำหนด (Due Today)
    if (rules.remindDueTodayEnabled && d.dueDate === todayStr) {
      reminderType = 'DUE_TODAY';
    }
    // Rule B: เตือนล่วงหน้า (Pre-due)
    else if (rules.remindBeforeEnabled && d.dueDate === beforeTargetDate) {
      reminderType = `DUE_BEFORE_${beforeDays}_DAYS`;
    }
    // Rule C: เตือนเกินกำหนด (Overdue)
    else if (rules.remindOverdueEnabled && dayjs(d.dueDate).isBefore(todayDateObj, 'day')) {
      const daysOverdue = todayDateObj.diff(dayjs(d.dueDate), 'day');
      const overdueFreq = rules.overdueFrequency || 'DAILY';

      let shouldRemind = false;
      if (overdueFreq === 'DAILY') shouldRemind = true;
      else if (overdueFreq === 'EVERY_2_DAYS' && daysOverdue % 2 === 1) shouldRemind = true;
      else if (overdueFreq === 'EVERY_3_DAYS' && daysOverdue % 3 === 1) shouldRemind = true;
      else if (overdueFreq === 'WEEKLY' && daysOverdue % 7 === 1) shouldRemind = true;

      if (shouldRemind) {
        reminderType = 'OVERDUE';
      }
    }
    // Rule D: ความถี่ตามโปรไฟล์ (Schedule Frequency Patterns)
    if (!reminderType) {
      if (freq === 'DAILY') {
        const interval = Number(sched.dailyInterval) || 1;
        if (interval === 1) {
          reminderType = 'DAILY_SCHEDULE';
        } else {
          const createdDay = d.createdAt ? dayjs(d.createdAt).diff(todayDateObj, 'day') : 0;
          if (Math.abs(createdDay) % interval === 0) {
            reminderType = `DAILY_INTERVAL_${interval}`;
          }
        }
      } else if (freq === 'END_OF_MONTH') {
        if (isLastDayOfMonth) {
          reminderType = 'END_OF_MONTH';
        }
      } else if (freq === 'SPECIFIC_DAYS') {
        const targetDays = (sched.daysOfMonth || []).map(Number);
        const matchLastDay = sched.lastDayOfMonth && isLastDayOfMonth;
        if (targetDays.includes(todayDay) || matchLastDay) {
          reminderType = 'SPECIFIC_DAYS';
        }
      } else if (freq === 'MONTHLY') {
        const targetDay = Number(sched.dayOfMonth) || 1;
        const matchLastDay = sched.lastDayOfMonth && isLastDayOfMonth;
        if (todayDay === targetDay || matchLastDay) {
          reminderType = 'MONTHLY_SCHEDULE';
        }
      }
    }

    if (reminderType) {
      candidates.push({
        debtId: d.debtId,
        userId: d.userId,
        debtorName: debtor.fullName || debtor.displayName || 'คุณลูกค้า',
        installmentAmount: d.installmentAmount,
        remainingBalance: d.remainingBalance,
        dueDate: d.dueDate,
        debtStatus: d.debtStatus,
        reminderType,
        profile: effectiveProfile,
        profileSource: resolvedProfileSource
      });
    }
  }

  console.log(`📋 Found ${candidates.length} candidate debt records matching reminder profiles.`);

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    try {
      // ตรวจสอบการส่งซ้ำในวันเดียวกัน
      const alreadySent = await sheetsService.hasBeenRemindedToday(candidate.debtId, candidate.reminderType);
      if (alreadySent && !options.ignoreDuplicate) {
        console.log(`⏭️ Skipped debt ${candidate.debtId} for ${candidate.userId} (already sent today)`);
        skippedCount++;
        continue;
      }

      const prof = candidate.profile;
      const tpl = prof.templateConfig || {};
      const globalTpl = globalSettings.template || {};

      const bankAccountStr = (tpl.bankName && tpl.accountNumber)
        ? `${tpl.bankName} ${tpl.accountNumber}`
        : (globalTpl.bankName && globalTpl.accountNumber)
          ? `${globalTpl.bankName} ${globalTpl.accountNumber}`
          : 'กสิกรไทย (KBANK) 123-4-56789-0';

      const accountNameStr = tpl.accountName || globalTpl.accountName || 'ชื่อบัญชีผู้รับโอน';
      const promptPayStr = tpl.promptPayNumber || globalTpl.promptPayNumber || '';
      const customHeaderStr = tpl.customHeader || prof.name || globalTpl.customHeader || '';
      const customFooterStr = tpl.customFooter || globalTpl.customFooter || '';
      const toneStr = tpl.tone || globalTpl.tone || 'POLITE';

      const flexMsg = createReminderFlex({
        debtorName: candidate.debtorName,
        debtId: candidate.debtId,
        installmentAmount: candidate.installmentAmount,
        remainingBalance: candidate.remainingBalance,
        dueDate: candidate.dueDate,
        reminderType: candidate.reminderType,
        tone: toneStr,
        bankAccount: bankAccountStr,
        accountName: accountNameStr,
        promptPayNumber: promptPayStr,
        customHeader: customHeaderStr,
        customFooter: customFooterStr
      });

      // ส่งข้อความผ่าน LINE Messaging API
      await lineService.pushMessage(candidate.userId, flexMsg);

      // บันทึก Log ลงชีต ReminderLogs
      await sheetsService.logReminder({
        debtId: candidate.debtId,
        userId: candidate.userId,
        reminderType: `${candidate.reminderType} [${prof.profileId}]`,
        status: 'SUCCESS'
      });

      console.log(`✅ Sent [${prof.profileId}] reminder to user ${candidate.userId} (Debt: ${candidate.debtId})`);
      sentCount++;
    } catch (err) {
      console.error(`❌ Failed to send reminder for debt ${candidate.debtId}:`, err.message);
      await sheetsService.logReminder({
        debtId: candidate.debtId,
        userId: candidate.userId,
        reminderType: candidate.reminderType,
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

  // แจ้งเตือนสรุปผลไปยังแอดมิน
  if (globalSettings.notifyAdminOnRun && (sentCount > 0 || failedCount > 0 || options.forceRun)) {
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

  console.log(`🏁 [Reminder Engine v5.0] Finished: ${JSON.stringify(summary)}`);
  return summary;
}

module.exports = {
  runDailyReminderCheck
};
