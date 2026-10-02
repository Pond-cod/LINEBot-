const { sheets, sheetId } = require('../config/google');
const { isGasConfigured, callGas } = require('./gasService');
const cache = require('../utils/cache');
const dayjs = require('dayjs');
const { getNowStringBangkok, getTodayStringBangkok, normalizeDate, calculateNextDueDate } = require('../utils/dateHelper');

const SHEET_NAMES = {
  DEBTORS: 'Debtors',
  DEBTS: 'Debts',
  PAYMENTS: 'Payments',
  REMINDER_LOGS: 'ReminderLogs',
  ADMINS: 'admin',
  REMINDER_PROFILES: 'ReminderProfiles'
};

const HEADERS = {
  [SHEET_NAMES.DEBTORS]: ['userId', 'displayName', 'fullName', 'phone', 'idCardNumber', 'registeredAt', 'status', 'reminderProfileId', 'reminderEnabled'],
  [SHEET_NAMES.DEBTS]: ['debtId', 'userId', 'totalAmount', 'installmentAmount', 'remainingBalance', 'dueDate', 'cycleDays', 'debtStatus', 'createdAt', 'updatedAt', 'reminderProfileId', 'reminderEnabled'],
  [SHEET_NAMES.PAYMENTS]: ['paymentId', 'debtId', 'userId', 'amount', 'driveFileId', 'slipViewUrl', 'uploadedAt', 'verificationStatus', 'adminNote'],
  [SHEET_NAMES.REMINDER_LOGS]: ['logId', 'debtId', 'userId', 'reminderType', 'sentAt', 'status'],
  [SHEET_NAMES.ADMINS]: ['userId', 'displayName', 'role', 'phone', 'note', 'createdAt', 'status'],
  [SHEET_NAMES.REMINDER_PROFILES]: ['profileId', 'name', 'frequencyType', 'scheduleConfig', 'primaryTime', 'secondaryTime', 'rulesConfig', 'templateConfig', 'isDefault', 'status', 'createdAt', 'updatedAt']
};

/**
 * RFC4180-compliant CSV row parser that handles quotes, escaped quotes, and commas
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

/**
 * ตรวจสอบและสร้างแท็บใน Google Sheets พร้อมหัวตารางอัตโนมัติ
 */
async function initializeSheets() {
  if (isGasConfigured()) {
    return await callGas('initialize');
  }

  if (!sheets || !sheetId) {
    console.warn('⚠️ Google Sheets not initialized. Skipping sheet setup.');
    return false;
  }

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const existingTitles = meta.data.sheets.map(s => s.properties.title);

    const requests = [];
    for (const name of Object.values(SHEET_NAMES)) {
      if (!existingTitles.includes(name)) {
        requests.push({
          addSheet: { properties: { title: name } }
        });
      }
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests }
      });
      console.log(`✅ Created missing sheets: ${requests.map(r => r.addSheet.properties.title).join(', ')}`);
    }

    for (const [name, headers] of Object.entries(HEADERS)) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${name}!A1:Z1`
      });

      if (!res.data.values || res.data.values.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${name}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [headers] }
        });
        console.log(`✅ Initialized headers for sheet: ${name}`);
      }
    }
    return true;
  } catch (error) {
    console.error('❌ Error initializing sheets:', error.message);
    return false;
  }
}

/**
 * ลงทะเบียนหรืออัปเดตข้อมูลลูกหนี้
 */
async function registerDebtor({ userId, displayName, fullName, phone, idCardNumber }) {
  cache.delByPattern(/^debtors_/);

  if (isGasConfigured()) {
    const res = await callGas('registerDebtor', { userId, displayName, fullName, phone, idCardNumber });
    cache.delByPattern(/^debtors_/);
    return res;
  }

  if (!sheets || !sheetId) throw new Error('Google Sheets is not configured');

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAMES.DEBTORS}!A2:G`
  });

  const rows = res.data.values || [];
  const existingIndex = rows.findIndex(row => row[0] === userId);
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  if (existingIndex !== -1) {
    const rowNum = existingIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${SHEET_NAMES.DEBTORS}!A${rowNum}:G${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          userId,
          displayName || rows[existingIndex][1],
          fullName || rows[existingIndex][2],
          phone || rows[existingIndex][3],
          idCardNumber || rows[existingIndex][4],
          rows[existingIndex][5],
          'ACTIVE'
        ]]
      }
    });
    cache.delByPattern(/^debtors_/);
    return { status: 'UPDATED', userId };
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${SHEET_NAMES.DEBTORS}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          userId,
          displayName || '',
          fullName || '',
          phone || '',
          idCardNumber || '',
          now,
          'ACTIVE'
        ]]
      }
    });
    cache.delByPattern(/^debtors_/);
    return { status: 'CREATED', userId };
  }
}

/**
 * สร้างสัญญาหนี้ใหม่ (รองรับกำหนดรูปแบบแจ้งเตือนเฉพาะสัญญา)
 */
