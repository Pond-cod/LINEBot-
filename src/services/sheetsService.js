const { sheets, sheetId } = require('../config/google');
const { isGasConfigured, callGas } = require('./gasService');
const dayjs = require('dayjs');

const SHEET_NAMES = {
  DEBTORS: 'Debtors',
  DEBTS: 'Debts',
  PAYMENTS: 'Payments',
  REMINDER_LOGS: 'ReminderLogs'
};

const HEADERS = {
  [SHEET_NAMES.DEBTORS]: ['userId', 'displayName', 'fullName', 'phone', 'idCardNumber', 'registeredAt', 'status'],
  [SHEET_NAMES.DEBTS]: ['debtId', 'userId', 'totalAmount', 'installmentAmount', 'remainingBalance', 'dueDate', 'cycleDays', 'debtStatus', 'createdAt', 'updatedAt'],
  [SHEET_NAMES.PAYMENTS]: ['paymentId', 'debtId', 'userId', 'amount', 'driveFileId', 'slipViewUrl', 'uploadedAt', 'verificationStatus', 'adminNote'],
  [SHEET_NAMES.REMINDER_LOGS]: ['logId', 'debtId', 'userId', 'reminderType', 'sentAt', 'status']
};

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
  if (isGasConfigured()) {
    return await callGas('registerDebtor', { userId, displayName, fullName, phone, idCardNumber });
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
    return { status: 'CREATED', userId };
  }
}

/**
 * สร้างสัญญาหนี้ใหม่
 */
async function createDebt({ userId, totalAmount, installmentAmount, dueDate, cycleDays = 30 }) {
  if (isGasConfigured()) {
    return await callGas('createDebt', { userId, totalAmount, installmentAmount, dueDate, cycleDays });
  }

  if (!sheets || !sheetId) throw new Error('Google Sheets is not configured');

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const debtId = `DB-${dayjs().format('YYYYMM')}-${Math.floor(1000 + Math.random() * 9000)}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${SHEET_NAMES.DEBTS}!A:J`,
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
        now
      ]]
    }
  });

  return { debtId, userId, totalAmount, installmentAmount, dueDate };
}

/**
 * ดึงข้อมูลสัญญาหนี้ที่กำลังเปิดใช้งาน
 */
async function getActiveDebtByUserId(userId) {
  if (isGasConfigured()) {
    return await callGas('getActiveDebt', { userId });
  }

  if (!sheets || !sheetId) return null;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAMES.DEBTS}!A2:J`
    });

    const rows = res.data.values || [];
    const matched = rows.filter(r => r[1] === userId && (r[7] === 'ACTIVE' || r[7] === 'OVERDUE'));
    if (matched.length === 0) return null;

    const row = matched[matched.length - 1];
    return {
      debtId: row[0],
      userId: row[1],
      totalAmount: Number(row[2]) || 0,
      installmentAmount: Number(row[3]) || 0,
      remainingBalance: Number(row[4]) || 0,
      dueDate: row[5] || '',
      cycleDays: Number(row[6]) || 30,
      debtStatus: row[7] || 'ACTIVE',
      createdAt: row[8] || '',
      updatedAt: row[9] || ''
    };
  } catch (error) {
    console.error('Error fetching debt by userId:', error.message);
    return null;
  }
}

/**
 * ดึงข้อมูลลูกหนี้
 */
async function getDebtorByUserId(userId) {
  if (isGasConfigured()) {
    return await callGas('getDebtor', { userId });
  }

  if (!sheets || !sheetId) return null;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAMES.DEBTORS}!A2:G`
    });

    const rows = res.data.values || [];
    const row = rows.find(r => r[0] === userId);
    if (!row) return null;

    return {
      userId: row[0],
      displayName: row[1],
      fullName: row[2],
      phone: row[3],
      idCardNumber: row[4],
      registeredAt: row[5],
      status: row[6]
    };
  } catch (error) {
    console.error('Error fetching debtor:', error.message);
    return null;
  }
}

/**
 * บันทึกการส่งสลิปชำระเงิน
 */
