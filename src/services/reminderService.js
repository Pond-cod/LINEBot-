const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const {
  normalizeDate,
  isLegalDebtCollectionTime,
  findMatchingTimeSlot,
  isDayOfWeekAllowed
} = require('../utils/dateHelper');
const sheetsService = require('./sheetsService');
const lineService = require('./lineService');
const reminderSettingsService = require('./reminderSettingsService');
const reminderProfileService = require('./reminderProfileService');
const { createReminderFlex, createAdminDailySummaryFlex } = require('../templates/flexMessages');
const { getAdminUserIds } = require('../middleware/adminAuth');

/**
 * สแกนและส่งข้อความแจ้งเตือนหนี้ครบกำหนดชำระตามระบบ Reminder Engine v6.0 (Flexible Precision Engine)
 * - รองรับเวลาไทยแม่นยำ (Asia/Bangkok UTC+7)
 * - รองรับส่งหลายรอบต่อวัน (Multi-Time Slots e.g. 08:00, 18:00) และ Time-Window Matching
 * - รองรับกรองวันในสัปดาห์ (Days of Week e.g. จันทร์-ศุกร์)
 * - รองรับเตือนล่วงหน้าหลายขั้น (Multi-Step Pre-Due e.g. 3, 1 วัน)
 * - รองรับเตือนเกินกำหนดแบบลำดับขั้น (Overdue Escalation Tiers 1, 2, 3)
 * - ป้องกันส่งซ้ำแยกตาม Time Slot
 * - รองรับกำหนดเวลารายสัญญาเฉพาะเจาะจง (customReminderTimes)
 */
// In-memory cache ป้องกันการส่งซ้ำภายในวันเดียวกันระดับ Process (Key: YYYY-MM-DD:debtId:slot)
const inMemorySentCache = new Set();

function getSentKey(todayStr, debtId, slot) {
  return `${todayStr}:${debtId}:${slot || '08:00'}`;
}