async function createDebt({ userId, totalAmount, installmentAmount, dueDate, cycleDays = 30, reminderProfileId = '', reminderEnabled = true }) {
  cache.delByPattern(/^debts_/);

  if (isGasConfigured()) {
    const res = await callGas('createDebt', { userId, totalAmount, installmentAmount, dueDate, cycleDays, reminderProfileId, reminderEnabled });
    cache.delByPattern(/^debts_/);
    return res;
  }

  if (!sheets || !sheetId) throw new Error('Google Sheets is not configured');

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const debtId = `DB-${dayjs().format('YYYYMM')}-${Math.floor(1000 + Math.random() * 9000)}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${SHEET_NAMES.DEBTS}!A:L`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        debtId,
        userId,
        Number(totalAmount),
        Number(installmentAmount),
        Number(totalAmount),
        dueDate,
        Number(cycleDays),
        'ACTIVE',
        now,
        now,
        reminderProfileId || '',
        reminderEnabled ? 'TRUE' : 'FALSE'
      ]]
    }
  });

  cache.delByPattern(/^debts_/);
  return { debtId, userId, totalAmount, installmentAmount, dueDate, reminderProfileId, reminderEnabled };
}

/**
 * ดึงข้อมูลสัญญาหนี้ที่กำลังเปิดใช้งาน (ผ่าน Cache / GViz Fast Stream)
 */
async function getActiveDebtByUserId(userId) {
  try {
    const debts = await getAllDebts();
    const matched = debts.filter(r => r.userId === userId && (r.debtStatus === 'ACTIVE' || r.debtStatus === 'OVERDUE'));
    if (matched.length === 0) return null;
    return matched[matched.length - 1];
  } catch (error) {
    console.error('Error fetching debt by userId:', error.message);
    return null;
  }
}

/**
 * ดึงข้อมูลลูกหนี้ (ผ่าน Cache / GViz Fast Stream)
 */
async function getDebtorByUserId(userId) {
  try {
    const debtors = await getAllDebtors();
    return debtors.find(r => r.userId === userId) || null;
  } catch (error) {
    console.error('Error fetching debtor:', error.message);
    return null;
  }
}

/**
 * ดึงรายชื่อลูกหนี้ทั้งหมด (Debtors) - High-Speed GViz Stream + Memory Cache
 */
async function getAllDebtors() {
  const cacheKey = 'debtors_all';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 1. อ่านผ่าน Google Sheets Visualization CSV API (เร็วมาก ~150-300ms)
  if (sheetId) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAMES.DEBTORS}`;
      const fetchRes = await fetch(url);
      if (fetchRes.ok) {
        const csvText = await fetchRes.text();
        const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          const debtors = [];
          for (let i = 1; i < lines.length; i++) {
            const clean = parseCsvLine(lines[i]);
            if (clean[0] && clean[0].startsWith('U')) {
              const isRemindEnabled = clean[8] === undefined || clean[8] === '' || clean[8] === 'TRUE' || clean[8] === 'true' || clean[8] === true;
              debtors.push({
                userId: clean[0],
                displayName: clean[1] || '',
                fullName: clean[2] || clean[1] || 'ลูกหนี้',
                phone: clean[3] || '',
                idCardNumber: clean[4] || '',
                registeredAt: clean[5] || '',
                status: clean[6] || 'ACTIVE',
                reminderProfileId: clean[7] || '',
                reminderEnabled: isRemindEnabled
              });
            }
          }
          if (debtors.length > 0) {
            cache.set(cacheKey, debtors, 30);
            return debtors;
          }
        }
      }
    } catch (csvErr) {
      console.warn('Error reading Debtors via CSV:', csvErr.message);
    }
  }

  // 2. เรียกผ่าน GAS Web App (retries = 0 เพื่อไม่ให้หน่วง)
  if (isGasConfigured()) {
    try {
      const res = await callGas('getAllDebtors', {}, 0);
      if (Array.isArray(res) && res.length > 0) {
        cache.set(cacheKey, res, 30);
        return res;
      }
    } catch (e) {
      console.warn('callGas getAllDebtors note:', e.message);
    }
  }

  // 3. Fallback: Google Sheets API Service Account
  if (sheets && sheetId) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAMES.DEBTORS}!A2:I`
      });
      const rows = res.data.values || [];
      const debtors = rows
        .filter(r => r[0] && r[0].startsWith('U'))
        .map(r => ({
          userId: r[0],
          displayName: r[1] || '',
          fullName: r[2] || r[1] || '',
          phone: r[3] || '',
          idCardNumber: r[4] || '',
          registeredAt: r[5] || '',
          status: r[6] || 'ACTIVE',
          reminderProfileId: r[7] || '',
          reminderEnabled: r[8] === undefined || r[8] === '' || r[8] === 'TRUE' || r[8] === 'true' || r[8] === true
        }));
      if (debtors.length > 0) {
        cache.set(cacheKey, debtors, 30);
      }
      return debtors;
    } catch (error) {
      console.error('Error fetching debtors via API:', error.message);
    }
  }

  return [];
}

/**
 * บันทึกการส่งสลิปชำระเงิน
 */
