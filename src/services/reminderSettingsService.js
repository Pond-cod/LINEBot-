/**
 * Service สำหรับจัดการและบันทึกการตั้งค่าระบบแจ้งเตือนอัตโนมัติแบบละเอียด
 * รองรับทั้ง Local Storage, Cache, และ Google Cloud (GAS Script Properties)
 */

const fs = require('fs');
const path = require('path');
const { isGasConfigured, callGas } = require('./gasService');

const LOCAL_CONFIG_PATH = path.join(__dirname, '../config/reminderSettings.json');

const DEFAULT_SETTINGS = {
  enabled: true,
  scheduleMode: 'COMBINED', // 'DAILY' | 'MONTHLY' | 'COMBINED'
  primaryTime: '08:00',
  secondaryTimeEnabled: false,
  secondaryTime: '18:00',
  timezone: 'Asia/Bangkok',
  // กฎการแจ้งเตือนตามรอบเดือน / วันที่ระบุ
  monthlySchedule: {
    enabled: false,
    daysOfMonth: [1, 25], // วันที่ต้องการเตือนในแต่ละเดือน เช่น [1, 5, 25]
    lastDayOfMonth: true   // เตือนวันสิ้นเดือน
  },
  rules: {
    remindBeforeEnabled: true,
    remindBeforeDays: 1, // เตือนล่วงหน้า 1 วัน
    remindDueTodayEnabled: true, // เตือนวันครบกำหนด
    remindOverdueEnabled: true, // เตือนเมื่อค้างชำระ
    overdueFrequency: 'DAILY' // DAILY, EVERY_2_DAYS, EVERY_3_DAYS, WEEKLY
  },
  template: {
    tone: 'POLITE', // POLITE, FORMAL, URGENT
    bankName: 'ธนาคารกสิกรไทย (KBANK)',
    accountNumber: '123-4-56789-0',
    accountName: 'ชื่อบัญชีผู้รับโอน',
    promptPayNumber: '',
    customHeader: 'แจ้งยอดรอบชำระเงินกู้',
    customFooter: 'เมื่อโอนเงินแล้ว กรุณากดแนบรูปสลิปผ่านเมนูด้านล่างนี้ได้ทันที ขอขอบคุณครับ'
  },
  notifyAdminOnRun: true
};

let cachedSettings = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 นาที

/**
 * ดึงการตั้งค่าปัจจุบัน
 */
async function getSettings() {
  const now = Date.now();
  if (cachedSettings && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedSettings;
  }

  // 1. ลองอ่านจาก GAS Cloud Storage (Script Properties)
  if (isGasConfigured()) {
    try {
      const gasData = await callGas('getSettings', {}, 0);
      if (gasData && gasData.reminderSettings) {
        cachedSettings = {
          ...DEFAULT_SETTINGS,
          ...gasData.reminderSettings,
          monthlySchedule: { ...DEFAULT_SETTINGS.monthlySchedule, ...(gasData.reminderSettings.monthlySchedule || {}) },
          rules: { ...DEFAULT_SETTINGS.rules, ...(gasData.reminderSettings.rules || {}) },
          template: { ...DEFAULT_SETTINGS.template, ...(gasData.reminderSettings.template || {}) }
        };
        lastCacheTime = now;
        return cachedSettings;
      }
    } catch (e) {
      // GAS getSettings not available or not yet deployed, fallback
    }
  }

  // 2. ลองอ่านจาก Local JSON File
  try {
    if (fs.existsSync(LOCAL_CONFIG_PATH)) {
      const raw = fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      cachedSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        monthlySchedule: { ...DEFAULT_SETTINGS.monthlySchedule, ...(parsed.monthlySchedule || {}) },
        rules: { ...DEFAULT_SETTINGS.rules, ...(parsed.rules || {}) },
        template: { ...DEFAULT_SETTINGS.template, ...(parsed.template || {}) }
      };
      lastCacheTime = now;
      return cachedSettings;
    }
  } catch (err) {
    console.warn('Could not read local reminderSettings.json:', err.message);
  }

  cachedSettings = { ...DEFAULT_SETTINGS };
  lastCacheTime = now;
  return cachedSettings;
}

/**
 * บันทึกการตั้งค่าใหม่
 */
async function saveSettings(newSettings) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...newSettings,
    monthlySchedule: { ...DEFAULT_SETTINGS.monthlySchedule, ...(newSettings.monthlySchedule || {}) },
    rules: { ...DEFAULT_SETTINGS.rules, ...(newSettings.rules || {}) },
    template: { ...DEFAULT_SETTINGS.template, ...(newSettings.template || {}) }
  };

  cachedSettings = merged;
  lastCacheTime = Date.now();

  // 1. บันทึกลง Local JSON File (เฉพาะเมื่อไม่ใช่ Vercel)
  if (process.env.VERCEL !== '1') {
    try {
      const dir = path.dirname(LOCAL_CONFIG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
    } catch (err) {
      console.warn('Could not write local reminderSettings.json:', err.message);
    }
  }

  // 2. บันทึกลง GAS Cloud Storage
  if (isGasConfigured()) {
    try {
      await callGas('saveSettings', { reminderSettings: merged }, 1);
    } catch (e) {
      console.warn('Could not save settings to GAS cloud storage:', e.message);
    }
  }

  return merged;
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings
};
