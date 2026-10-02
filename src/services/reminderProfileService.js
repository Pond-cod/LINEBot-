/**
 * Reminder Profiles Service (Automated Reminder Engine v5.0)
 * Manages reusable notification rulesets: Daily, End of Month, Specific Dates, Due Date Relative.
 * Supports High-Speed GViz CSV Stream, In-Memory TTL Caching, and Local JSON Fallback.
 */

const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const cache = require('../utils/cache');
const { sheets, sheetId } = require('../config/google');
const { isGasConfigured, callGas } = require('./gasService');

const SHEET_NAME = 'ReminderProfiles';
const LOCAL_PROFILES_PATH = path.join(__dirname, '../config/reminderProfiles.json');

const DEFAULT_PRESETS = [
  {
    profileId: 'PRF-DAILY',
    name: 'เตือนรายวัน (Daily 08:00)',
    frequencyType: 'DAILY',
    scheduleConfig: { dailyInterval: 1 },
    primaryTime: '08:00',
    secondaryTime: '',
    rulesConfig: {
      remindBeforeEnabled: false,
      remindBeforeDays: 1,
      remindDueTodayEnabled: true,
      remindOverdueEnabled: true,
      overdueFrequency: 'DAILY'
    },
    templateConfig: {
      tone: 'POLITE',
      customHeader: 'แจ้งยอดรอบชำระรายวัน',
      customFooter: 'เมื่อโอนเงินแล้ว กรุณากดแนบรูปสลิปผ่านเมนูด้านล่างนี้ได้ทันที ขอขอบคุณครับ'
    },
    isDefault: true,
    status: 'ACTIVE',
    createdAt: '2026-10-01 00:00:00',
    updatedAt: '2026-10-01 00:00:00'
  },
  {
    profileId: 'PRF-ENDMONTH',
    name: 'เตือนวันสิ้นเดือน (End of Month)',
    frequencyType: 'END_OF_MONTH',
    scheduleConfig: { lastDayOfMonth: true },
    primaryTime: '08:00',
    secondaryTime: '',
    rulesConfig: {
      remindBeforeEnabled: true,
      remindBeforeDays: 1,
      remindDueTodayEnabled: true,
      remindOverdueEnabled: true,
      overdueFrequency: 'DAILY'
    },
    templateConfig: {
      tone: 'POLITE',
      customHeader: 'แจ้งยอดรอบชำระประจำสิ้นเดือน',
      customFooter: 'เมื่อโอนเงินแล้ว กรุณากดแนบรูปสลิปผ่านเมนูด้านล่างนี้ได้ทันที ขอขอบคุณครับ'
    },
    isDefault: false,
    status: 'ACTIVE',
    createdAt: '2026-10-01 00:00:00',
    updatedAt: '2026-10-01 00:00:00'
  },
  {
    profileId: 'PRF-PAYDAY-25',
    name: 'เตือนวันเงินออก (วันที่ 25 และ สิ้นเดือน)',
    frequencyType: 'SPECIFIC_DAYS',
    scheduleConfig: { daysOfMonth: [25], lastDayOfMonth: true },
    primaryTime: '08:00',
    secondaryTime: '18:00',
    rulesConfig: {
      remindBeforeEnabled: true,
      remindBeforeDays: 1,
      remindDueTodayEnabled: true,
      remindOverdueEnabled: true,
      overdueFrequency: 'EVERY_2_DAYS'
    },
    templateConfig: {
      tone: 'POLITE',
      customHeader: 'แจ้งยอดรอบชำระเงินเดือนออก',
      customFooter: 'เมื่อโอนเงินแล้ว กรุณากดแนบรูปสลิปผ่านเมนูด้านล่างนี้ได้ทันที ขอขอบคุณครับ'
    },
    isDefault: false,
    status: 'ACTIVE',
    createdAt: '2026-10-01 00:00:00',
    updatedAt: '2026-10-01 00:00:00'
  },
  {
    profileId: 'PRF-DUE-RELATIVE',
    name: 'เตือนอิงวันครบกำหนดสัญญา (Due Date Relative)',
    frequencyType: 'DUE_DATE_RELATIVE',
    scheduleConfig: {},
    primaryTime: '08:00',
    secondaryTime: '',
    rulesConfig: {
      remindBeforeEnabled: true,
      remindBeforeDays: 2,
      remindDueTodayEnabled: true,
      remindOverdueEnabled: true,
      overdueFrequency: 'DAILY'
    },
    templateConfig: {
      tone: 'POLITE',
      customHeader: 'แจ้งเตือนรอบครบกำหนดสัญญาเงินกู้',
      customFooter: 'เมื่อโอนเงินแล้ว กรุณากดแนบรูปสลิปผ่านเมนูด้านล่างนี้ได้ทันที ขอขอบคุณครับ'
    },
    isDefault: false,
    status: 'ACTIVE',
    createdAt: '2026-10-01 00:00:00',
    updatedAt: '2026-10-01 00:00:00'
  }
];