async function recordPayment({ debtId, userId, amount = 0, driveFileId, slipViewUrl, adminNote = '' }) {
  cache.delByPattern(/^(payments_|debts_)/);

  if (isGasConfigured()) {
    const res = await callGas('recordPayment', { debtId, userId, amount, driveFileId, slipViewUrl, adminNote });
    cache.delByPattern(/^(payments_|debts_)/);
    return res;
  }

  if (!sheets || !sheetId) throw new Error('Google Sheets is not configured');

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const paymentId = `PAY-${dayjs().format('YYYYMMDD')}-${Math.floor(1000 + Math.random() * 9000)}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${SHEET_NAMES.PAYMENTS}!A:I`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        paymentId,
        debtId || '',
        userId,
        amount ? Number(amount) : '',
        driveFileId || '',
        slipViewUrl || '',
        now,
        'PENDING',
        adminNote
      ]]
    }
  });

  cache.delByPattern(/^(payments_|debts_)/);
  return { paymentId, debtId, userId, slipViewUrl, uploadedAt: now, amount };
}

/**
 * ดึงประวัติการชำระเงินทั้งหมดของ userId (ดึงผ่าน getAllPayments ที่มี Cache)
 */
async function getPaymentsByUserId(userId) {
  try {
    const payments = await getAllPayments();
    return payments.filter(p => p.userId === userId);
  } catch (error) {
    console.error('Error getting payments by userId:', error.message);
    return [];
  }
}

/**
 * [Admin] ดึงรายการสลิปและประวัติชำระทั้งหมด (รองรับ GViz Fast Read & Memory Cache)
 */
async function getAllPayments() {
  const cacheKey = 'payments_all';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 1. อ่านผ่าน Google Sheets Visualization CSV API (เร็วมาก ~150-250ms)
  if (sheetId) {
    try {
      const [paymentsCsvRes, debtors] = await Promise.all([
        fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAMES.PAYMENTS}`),
        getAllDebtors()
      ]);

      if (paymentsCsvRes.ok) {
        const csvText = await paymentsCsvRes.text();
        const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);

        if (lines.length > 1) {
          const debtorMap = new Map();
          debtors.forEach(d => debtorMap.set(d.userId, { name: d.fullName || d.displayName || 'ลูกค้า', phone: d.phone || '' }));

          const slips = [];
          for (let i = 1; i < lines.length; i++) {
            const clean = parseCsvLine(lines[i]);

            if (clean[0] && clean[0].startsWith('PAY-')) {
              const uId = clean[2] || '';
              const debtor = debtorMap.get(uId) || { name: 'ลูกค้า', phone: '' };

              slips.push({
                rowIndex: i + 1,
                paymentId: clean[0],
                debtId: clean[1] || '',
                userId: uId,
                debtorName: debtor.name,
                debtorPhone: debtor.phone,
                amount: Number(clean[3]) || 0,
                driveFileId: clean[4] || '',
                slipViewUrl: clean[5] || (clean[4] ? `https://lh3.googleusercontent.com/d/${clean[4]}` : ''),
                uploadedAt: clean[6] || '',
                verificationStatus: clean[7] || 'PENDING',
                adminNote: clean[8] || ''
              });
            }
          }
          if (slips.length > 0) {
            const result = slips.reverse();
            cache.set(cacheKey, result, 30);
            return result;
          }
        }
      }
    } catch (csvErr) {
      console.warn('Error reading Payments via CSV:', csvErr.message);
    }
  }

  // 2. เรียกผ่าน GAS
  if (isGasConfigured()) {
    try {
      const res = await callGas('getAllPayments');
      if (Array.isArray(res) && res.length > 0) {
        cache.set(cacheKey, res, 30);
        return res;
      }
    } catch (gasErr) {
      console.warn('callGas getAllPayments warning:', gasErr.message);
    }
  }

  // 3. Fallback ผ่าน Service Account Sheets API
  if (sheets && sheetId) {
    try {
      const [paymentsRes, debtorsRes] = await Promise.all([
        sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAMES.PAYMENTS}!A2:I` }),
        sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAMES.DEBTORS}!A2:G` })
      ]);

      const pRows = paymentsRes.data.values || [];
      const dRows = debtorsRes.data.values || [];
      const debtorMap = new Map();
      dRows.forEach(r => debtorMap.set(r[0], { name: r[2] || r[1] || 'ไม่ระบุชื่อ', phone: r[3] || '' }));

      const result = pRows.map((r, idx) => ({
        rowIndex: idx + 2,
        paymentId: r[0],
        debtId: r[1],
        userId: r[2],
        debtorName: debtorMap.get(r[2])?.name || 'ลูกค้า',
        debtorPhone: debtorMap.get(r[2])?.phone || '',
        amount: Number(r[3]) || 0,
        driveFileId: r[4],
        slipViewUrl: r[5] || (r[4] ? `https://lh3.googleusercontent.com/d/${r[4]}` : ''),
        uploadedAt: r[6],
        verificationStatus: r[7] || 'PENDING',
        adminNote: r[8] || ''
      })).reverse();

      if (result.length > 0) {
        cache.set(cacheKey, result, 30);
      }
      return result;
    } catch (error) {
      console.error('Error getting all payments:', error.message);
      return [];
    }
  }

  return [];
}