async function runDailyReminderCheck(options = {}) {
  const globalSettings = options.customSettings || await reminderSettingsService.getSettings();
  const triggerType = options.triggerType || 'อัตโนมัติ (Schedule)';
  const tz = globalSettings.timezone || 'Asia/Bangkok';

  const todayDateObj = dayjs().tz(tz);
  const currentBangkokTime = todayDateObj.format('HH:mm');

  if (!options.silentIfEmpty) {
    console.log(`⏰ [Reminder Engine v6.0] Starting scan (${triggerType}) at Bangkok time ${currentBangkokTime}...`);
  }

  // ตรวจสอบสวิตช์หลักของระบบ
  if (!globalSettings.enabled && !options.forceRun) {
    console.log('⏸️ [Reminder Check] Automated reminders are currently disabled in global settings.');
    return {
      disabled: true,
      currentBangkokTime,
      message: 'ระบบแจ้งเตือนหลักถูกปิดการใช้งานอยู่ในการตั้งค่า'
    };
  }

  // ตรวจสอบช่วงเวลาที่กฎหมายทวงถามหนี้ พ.ร.บ. 2558 อนุญาต (08:00-20:00 ในวันธรรมดา และ 08:00-18:00 ในวันหยุด)
  const legalCheck = isLegalDebtCollectionTime(todayDateObj);
  if (!legalCheck.allowed && !options.forceRun && !options.bypassLegalHours) {
    console.warn(`⚖️ [Legal Guard] Debt collection reminders paused: ${legalCheck.reason}`);
    return {
      paused: true,
      legalGuard: true,
      currentBangkokTime,
      reason: legalCheck.reason,
      message: `ระบบระงับการแจ้งเตือนชั่วคราวตาม พ.ร.บ. การทวงถามหนี้ พ.ศ. 2558: ${legalCheck.reason}`
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

    const rules = effectiveProfile.rulesConfig || {};
    const sched = effectiveProfile.scheduleConfig || {};
    const freq = effectiveProfile.frequencyType || 'DAILY';

    // 1. Day of Week Guard
    const allowedDays = sched.daysOfWeek || [1, 2, 3, 4, 5, 6, 0];
    if (!isDayOfWeekAllowed(allowedDays, todayDateObj)) {
      continue; // ไม่อยู่ในวันที่กำหนดให้ส่ง
    }

    // 2. Time-Slot Matching
    // ลำดับความสำคัญของ Time Slots: d.customReminderTimes > sched.timeSlots > [primaryTime, secondaryTime]
    const targetSlots = d.customReminderTimes || sched.timeSlots || [effectiveProfile.primaryTime, effectiveProfile.secondaryTime].filter(Boolean);

    let matchedSlot = '08:00';
    if (!options.forceRun && !options.ignoreTimeCheck) {
      const slotResult = findMatchingTimeSlot(targetSlots, options.windowMinutes || 35, todayDateObj);
      if (!slotResult.matched) {
        // เวลานี้ยังไม่ถึงรอบส่งของสัญญานี้
        continue;
      }
      matchedSlot = slotResult.matchedSlot;
    } else {
      matchedSlot = Array.isArray(targetSlots) ? (targetSlots[0] || '08:00') : (String(targetSlots).split(',')[0]?.trim() || '08:00');
    }

    // 3. ประเมินเงื่อนไขการส่งแจ้งเตือนตาม Profile Frequency & Rules
    let reminderType = null;
    let overdueDays = 0;
    let overdueTier = null;
    let resolvedTone = effectiveProfile.templateConfig?.tone || globalSettings.template?.tone || 'POLITE';

    const normDueDate = normalizeDate(d.dueDate);
    const diffDays = dayjs(normDueDate).diff(todayDateObj.startOf('day'), 'day');

    // Rule A: เตือนตรงวันครบกำหนด (Due Today)
    if (rules.remindDueTodayEnabled && diffDays === 0) {
      reminderType = 'DUE_TODAY';
    }
    // Rule B: เตือนล่วงหน้า (Pre-due หลายขั้นตอน เช่น 3, 1 วัน)
    else if (rules.remindBeforeEnabled && diffDays > 0) {
      const steps = (Array.isArray(rules.remindPreDueSteps) && rules.remindPreDueSteps.length > 0)
        ? rules.remindPreDueSteps.map(Number)
        : [Number(rules.remindBeforeDays) || 1];
      if (steps.includes(diffDays)) {
        reminderType = `DUE_BEFORE_${diffDays}_DAYS`;
      }
    }
    // Rule C: เตือนเกินกำหนด (Overdue พร้อม Escalation Tiers)
    else if (rules.remindOverdueEnabled && diffDays < 0) {
      overdueDays = Math.abs(diffDays);
      const overdueFreq = rules.overdueFrequency || 'DAILY';

      let shouldRemind = false;
      if (overdueFreq === 'DAILY') shouldRemind = true;
      else if (overdueFreq === 'EVERY_2_DAYS' && overdueDays % 2 === 1) shouldRemind = true;
      else if (overdueFreq === 'EVERY_3_DAYS' && overdueDays % 3 === 1) shouldRemind = true;
      else if (overdueFreq === 'WEEKLY' && overdueDays % 7 === 1) shouldRemind = true;

      if (shouldRemind) {
        reminderType = 'OVERDUE';
        // Overdue Escalation Tiers:
        // Tier 1: 1-3 วัน -> POLITE
        // Tier 2: 4-7 วัน -> FORMAL
        // Tier 3: 8+ วัน -> URGENT
        if (overdueDays >= 8) {
          overdueTier = 3;
          resolvedTone = 'URGENT';
        } else if (overdueDays >= 4) {
          overdueTier = 2;
          resolvedTone = 'FORMAL';
        } else {
          overdueTier = 1;
          resolvedTone = 'POLITE';
        }
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
        matchedSlot,
        overdueDays,
        overdueTier,
        resolvedTone,
        profile: effectiveProfile,
        profileSource: resolvedProfileSource
      });
    }
  }

  if (!options.silentIfEmpty || candidates.length > 0) {
    console.log(`📋 Found ${candidates.length} candidate debt records matching reminder profiles for slot ${currentBangkokTime}.`);
  }

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    try {
      // ตรวจสอบการส่งซ้ำในวันเดียวกัน แยกตาม Slot
      const todayStr = todayDateObj.format('YYYY-MM-DD');
      const memoryKey = getSentKey(todayStr, candidate.debtId, candidate.matchedSlot);

      if (!options.ignoreDuplicate && inMemorySentCache.has(memoryKey)) {
        console.log(`⏭️ Skipped debt ${candidate.debtId} for ${candidate.userId} (in-memory deduplication: already sent today for slot ${candidate.matchedSlot})`);
        skippedCount++;
        continue;
      }

      const alreadySent = await sheetsService.hasBeenRemindedToday(candidate.debtId, candidate.reminderType, candidate.matchedSlot);
      if (alreadySent && !options.ignoreDuplicate) {
        console.log(`⏭️ Skipped debt ${candidate.debtId} for ${candidate.userId} (already sent today for slot ${candidate.matchedSlot})`);
        inMemorySentCache.add(memoryKey);
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
      const toneStr = candidate.resolvedTone || tpl.tone || globalTpl.tone || 'POLITE';

      const flexMsg = createReminderFlex({
        debtorName: candidate.debtorName,
        debtId: candidate.debtId,
        installmentAmount: candidate.installmentAmount,
        remainingBalance: candidate.remainingBalance,
        dueDate: candidate.dueDate,
        reminderType: candidate.reminderType,
        tone: toneStr,
        overdueDays: candidate.overdueDays,
        bankAccount: bankAccountStr,
        accountName: accountNameStr,
        promptPayNumber: promptPayStr,
        customHeader: customHeaderStr,
        customFooter: customFooterStr,
        liffUrl: 'https://lineautomatic.vercel.app/client/#'
      });

      // ส่งข้อความผ่าน LINE Messaging API
      await lineService.pushMessage(candidate.userId, flexMsg);
      inMemorySentCache.add(memoryKey);

      // บันทึก Log ลงชีต ReminderLogs พร้อมระบุ Time Slot เพื่อแยกการส่งหลายรอบต่อวัน
      await sheetsService.logReminder({
        debtId: candidate.debtId,
        userId: candidate.userId,
        reminderType: `${candidate.reminderType} [${candidate.matchedSlot || '08:00'}] [${prof.profileId}]`,
        status: 'SUCCESS'
      });

      console.log(`✅ Sent [${prof.profileId}] reminder to user ${candidate.userId} (Debt: ${candidate.debtId}, Slot: ${candidate.matchedSlot})`);
      sentCount++;
    } catch (err) {
      console.error(`❌ Failed to send reminder for debt ${candidate.debtId}:`, err.message);
      await sheetsService.logReminder({
        debtId: candidate.debtId,
        userId: candidate.userId,
        reminderType: `${candidate.reminderType} [${candidate.matchedSlot || '08:00'}]`,
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

  if (!options.silentIfEmpty || sentCount > 0 || failedCount > 0) {
    console.log(`🏁 [Reminder Engine v6.0] Finished: ${JSON.stringify(summary)}`);
  }
  return summary;
}

module.exports = {
  runDailyReminderCheck
};