async function recordPayment({ debtId, userId, amount = 0, driveFileId, slipViewUrl, adminNote = '' }) {
  if (isGasConfigured()) {
    // กรณีใช้ GAS บันทึกผ่าน uploadSlip โดยตรง หรือใช้ fallback
    return await callGas('recordPayment', { debtId, userId, amount, driveFileId, slipViewUrl, adminNote });
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

  return { paymentId, debtId, userId, slipViewUrl, uploadedAt: now, amount };
}

/**
 * ดึงประวัติการชำระเงินทั้งหมดของ userId
 */
async function getPaymentsByUserId(userId) {
  if (isGasConfigured()) {
    return await callGas('getPayments', { userId });
  }

  if (!sheets || !sheetId) return [];

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAMES.PAYMENTS}!A2:I`
    });

    const rows = res.data.values || [];
    return rows
      .filter(r => r[2] === userId)
      .map(r => ({
        paymentId: r[0],
        debtId: r[1],
        userId: r[2],
        amount: Number(r[3]) || 0,
        driveFileId: r[4],
        slipViewUrl: r[5],
        uploadedAt: r[6],
        verificationStatus: r[7] || 'PENDING',
        adminNote: r[8] || ''
      }))
      .reverse();
  } catch (error) {
    console.error('Error getting payments by userId:', error.message);
    return [];
  }
}

/**
 * [Admin] ดึงรายการสลิปและประวัติชำระทั้งหมด
 */
async function getAllPayments() {
  if (isGasConfigured()) {
    return await callGas('getAllPayments');
  }

  if (!sheets || !sheetId) return [];

  try {
    const [paymentsRes, debtorsRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAMES.PAYMENTS}!A2:I` }),
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAMES.DEBTORS}!A2:G` })
    ]);

    const pRows = paymentsRes.data.values || [];
    const dRows = debtorsRes.data.values || [];
    const debtorMap = new Map();
    dRows.forEach(r => debtorMap.set(r[0], { name: r[2] || r[1] || 'ไม่ระบุชื่อ', phone: r[3] || '' }));

    return pRows.map((r, idx) => ({
      rowIndex: idx + 2,
      paymentId: r[0],
      debtId: r[1],
      userId: r[2],
      debtorName: debtorMap.get(r[2])?.name || 'ลูกค้า',
      debtorPhone: debtorMap.get(r[2])?.phone || '',
      amount: Number(r[3]) || 0,
      driveFileId: r[4],
      slipViewUrl: r[5],
      uploadedAt: r[6],
      verificationStatus: r[7] || 'PENDING',
      adminNote: r[8] || ''
    })).reverse();
  } catch (error) {
    console.error('Error getting all payments:', error.message);
    return [];
  }
}

/**
 * [Admin] ดึงรายการสัญญาทั้งหมด
 */
async function getAllDebts() {
  if (isGasConfigured()) {
    return await callGas('getAllDebts');
  }

  if (!sheets || !sheetId) return [];

  try {
    const [debtsRes, debtorsRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAMES.DEBTS}!A2:J` }),
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAMES.DEBTORS}!A2:G` })
    ]);

    const debtRows = debtsRes.data.values || [];
    const debtorRows = debtorsRes.data.values || [];
    const debtorMap = new Map();
    debtorRows.forEach(r => debtorMap.set(r[0], { name: r[2] || r[1] || 'ไม่ระบุ', phone: r[3] || '' }));

    return debtRows.map((r, idx) => ({
      rowIndex: idx + 2,
      debtId: r[0],
      userId: r[1],
      debtorName: debtorMap.get(r[1])?.name || 'ไม่ระบุชื่อ',
      debtorPhone: debtorMap.get(r[1])?.phone || '',
      totalAmount: Number(r[2]) || 0,
      installmentAmount: Number(r[3]) || 0,
      remainingBalance: Number(r[4]) || 0,
      dueDate: r[5] || '',
      cycleDays: Number(r[6]) || 30,
      debtStatus: r[7] || 'ACTIVE',
      createdAt: r[8] || '',
      updatedAt: r[9] || ''
    }));
  } catch (error) {
    console.error('Error getting all debts:', error.message);
    return [];
  }
}

/**
 * [Admin] อนุมัติสลิป และหักลดยอดหนี้คงเหลือ
 */
async function approvePayment({ paymentId, confirmedAmount, note = 'อนุมัติเรียบร้อย' }) {
  if (isGasConfigured()) {
    return await callGas('approvePayment', { paymentId, confirmedAmount, note });
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
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${SHEET_NAMES.DEBTS}!E${dRowNum}:J${dRowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            newRemaining,
            dRows[dIndex][5],
            dRows[dIndex][6],
            newStatus,
            dRows[dIndex][8],
            now
          ]]
        }
      });

      updatedDebt = {
        debtId,
        remainingBalance: newRemaining,
        debtStatus: newStatus
      };
    }
  }

  return { paymentId, debtId, userId, paidAmount, status: 'VERIFIED', updatedDebt };
}

/**
 * [Admin] ปฏิเสธสลิป
 */
async function rejectPayment({ paymentId, reason = 'ยอดเงินหรือสลิปไม่ถูกต้อง' }) {
  if (isGasConfigured()) {
    return await callGas('rejectPayment', { paymentId, reason });
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

    const todayStr = dayjs().format('YYYY-MM-DD');
    const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD');
    const dueList = [];

    for (const r of debtRows) {
      const debtId = r[0];
      const userId = r[1];
      const installmentAmount = Number(r[3]) || 0;
      const remainingBalance = Number(r[4]) || 0;
      const dueDate = r[5];
      const debtStatus = r[7];

      if (!dueDate || debtStatus === 'PAID' || debtStatus === 'SETTLED') continue;

      let reminderType = null;
      if (dueDate === todayStr) {
        reminderType = 'DUE_TODAY';
      } else if (dueDate === tomorrowStr) {
        reminderType = 'DUE_BEFORE_1_DAY';
      } else if (dayjs(dueDate).isBefore(dayjs(), 'day')) {
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
    const todayStr = dayjs().format('YYYY-MM-DD');

    return rows.some(r => {
      const rDebtId = r[1];
      const rType = r[3];
      const rSentAt = r[4] || '';
      return rDebtId === debtId && rType === reminderType && rSentAt.startsWith(todayStr);
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

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
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

module.exports = {
  SHEET_NAMES,
  initializeSheets,
  registerDebtor,
  createDebt,
  getActiveDebtByUserId,
  getDebtorByUserId,
  recordPayment,
  getPaymentsByUserId,
  getAllPayments,
  getAllDebts,
  approvePayment,
  rejectPayment,
  getDueDebtsForReminder,
  hasBeenRemindedToday,
  logReminder
};