/**
 * ซิงค์ไฟล์สลิปจาก Google Drive เข้าสู่ Sheet Payments
 */
async function syncDriveSlips() {
  if (isGasConfigured()) {
    const res = await callGas('syncDriveSlips');
    cache.delByPattern(/^payments_/);
    return res;
  }
  return { success: false, message: 'Google Apps Script not configured' };
}

const deletedDebtIds = new Set();

/**
 * กรองสัญญาที่เกิดจากการกดส่งซ้ำรัวๆ (สร้างภายใน 60 วินาทีด้วยเงื่อนไขเดียวกัน)
 */
function deduplicateDebts(debts) {
  if (!Array.isArray(debts) || debts.length <= 1) return debts || [];

  const seen = new Map();
  const result = [];

  for (const debt of debts) {
    if (deletedDebtIds.has(debt.debtId)) {
      continue; // กรองสัญญาที่ถูกสั่งลบออก
    }

    const key = `${debt.userId}_${debt.totalAmount}_${debt.installmentAmount}_${debt.dueDate}`;
    const debtTime = debt.createdAt ? new Date(debt.createdAt).getTime() : 0;

    if (seen.has(key)) {
      const prevTime = seen.get(key);
      if (Math.abs(debtTime - prevTime) < 60000) {
        continue; // ข้ามสัญญาที่สร้างซ้ำจากการกดเบิ้ล
      }
    }

    seen.set(key, debtTime);
    result.push(debt);
  }

  return result;
}

/**
 * [Admin] ดึงรายการสัญญาทั้งหมด (พร้อมตัดสัญญาที่สร้างซ้ำอัตโนมัติ และ High-Speed GViz Stream + Cache)
 */
async function getAllDebts() {
  const cacheKey = 'debts_all';
  const cached = cache.get(cacheKey);
  if (cached) return deduplicateDebts(cached);

  let list = [];

  // 1. อ่านผ่าน Google Sheets Visualization CSV API (เร็วมาก ~150-200ms)
  if (sheetId) {
    try {
      const [debtsCsvRes, debtors] = await Promise.all([
        fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAMES.DEBTS}`),
        getAllDebtors()
      ]);

      if (debtsCsvRes.ok) {
        const csvText = await debtsCsvRes.text();
        const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);

        if (lines.length > 1) {
          const debtorMap = new Map();
          debtors.forEach(d => debtorMap.set(d.userId, { name: d.fullName || d.displayName || 'ลูกค้า', phone: d.phone || '' }));

          for (let i = 1; i < lines.length; i++) {
            const clean = parseCsvLine(lines[i]);
            if (clean[0] && clean[0].startsWith('DB-')) {
              const uId = clean[1] || '';
              const debtor = debtorMap.get(uId) || { name: 'ไม่ระบุชื่อ', phone: '' };

              const isRemindEnabled = clean[11] === undefined || clean[11] === '' || clean[11] === 'TRUE' || clean[11] === 'true' || clean[11] === true;

              list.push({
                rowIndex: i + 1,
                debtId: clean[0],
                userId: uId,
                debtorName: debtor.name,
                debtorPhone: debtor.phone,
                totalAmount: Number(clean[2]) || 0,
                installmentAmount: Number(clean[3]) || 0,
                remainingBalance: Number(clean[4]) || 0,
                dueDate: normalizeDate(clean[5]),
                cycleDays: Number(clean[6]) || 30,
                debtStatus: clean[7] || 'ACTIVE',
                createdAt: clean[8] || '',
                updatedAt: clean[9] || '',
                reminderProfileId: clean[10] || '',
                reminderEnabled: isRemindEnabled
              });
            }
          }
          if (list.length > 0) {
            cache.set(cacheKey, list, 30);
            return deduplicateDebts(list);
          }
        }
      }
    } catch (csvErr) {
      console.warn('Error reading Debts via CSV:', csvErr.message);
    }
  }

  // 2. เรียกผ่าน GAS
  if (isGasConfigured()) {
    try {
      const gasDebts = await callGas('getAllDebts');
      if (Array.isArray(gasDebts) && gasDebts.length > 0) {
        list = gasDebts.map(d => ({
          ...d,
          dueDate: normalizeDate(d.dueDate)
        }));
        cache.set(cacheKey, list, 30);
        return deduplicateDebts(list);
      }
    } catch (err) {
      console.warn('callGas getAllDebts error:', err.message);
    }
  }

  // 3. Fallback ผ่าน Service Account
  if (sheets && sheetId) {
    try {
      const [debtsRes, debtorsRes] = await Promise.all([
        sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAMES.DEBTS}!A2:L` }),
        sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAMES.DEBTORS}!A2:I` })
      ]);

      const debtRows = debtsRes.data.values || [];
      const debtorRows = debtorsRes.data.values || [];
      const debtorMap = new Map();
      debtorRows.forEach(r => debtorMap.set(r[0], { name: r[2] || r[1] || 'ไม่ระบุ', phone: r[3] || '' }));

      list = debtRows.map((r, idx) => ({
        rowIndex: idx + 2,
        debtId: r[0],
        userId: r[1],
        debtorName: debtorMap.get(r[1])?.name || 'ไม่ระบุชื่อ',
        debtorPhone: debtorMap.get(r[1])?.phone || '',
        totalAmount: Number(r[2]) || 0,
        installmentAmount: Number(r[3]) || 0,
        remainingBalance: Number(r[4]) || 0,
        dueDate: normalizeDate(r[5]),
        cycleDays: Number(r[6]) || 30,
        debtStatus: r[7] || 'ACTIVE',
        createdAt: r[8] || '',
        updatedAt: r[9] || '',
        reminderProfileId: r[10] || '',
        reminderEnabled: r[11] === undefined || r[11] === '' || r[11] === 'TRUE' || r[11] === 'true' || r[11] === true
      }));

      if (list.length > 0) {
        cache.set(cacheKey, list, 30);
      }
    } catch (error) {
      console.error('Error getting all debts:', error.message);
      list = [];
    }
  }

  return deduplicateDebts(list);
}

/**
 * [Admin] ลบสัญญาหนี้
 */
async function deleteDebt(debtId) {
  const cleanId = String(debtId || '').trim();
  if (!cleanId) throw new Error('debtId is required');

  deletedDebtIds.add(cleanId);
  cache.delByPattern(/^debts_/);

  if (isGasConfigured()) {
    try {
      const res = await callGas('deleteDebt', { debtId: cleanId });
      cache.delByPattern(/^debts_/);
      return res;
    } catch (gasErr) {
      console.warn('callGas deleteDebt note:', gasErr.message);
      cache.delByPattern(/^debts_/);
      return { deleted: true, debtId: cleanId, note: 'Marked deleted locally' };
    }
  }

  if (sheets && sheetId) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAMES.DEBTS}!A:J`
      });
      const rows = res.data.values || [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === cleanId) {
          const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
          const debtSheet = meta.data.sheets.find(s => s.properties.title === SHEET_NAMES.DEBTS);
          if (debtSheet) {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId: sheetId,
              requestBody: {
                requests: [{
                  deleteDimension: {
                    range: {
                      sheetId: debtSheet.properties.sheetId,
                      dimension: 'ROWS',
                      startIndex: i,
                      endIndex: i + 1
                    }
                  }
                }]
              }
            });
            cache.delByPattern(/^debts_/);
            return { deleted: true, debtId: cleanId };
          }
        }
      }
    } catch (apiErr) {
      console.warn('Sheets API deleteDebt note:', apiErr.message);
    }
  }

  cache.delByPattern(/^debts_/);
  return { deleted: true, debtId: cleanId };
}