/**
 * RFC4180 CSV parser
 */
function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function safeJsonParse(str, fallback = {}) {
  try {
    if (!str) return fallback;
    return typeof str === 'object' ? str : JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

/**
 * บันทึกโปรไฟล์ลง local JSON file
 */
function saveToLocalJson(profiles) {
  if (process.env.VERCEL === '1') return;
  try {
    const dir = path.dirname(LOCAL_PROFILES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf8');
  } catch (err) {
    console.warn('Error saving local reminderProfiles.json:', err.message);
  }
}

/**
 * อ่านโปรไฟล์จาก local JSON file
 */
function loadFromLocalJson() {
  try {
    if (fs.existsSync(LOCAL_PROFILES_PATH)) {
      const raw = fs.readFileSync(LOCAL_PROFILES_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('Error reading local reminderProfiles.json:', err.message);
  }
  return DEFAULT_PRESETS;
}

/**
 * ดึงโปรไฟล์การแจ้งเตือนทั้งหมด (รองรับ In-Memory Cache + GViz CSV Stream)
 */
async function getAllProfiles() {
  const cacheKey = 'reminder_profiles_all';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 1. อ่านผ่าน Google Sheets Visualization CSV API
  if (sheetId) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;
      const fetchRes = await fetch(url);
      if (fetchRes.ok) {
        const csvText = await fetchRes.text();
        const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          const profiles = [];
          for (let i = 1; i < lines.length; i++) {
            const clean = parseCsvLine(lines[i]);
            if (clean[0] && clean[0].startsWith('PRF-')) {
              profiles.push({
                profileId: clean[0],
                name: clean[1] || 'รูปแบบการแจ้งเตือน',
                frequencyType: clean[2] || 'DAILY',
                scheduleConfig: safeJsonParse(clean[3], {}),
                primaryTime: clean[4] || '08:00',
                secondaryTime: clean[5] || '',
                rulesConfig: safeJsonParse(clean[6], {}),
                templateConfig: safeJsonParse(clean[7], {}),
                isDefault: clean[8] === 'TRUE' || clean[8] === 'true' || clean[8] === true,
                status: (clean[9] || 'ACTIVE').toUpperCase(),
                createdAt: clean[10] || '',
                updatedAt: clean[11] || ''
              });
            }
          }
          if (profiles.length > 0) {
            saveToLocalJson(profiles);
            cache.set(cacheKey, profiles, 30);
            return profiles;
          }
        }
      }
    } catch (csvErr) {
      console.warn('Error reading ReminderProfiles via CSV:', csvErr.message);
    }
  }

  // 2. เรียกผ่าน GAS
  if (isGasConfigured()) {
    try {
      const res = await callGas('getReminderProfiles', {}, 0);
      if (Array.isArray(res) && res.length > 0) {
        saveToLocalJson(res);
        cache.set(cacheKey, res, 30);
        return res;
      }
    } catch (e) {
      console.warn('callGas getReminderProfiles note:', e.message);
    }
  }

  // 3. Fallback: Google Sheets Service Account API
  if (sheets && sheetId) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAME}!A2:L`
      });
      const rows = res.data.values || [];
      const profiles = rows
        .filter(r => r[0] && r[0].startsWith('PRF-'))
        .map(r => ({
          profileId: r[0],
          name: r[1] || 'รูปแบบการแจ้งเตือน',
          frequencyType: r[2] || 'DAILY',
          scheduleConfig: safeJsonParse(r[3], {}),
          primaryTime: r[4] || '08:00',
          secondaryTime: r[5] || '',
          rulesConfig: safeJsonParse(r[6], {}),
          templateConfig: safeJsonParse(r[7], {}),
          isDefault: r[8] === 'TRUE' || r[8] === 'true',
          status: (r[9] || 'ACTIVE').toUpperCase(),
          createdAt: r[10] || '',
          updatedAt: r[11] || ''
        }));
      if (profiles.length > 0) {
        saveToLocalJson(profiles);
        cache.set(cacheKey, profiles, 30);
        return profiles;
      }
    } catch (apiErr) {
      console.warn('Sheets API getReminderProfiles note:', apiErr.message);
    }
  }

  // 4. Fallback จาก Local JSON Presets
  const local = loadFromLocalJson();
  cache.set(cacheKey, local, 30);
  return local;
}

/**
 * ดึงโปรไฟล์ตาม profileId
 */
async function getProfileById(profileId) {
  const profiles = await getAllProfiles();
  return profiles.find(p => p.profileId === profileId) || null;
}

/**
 * ดึงโปรไฟล์ที่เป็นค่าตั้งต้น (Default Profile)
 */
async function getDefaultProfile() {
  const profiles = await getAllProfiles();
  return profiles.find(p => p.isDefault && p.status === 'ACTIVE') || profiles[0] || DEFAULT_PRESETS[0];
}

/**
 * บันทึกหรือสร้างโปรไฟล์ใหม่ (Create or Update)
 */
async function saveProfile(data) {
  cache.delByPattern(/^reminder_profiles_/);

  const profiles = await getAllProfiles();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const profileId = data.profileId || `PRF-${dayjs().format('YYYYMM')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const profile = {
    profileId,
    name: data.name || 'รูปแบบแจ้งเตือนใหม่',
    frequencyType: data.frequencyType || 'DAILY',
    scheduleConfig: data.scheduleConfig || {},
    primaryTime: data.primaryTime || '08:00',
    secondaryTime: data.secondaryTime || '',
    rulesConfig: data.rulesConfig || {
      remindBeforeEnabled: true,
      remindBeforeDays: 1,
      remindDueTodayEnabled: true,
      remindOverdueEnabled: true,
      overdueFrequency: 'DAILY'
    },
    templateConfig: data.templateConfig || {
      tone: 'POLITE',
      customHeader: 'แจ้งยอดรอบชำระ',
      customFooter: 'เมื่อโอนเงินแล้ว กรุณากดแนบรูปสลิปผ่านเมนูด้านล่างนี้ได้ทันที ขอขอบคุณครับ'
    },
    isDefault: Boolean(data.isDefault),
    status: (data.status || 'ACTIVE').toUpperCase(),
    createdAt: data.createdAt || now,
    updatedAt: now
  };

  // จัดการ IsDefault (ถ้าอันนี้เป็น default ให้ปลด default อันอื่นออก)
  let updatedList = [];
  const existingIdx = profiles.findIndex(p => p.profileId === profileId);

  if (existingIdx !== -1) {
    updatedList = profiles.map(p => {
      if (p.profileId === profileId) return profile;
      if (profile.isDefault && p.isDefault) return { ...p, isDefault: false, updatedAt: now };
      return p;
    });
  } else {
    updatedList = [...profiles];
    if (profile.isDefault) {
      updatedList = updatedList.map(p => ({ ...p, isDefault: false, updatedAt: now }));
    }
    updatedList.push(profile);
  }

  // 1. บันทึกลง Local JSON ทันที (0ms)
  saveToLocalJson(updatedList);
  cache.set('reminder_profiles_all', updatedList, 30);

  // 2. บันทึกลง Google Apps Script (ถ้าเชื่อมต่อไว้)
  if (isGasConfigured()) {
    try {
      await callGas('saveReminderProfile', profile, 1);
    } catch (gasErr) {
      console.warn('callGas saveReminderProfile notice:', gasErr.message);
    }
  }

  // 3. บันทึกลง Google Sheets ผ่าน Service Account (ถ้ามี)
  if (sheets && sheetId) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAME}!A:L`
      });
      const rows = res.data.values || [];
      let foundIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === profileId) {
          foundIndex = i + 1;
          break;
        }
      }

      const rowValues = [
        profile.profileId,
        profile.name,
        profile.frequencyType,
        JSON.stringify(profile.scheduleConfig),
        profile.primaryTime,
        profile.secondaryTime,
        JSON.stringify(profile.rulesConfig),
        JSON.stringify(profile.templateConfig),
        profile.isDefault ? 'TRUE' : 'FALSE',
        profile.status,
        profile.createdAt,
        profile.updatedAt
      ];

      if (foundIndex > -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${SHEET_NAME}!A${foundIndex}:L${foundIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [rowValues] }
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: `${SHEET_NAME}!A:L`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [rowValues] }
        });
      }
    } catch (sheetErr) {
      console.warn('Sheets API saveProfile notice:', sheetErr.message);
    }
  }

  return profile;
}

/**
 * ลบโปรไฟล์การแจ้งเตือน
 */
async function deleteProfile(profileId) {
  cache.delByPattern(/^reminder_profiles_/);

  const profiles = await getAllProfiles();
  const filtered = profiles.filter(p => p.profileId !== profileId);
  saveToLocalJson(filtered);
  cache.set('reminder_profiles_all', filtered, 30);

  // 1. ลบผ่าน Google Apps Script (ถ้าเชื่อมต่อไว้)
  if (isGasConfigured()) {
    try {
      await callGas('deleteReminderProfile', { profileId }, 1);
    } catch (gasErr) {
      console.warn('callGas deleteReminderProfile notice:', gasErr.message);
    }
  }

  // 2. ลบผ่าน Service Account (ถ้ามี)
  if (sheets && sheetId) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAME}!A:L`
      });
      const rows = res.data.values || [];
      let foundIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === profileId) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex > -1) {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetObj = meta.data.sheets.find(s => s.properties.title === SHEET_NAME);
        if (sheetObj) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
              requests: [{
                deleteDimension: {
                  range: {
                    sheetId: sheetObj.properties.sheetId,
                    dimension: 'ROWS',
                    startIndex: foundIndex,
                    endIndex: foundIndex + 1
                  }
                }
              }]
            }
          });
        }
      }
    } catch (err) {
      console.warn('Sheets API deleteProfile notice:', err.message);
    }
  }

  return { deleted: true, profileId };
}

/**
 * สร้าง Reminder Profile ใหม่
 */
async function createProfile(data) {
  return await saveProfile({
    ...data,
    profileId: data.profileId || `PRF-${Date.now().toString(36).toUpperCase()}`
  });
}

/**
 * อัปเดต Reminder Profile เดิม
 */
async function updateProfile(profileId, updates) {
  const existing = await getProfileById(profileId);
  if (!existing) throw new Error('Profile not found: ' + profileId);
  return await saveProfile({
    ...existing,
    ...updates,
    profileId
  });
}

/**
 * สลับเปิด/ปิดสถานะโปรไฟล์ (ACTIVE <-> INACTIVE)
 */
async function toggleProfileStatus(profileId, newStatus) {
  const profile = await getProfileById(profileId);
  if (!profile) throw new Error('Profile not found');

  const status = newStatus ? newStatus.toUpperCase() : (profile.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE');
  return await saveProfile({
    ...profile,
    status
  });
}

module.exports = {
  DEFAULT_PRESETS,
  getAllProfiles,
  getProfileById,
  getDefaultProfile,
  saveProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  toggleProfileStatus
};