/**
 * [Admin] อนุมัติสลิป และหักลดยอดหนี้คงเหลือ
 */
async function approvePayment({ paymentId, confirmedAmount, note = 'อนุมัติเรียบร้อย' }) {
  cache.delByPattern(/^(payments_|debts_)/);

  if (isGasConfigured()) {
    const res = await callGas('approvePayment', { paymentId, confirmedAmount, note });
    cache.delByPattern(/^(payments_|debts_)/);
    return res;
  }

  if (!sheets || !sheetId) throw new Error('Sheets not configured');

  const paymentsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAMES.PAYMENTS}!A2:I`
  });
  const pRows = paymentsRes.data.values || [];
  const pIndex = pRows.findIndex(r => r[0] === paymentId);

  if (pIndex === -1) throw new Error(`Payment ID ${paymentId} not found`);

  const pRowNum = pIndex + 2;
  const debtId = pRows[pIndex][1];
  const userId = pRows[pIndex][2];
  const paidAmount = Number(confirmedAmount) || Number(pRows[pIndex][3]) || 0;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${SHEET_NAMES.PAYMENTS}!D${pRowNum}:I${pRowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        paidAmount,
        pRows[pIndex][4],
        pRows[pIndex][5],
        pRows[pIndex][6],
        'VERIFIED',
        note
      ]]
    }
  });

  let updatedDebt = null;
  if (debtId) {
    const debtsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAMES.DEBTS}!A2:J`
    });
    const dRows = debtsRes.data.values || [];
    const dIndex = dRows.findIndex(r => r[0] === debtId);

    if (dIndex !== -1) {
      const dRowNum = dIndex + 2;
      const currentRemaining = Number(dRows[dIndex][4]) || 0;
      const newRemaining = Math.max(0, currentRemaining - paidAmount);
      const newStatus = newRemaining === 0 ? 'PAID' : dRows[dIndex][7];
      const now = getNowStringBangkok();
      const currentDueDate = dRows[dIndex][5] || '';
      const cycleDays = Number(dRows[dIndex][6]) || 30;
      const nextDueDate = (newRemaining > 0 && currentDueDate)
        ? calculateNextDueDate(currentDueDate, cycleDays)
        : currentDueDate;

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${SHEET_NAMES.DEBTS}!E${dRowNum}:J${dRowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            newRemaining,
            nextDueDate,
            cycleDays,
            newStatus,
            dRows[dIndex][8],
            now
          ]]
        }
      });

      updatedDebt = {
        debtId,
        remainingBalance: newRemaining,
        dueDate: nextDueDate,
        debtStatus: newStatus
      };
    }
  }

  cache.delByPattern(/^(payments_|debts_)/);
  return { paymentId, debtId, userId, paidAmount, status: 'VERIFIED', updatedDebt };
}

/**
 * [Admin] ปฏิเสธสลิป
 */
async function rejectPayment({ paymentId, reason = 'ยอดเงินหรือสลิปไม่ถูกต้อง' }) {
  cache.delByPattern(/^payments_/);

  if (isGasConfigured()) {
    const res = await callGas('rejectPayment', { paymentId, reason });
    cache.delByPattern(/^payments_/);
    return res;
  }

  if (!sheets || !sheetId) throw new Error('Sheets not configured');

  const paymentsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAMES.PAYMENTS}!A2:I`
  });
  const pRows = paymentsRes.data.values || [];
  const pIndex = pRows.findIndex(r => r[0] === paymentId);

  if (pIndex === -1) throw new Error(`Payment ID ${paymentId} not found`);

  const pRowNum = pIndex + 2;
  const debtId = pRows[pIndex][1];
  const userId = pRows[pIndex][2];

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${SHEET_NAMES.PAYMENTS}!H${pRowNum}:I${pRowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['REJECTED', reason]]
    }
  });

  cache.delByPattern(/^payments_/);
  return { paymentId, debtId, userId, status: 'REJECTED', reason };
}

/**
 * ดึงรายการหนี้ทั้งหมดที่ถึงกำหนดส่งแจ้งเตือน
 */
async function getDueDebtsForReminder() {
  if (isGasConfigured()) {
    return await callGas('getDueDebts');
  }

  if (!sheets || !sheetId) return [];

  try {
    const [debtsRes, debtorsRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAMES.DEBTS}!A2:J`
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAMES.DEBTORS}!A2:G`
      })
    ]);

    const debtRows = debtsRes.data.values || [];
    const debtorRows = debtorsRes.data.values || [];
    const debtorsMap = new Map();

    for (const d of debtorRows) {
      debtorsMap.set(d[0], {
        displayName: d[1] || '',
        fullName: d[2] || d[1] || 'คุณลูกค้า'
      });
    }

    const todayStr = getTodayStringBangkok();
    const tomorrowStr = dayjs(todayStr).add(1, 'day').format('YYYY-MM-DD');
    const dueList = [];

    for (const r of debtRows) {
      const debtId = r[0];
      const userId = r[1];
      const installmentAmount = Number(r[3]) || 0;
      const remainingBalance = Number(r[4]) || 0;
      const dueDate = normalizeDate(r[5]);
      const debtStatus = r[7];

      if (!dueDate || debtStatus === 'PAID' || debtStatus === 'SETTLED') continue;

      let reminderType = null;
      if (dueDate === todayStr) {
        reminderType = 'DUE_TODAY';
      } else if (dueDate === tomorrowStr) {
        reminderType = 'DUE_BEFORE_1_DAY';
      } else if (dayjs(dueDate).isBefore(dayjs(todayStr), 'day')) {
        reminderType = 'OVERDUE';
      }

      if (reminderType) {
        const debtorInfo = debtorsMap.get(userId) || { fullName: 'คุณลูกค้า' };
        dueList.push({
          debtId,
          userId,
          debtorName: debtorInfo.fullName,
          installmentAmount,
          remainingBalance,
          dueDate,
          debtStatus,
          reminderType
        });
      }
    }

    return dueList;
  } catch (error) {
    console.error('Error fetching due debts:', error.message);
    return [];
  }
}

/**
 * ตรวจสอบการส่งแจ้งเตือนซ้ำในวันเดียวกัน
 */
async function hasBeenRemindedToday(debtId, reminderType) {
  if (isGasConfigured()) {
    return await callGas('hasBeenRemindedToday', { debtId, reminderType });
  }

  if (!sheets || !sheetId) return false;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAMES.REMINDER_LOGS}!A2:F`
    });

    const rows = res.data.values || [];
    const todayStr = getTodayStringBangkok();

    return rows.some(r => {
      const rDebtId = r[1];
      const rawType = String(r[3] || '').trim();
      const cleanType = rawType.split(' [')[0].trim();
      const rSentAt = String(r[4] || '');
      return rDebtId === debtId && (cleanType === reminderType || rawType === reminderType) && rSentAt.startsWith(todayStr);
    });
  } catch (error) {
    console.error('Error checking reminder logs:', error.message);
    return false;
  }
}

/**
 * บันทึก Log การส่งแจ้งเตือน
 */
async function logReminder({ debtId, userId, reminderType, status = 'SUCCESS' }) {
  if (isGasConfigured()) {
    return await callGas('logReminder', { debtId, userId, reminderType, status });
  }

  if (!sheets || !sheetId) return;

  const now = getNowStringBangkok();
  const logId = `LOG-${dayjs().format('YYYYMMDD')}-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${SHEET_NAMES.REMINDER_LOGS}!A:F`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[logId, debtId, userId, reminderType, now, status]]
      }
    });
  } catch (error) {
    console.error('Error logging reminder:', error.message);
  }
}

/**
 * ดึงประวัติการแจ้งเตือนล่าสุด
 */
async function getRecentReminderLogs(limit = 15) {
  if (sheetId) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAMES.REMINDER_LOGS}`;
      const fetchRes = await fetch(url);
      if (fetchRes.ok) {
        const csvText = await fetchRes.text();
        const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          const logs = [];
          for (let i = lines.length - 1; i >= 1 && logs.length < limit; i--) {
            const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
            const clean = cols.map(c => c.replace(/^"|"$/g, '').trim());
            if (clean[0]) {
              logs.push({
                logId: clean[0],
                debtId: clean[1] || '',
                userId: clean[2] || '',
                reminderType: clean[3] || '',
                sentAt: clean[4] || '',
                status: clean[5] || 'SUCCESS'
              });
            }
          }
          return logs;
        }
      }
    } catch (csvErr) {
      console.warn('Error reading ReminderLogs via CSV:', csvErr.message);
    }
  }

  if (sheets && sheetId) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAMES.REMINDER_LOGS}!A2:F`
      });
      const rows = res.data.values || [];
      return rows.slice(-limit).reverse().map(r => ({
        logId: r[0] || '',
        debtId: r[1] || '',
        userId: r[2] || '',
        reminderType: r[3] || '',
        sentAt: r[4] || '',
        status: r[5] || 'SUCCESS'
      }));
    } catch (err) {
      console.warn('Sheets API getRecentReminderLogs note:', err.message);
    }
  }

  return [];
}

/**
 * ==============================================================================
 * ฟังก์ชันจัดการผู้ดูแลระบบ (Admin Management Services)
 * ==============================================================================
 */

/**
 * ดึงรายชื่อผู้ดูแลระบบทั้งหมด (Google Sheet 'admin')
 */
async function getAllAdmins() {
  const cacheKey = 'admins_all';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 1. อ่านผ่าน Google Sheets Visualization CSV API (เร็วมาก Real-time)
  if (sheetId) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAMES.ADMINS}`;
      const fetchRes = await fetch(url);
      if (fetchRes.ok) {
        const csvText = await fetchRes.text();
        const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          const admins = [];
          for (let i = 1; i < lines.length; i++) {
            const clean = parseCsvLine(lines[i]);
            if (clean[0] && clean[0].startsWith('U')) {
              admins.push({
                userId: clean[0],
                displayName: clean[1] || '',
                role: clean[2] || 'ADMIN',
                phone: clean[3] || '',
                note: clean[4] || '',
                createdAt: clean[5] || '',
                status: (clean[6] || 'ACTIVE').toUpperCase()
              });
            }
          }
          if (admins.length > 0) {
            cache.set(cacheKey, admins, 30);
            return admins;
          }
        }
      }
    } catch (csvErr) {
      console.warn('Error reading Admins via CSV:', csvErr.message);
    }
  }

  // 2. เรียกผ่าน GAS Web App
  if (isGasConfigured()) {
    try {
      const res = await callGas('getAllAdmins', {}, 0);
      if (Array.isArray(res) && res.length > 0) {
        cache.set(cacheKey, res, 30);
        return res;
      }
    } catch (e) {
      console.warn('callGas getAllAdmins note:', e.message);
    }
  }

  // 3. Fallback: Google Sheets API
  if (sheets && sheetId) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAMES.ADMINS}!A2:G`
      });
      const rows = res.data.values || [];
      const admins = rows
        .filter(r => r[0] && r[0].startsWith('U'))
        .map(r => ({
          userId: r[0],
          displayName: r[1] || '',
          role: r[2] || 'ADMIN',
          phone: r[3] || '',
          note: r[4] || '',
          createdAt: r[5] || '',
          status: (r[6] || 'ACTIVE').toUpperCase()
        }));
      if (admins.length > 0) {
        cache.set(cacheKey, admins, 30);
      }
      return admins;
    } catch (err) {
      console.warn('Sheets API getAllAdmins note:', err.message);
    }
  }

  return [];
}

/**
 * บันทึกหรืออัปเดตผู้ดูแลระบบ
 */
async function saveAdmin(adminData) {
  cache.delByPattern(/^admins_/);

  if (isGasConfigured()) {
    const res = await callGas('saveAdmin', adminData);
    cache.delByPattern(/^admins_/);
    return res;
  }

  if (!sheets || !sheetId) {
    throw new Error('Google connection not configured');
  }

  const { userId, displayName = '', role = 'ADMIN', phone = '', note = '', status = 'ACTIVE' } = adminData;
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAMES.ADMINS}!A:G`
  });

  const rows = res.data.values || [];
  let foundIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === userId) {
      foundIndex = i + 1;
      break;
    }
  }

  if (foundIndex > -1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${SHEET_NAMES.ADMINS}!B${foundIndex}:G${foundIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[displayName, role, phone, note, rows[foundIndex - 1][5] || now, status]]
      }
    });
    cache.delByPattern(/^admins_/);
    return { action: 'updated', userId, displayName, role, status };
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${SHEET_NAMES.ADMINS}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[userId, displayName, role, phone, note, now, status]]
      }
    });
    cache.delByPattern(/^admins_/);
    return { action: 'created', userId, displayName, role, status };
  }
}

/**
 * ลบผู้ดูแลระบบ
 */
async function deleteAdmin(userId) {
  cache.delByPattern(/^admins_/);

  if (isGasConfigured()) {
    const res = await callGas('deleteAdmin', { userId });
    cache.delByPattern(/^admins_/);
    return res;
  }

  if (!sheets || !sheetId) {
    throw new Error('Google connection not configured');
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAMES.ADMINS}!A:G`
  });

  const rows = res.data.values || [];
  let foundIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === userId) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex > -1) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const adminSheet = meta.data.sheets.find(s => s.properties.title === SHEET_NAMES.ADMINS);
    if (adminSheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: adminSheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: foundIndex,
                endIndex: foundIndex + 1
              }
            }
          }]
        }
      });
      cache.delByPattern(/^admins_/);
      return { deleted: true, userId };
    }
  }

  cache.delByPattern(/^admins_/);
  return { deleted: false, message: 'Admin not found' };
}

/**
 * อัปเดตการตั้งค่าแจ้งเตือนระดับลูกหนี้ (Reminder Profile & Toggle)
 */
async function updateDebtorReminderConfig(userId, { reminderProfileId, reminderEnabled }) {
  cache.delByPattern(/^debtors_/);

  if (isGasConfigured()) {
    try {
      const res = await callGas('updateDebtorReminderConfig', { userId, reminderProfileId, reminderEnabled });
      cache.delByPattern(/^debtors_/);
      return res;
    } catch (err) {
      console.warn('callGas updateDebtorReminderConfig note:', err.message);
    }
  }

  if (sheets && sheetId) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAMES.DEBTORS}!A:I`
      });

      const rows = res.data.values || [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === userId) {
          const rowNum = i + 1;
          const profileVal = reminderProfileId !== undefined ? (reminderProfileId || '') : (rows[i][7] || '');
          const enabledVal = reminderEnabled !== undefined ? (reminderEnabled ? 'TRUE' : 'FALSE') : (rows[i][8] || 'TRUE');

          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${SHEET_NAMES.DEBTORS}!H${rowNum}:I${rowNum}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[profileVal, enabledVal]]
            }
          });
          cache.delByPattern(/^debtors_/);
          return { success: true, userId, reminderProfileId: profileVal, reminderEnabled: enabledVal === 'TRUE' };
        }
      }
    } catch (err) {
      console.error('Sheets API updateDebtorReminderConfig error:', err.message);
    }
  }

  cache.delByPattern(/^debtors_/);
  return { success: true, userId, reminderProfileId, reminderEnabled };
}

/**
 * อัปเดตการตั้งค่าแจ้งเตือนระดับสัญญา (Reminder Profile & Toggle)
 */
async function updateDebtReminderConfig(debtId, { reminderProfileId, reminderEnabled }) {
  cache.delByPattern(/^debts_/);

  if (isGasConfigured()) {
    try {
      const res = await callGas('updateDebtReminderConfig', { debtId, reminderProfileId, reminderEnabled });
      cache.delByPattern(/^debts_/);
      return res;
    } catch (err) {
      console.warn('callGas updateDebtReminderConfig note:', err.message);
    }
  }

  if (sheets && sheetId) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAMES.DEBTS}!A:L`
      });

      const rows = res.data.values || [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === debtId) {
          const rowNum = i + 1;
          const profileVal = reminderProfileId !== undefined ? (reminderProfileId || '') : (rows[i][10] || '');
          const enabledVal = reminderEnabled !== undefined ? (reminderEnabled ? 'TRUE' : 'FALSE') : (rows[i][11] || 'TRUE');

          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${SHEET_NAMES.DEBTS}!K${rowNum}:L${rowNum}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[profileVal, enabledVal]]
            }
          });
          cache.delByPattern(/^debts_/);
          return { success: true, debtId, reminderProfileId: profileVal, reminderEnabled: enabledVal === 'TRUE' };
        }
      }
    } catch (err) {
      console.error('Sheets API updateDebtReminderConfig error:', err.message);
    }
  }

  cache.delByPattern(/^debts_/);
  return { success: true, debtId, reminderProfileId, reminderEnabled };
}

module.exports = {
  SHEET_NAMES,
  initializeSheets,
  registerDebtor,
  createDebt,
  getActiveDebtByUserId,
  getDebtorByUserId,
  getAllDebtors,
  recordPayment,
  getPaymentsByUserId,
  getAllPayments,
  getAllDebts,
  approvePayment,
  rejectPayment,
  getDueDebtsForReminder,
  hasBeenRemindedToday,
  logReminder,
  getRecentReminderLogs,
  getAllAdmins,
  saveAdmin,
  deleteAdmin,
  deleteDebt,
  syncDriveSlips,
  updateDebtorReminderConfig,
  updateDebtReminderConfig
};
