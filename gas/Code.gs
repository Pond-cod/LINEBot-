/**
 * ==============================================================================
 * Google Apps Script (GAS) สำหรับเชื่อมต่อ Google Sheets & Google Drive
 * คัดลอกโค้ดทั้งหมดนี้ไปวางในไฟล์ Code.gs ของโปรเจกต์:
 * https://script.google.com/u/0/home/projects/1cSEpWnwgJO3hawIbF4xAN111VIA_qGZpyFGCwhYNsG8K26JUSxD9LxSW/edit
 * ==============================================================================
 */

const CONFIG = {
  SPREADSHEET_ID: '1mPzvirxQwdQX9YhgLMi_-ro6ThEtjmC8RWVJXYuu8d8',
  DRIVE_FOLDER_ID: '1B7OmfKEvVBeGpAWNT1fRgypArtsDeDpB',
  SHEET_NAMES: {
    DEBTORS: 'Debtors',
    DEBTS: 'Debts',
    PAYMENTS: 'Payments',
    REMINDER_LOGS: 'ReminderLogs',
    ADMINS: 'admin'
  }
};

const HEADERS = {
  Debtors: ['userId', 'displayName', 'fullName', 'phone', 'idCardNumber', 'registeredAt', 'status'],
  Debts: ['debtId', 'userId', 'totalAmount', 'installmentAmount', 'remainingBalance', 'dueDate', 'cycleDays', 'debtStatus', 'createdAt', 'updatedAt'],
  Payments: ['paymentId', 'debtId', 'userId', 'amount', 'driveFileId', 'slipViewUrl', 'uploadedAt', 'verificationStatus', 'adminNote'],
  ReminderLogs: ['logId', 'debtId', 'userId', 'reminderType', 'sentAt', 'status'],
  admin: ['userId', 'displayName', 'role', 'phone', 'note', 'createdAt', 'status']
};

/**
 * จัดการ HTTP GET (ทดสอบการทำงาน)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    message: 'LINE Bot Google Apps Script Service is ready!',
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    folderId: CONFIG.DRIVE_FOLDER_ID,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * จัดการ HTTP POST (รับคำสั่งจาก Node.js Backend)
 */
function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    const action = contents.action;
    let result = null;

    switch (action) {
      case 'initialize':
        result = initializeSheets();
        break;

      case 'uploadSlip':
        result = handleUploadSlip(contents);
        break;

      case 'registerDebtor':
        result = handleRegisterDebtor(contents);
        break;

      case 'createDebt':
        result = handleCreateDebt(contents);
        break;

      case 'getActiveDebt':
        result = handleGetActiveDebt(contents.userId);
        break;

      case 'getDebtor':
        result = handleGetDebtor(contents.userId);
        break;

      case 'getPayments':
        result = handleGetPayments(contents.userId);
        break;

      case 'getAllPayments':
        result = handleGetAllPayments();
        break;

      case 'getAllDebts':
        result = handleGetAllDebts();
        break;

      case 'getAllDebtors':
        result = handleGetAllDebtors();
        break;

      case 'approvePayment':
        result = handleApprovePayment(contents);
        break;

      case 'rejectPayment':
        result = handleRejectPayment(contents);
        break;

      case 'getDueDebts':
        result = handleGetDueDebts();
        break;

      case 'logReminder':
        result = handleLogReminder(contents);
        break;

      case 'hasBeenRemindedToday':
        result = handleHasBeenRemindedToday(contents.debtId, contents.reminderType);
        break;

      case 'getAllAdmins':
        result = handleGetAllAdmins();
        break;

      case 'saveAdmin':
        result = handleSaveAdmin(contents);
        break;

      case 'deleteAdmin':
        result = handleDeleteAdmin(contents.userId);
        break;

      default:
        throw new Error('Unknown action: ' + action);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ฟังก์ชันสร้างและเตรียมแท็บใน Google Sheets
 */
function initializeSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const created = [];

  for (const sheetName in HEADERS) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(HEADERS[sheetName]);
      // จัดรูปแบบหัวตาราง
      const headerRange = sheet.getRange(1, 1, 1, HEADERS[sheetName].length);
      headerRange.setFontWeight('bold').setBackground('#1E293B').setFontColor('#FFFFFF');
      created.push(sheetName);
    } else {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(HEADERS[sheetName]);
        const headerRange = sheet.getRange(1, 1, 1, HEADERS[sheetName].length);
        headerRange.setFontWeight('bold').setBackground('#1E293B').setFontColor('#FFFFFF');
      }
    }
  }

  return { message: 'Initialized sheets successfully', created };
}

/**
 * รับ Base64 ของรูปภาพ บันทึกลง Google Drive และลงตาราง Payments
 */
function handleUploadSlip(data) {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const cleanBase64 = data.imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const bytes = Utilities.base64Decode(cleanBase64);
  const mimeType = data.mimeType || 'image/jpeg';
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
  const fileName = 'SLIP_' + (data.userId || 'USER') + '_' + timestamp + '.jpg';

  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  const slipViewUrl = file.getUrl();
  const paymentId = 'PAY-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000);
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

  // บันทึกลง Sheet Payments
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PAYMENTS);
  sheet.appendRow([
    paymentId,
    data.debtId || '',
    data.userId,
    data.amount ? Number(data.amount) : '',
    fileId,
    slipViewUrl,
    nowStr,
    'PENDING',
    data.note || 'อัปโหลดสลิป'
  ]);

  return {
    paymentId: paymentId,
    debtId: data.debtId || '',
    userId: data.userId,
    amount: data.amount || 0,
    driveFileId: fileId,
    slipViewUrl: slipViewUrl,
    uploadedAt: nowStr
  };
}

/**
 * บันทึกหรืออัปเดตข้อมูลลูกหนี้ (Debtors)
 */
function handleRegisterDebtor(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTORS);
  const values = sheet.getDataRange().getValues();
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.userId) {
      sheet.getRange(i + 1, 1, 1, 7).setValues([[
        data.userId,
        data.displayName || values[i][1],
        data.fullName || values[i][2],
        data.phone || values[i][3],
        data.idCardNumber || values[i][4],
        values[i][5],
        'ACTIVE'
      ]]);
      return { status: 'UPDATED', userId: data.userId };
    }
  }

  sheet.appendRow([
    data.userId,
    data.displayName || '',
    data.fullName || '',
    data.phone || '',
    data.idCardNumber || '',
    nowStr,
    'ACTIVE'
  ]);
  return { status: 'CREATED', userId: data.userId };
}

/**
 * สร้างสัญญาหนี้ใหม่ (Debts)
 */
function handleCreateDebt(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTS);
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const debtId = 'DB-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMM') + '-' + Math.floor(1000 + Math.random() * 9000);

  sheet.appendRow([
    debtId,
    data.userId,
    Number(data.totalAmount),
    Number(data.installmentAmount),
    Number(data.totalAmount),
    data.dueDate,
    Number(data.cycleDays || 30),
    'ACTIVE',
    nowStr,
    nowStr
  ]);

  return {
    debtId: debtId,
    userId: data.userId,
    totalAmount: Number(data.totalAmount),
    installmentAmount: Number(data.installmentAmount),
    dueDate: data.dueDate
  };
}

/**
 * ดึงสัญญาหนี้ที่กำลังเปิดใช้งาน (ACTIVE) ของผู้ใช้
 */
function handleGetActiveDebt(userId) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTS);
  const values = sheet.getDataRange().getValues();

  for (let i = values.length - 1; i >= 1; i--) {
    const row = values[i];
    if (row[1] === userId && (row[7] === 'ACTIVE' || row[7] === 'OVERDUE')) {
      return {
        debtId: row[0],
        userId: row[1],
        totalAmount: Number(row[2]) || 0,
        installmentAmount: Number(row[3]) || 0,
        remainingBalance: Number(row[4]) || 0,
        dueDate: Utilities.formatDate(new Date(row[5]), 'Asia/Bangkok', 'yyyy-MM-dd'),
        cycleDays: Number(row[6]) || 30,
        debtStatus: row[7],
        createdAt: row[8],
        updatedAt: row[9]
      };
    }
  }
  return null;
}

/**
 * ดึงข้อมูลลูกหนี้
 */
function handleGetDebtor(userId) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTORS);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === userId) {
      return {
        userId: values[i][0],
        displayName: values[i][1],
        fullName: values[i][2],
        phone: values[i][3],
        idCardNumber: values[i][4],
        registeredAt: values[i][5],
        status: values[i][6]
      };
    }
  }
  return null;
}

/**
 * ดึงรายชื่อลูกหนี้ทั้งหมด (Debtors)
 */
function handleGetAllDebtors() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTORS);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const list = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row[0] && String(row[0]).startsWith('U')) {
      list.push({
        userId: row[0],
        displayName: row[1] || '',
        fullName: row[2] || row[1] || '',
        phone: row[3] || '',
        idCardNumber: row[4] || '',
        registeredAt: row[5] ? Utilities.formatDate(new Date(row[5]), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss') : '',
        status: row[6] || 'ACTIVE'
      });
    }
  }
  return list;
}

/**
 * ดึงประวัติการส่งสลิปของผู้ใช้
 */
function handleGetPayments(userId) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PAYMENTS);
  const values = sheet.getDataRange().getValues();
  const list = [];

  for (let i = values.length - 1; i >= 1; i--) {
    const r = values[i];
    if (r[2] === userId) {
      list.push({
        paymentId: r[0],
        debtId: r[1],
        userId: r[2],
        amount: Number(r[3]) || 0,
        driveFileId: r[4],
        slipViewUrl: r[5],
        uploadedAt: r[6],
        verificationStatus: r[7] || 'PENDING',
        adminNote: r[8] || ''
      });
    }
  }
  return list;
}

/**
 * ดึงประวัติสลิปทั้งหมด (Admin)
 */
function handleGetAllPayments() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const pSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PAYMENTS);
  const dSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTORS);
  
  const pValues = pSheet.getDataRange().getValues();
  const dValues = dSheet ? dSheet.getDataRange().getValues() : [];
  const debtorMap = {};

  for (let i = 1; i < dValues.length; i++) {
    debtorMap[dValues[i][0]] = { name: dValues[i][2] || dValues[i][1] || 'ลูกค้า', phone: dValues[i][3] || '' };
  }

  const list = [];
  for (let i = pValues.length - 1; i >= 1; i--) {
    const r = pValues[i];
    const debtor = debtorMap[r[2]] || { name: 'ลูกค้า', phone: '' };
    list.push({
      paymentId: r[0],
      debtId: r[1],
      userId: r[2],
      debtorName: debtor.name,
      debtorPhone: debtor.phone,
      amount: Number(r[3]) || 0,
      driveFileId: r[4],
      slipViewUrl: r[5],
      uploadedAt: r[6],
      verificationStatus: r[7] || 'PENDING',
      adminNote: r[8] || ''
    });
  }
  return list;
}

/**
 * ดึงสัญญาทั้งหมด (Admin)
 */
function handleGetAllDebts() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const dSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTS);
  const uSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTORS);
  
  const dValues = dSheet.getDataRange().getValues();
  const uValues = uSheet ? uSheet.getDataRange().getValues() : [];
  const userMap = {};

  for (let i = 1; i < uValues.length; i++) {
    userMap[uValues[i][0]] = { name: uValues[i][2] || uValues[i][1] || 'ไม่ระบุชื่อ', phone: uValues[i][3] || '' };
  }

  const list = [];
  for (let i = 1; i < dValues.length; i++) {
    const r = dValues[i];
    const user = userMap[r[1]] || { name: 'ไม่ระบุชื่อ', phone: '' };
    list.push({
      debtId: r[0],
      userId: r[1],
      debtorName: user.name,
      debtorPhone: user.phone,
      totalAmount: Number(r[2]) || 0,
      installmentAmount: Number(r[3]) || 0,
      remainingBalance: Number(r[4]) || 0,
      dueDate: r[5] ? Utilities.formatDate(new Date(r[5]), 'Asia/Bangkok', 'yyyy-MM-dd') : '',
      cycleDays: Number(r[6]) || 30,
      debtStatus: r[7] || 'ACTIVE',
      createdAt: r[8],
      updatedAt: r[9]
    });
  }
  return list;
}

/**
 * อนุมัติสลิป และหักลดยอดหนี้
 */
function handleApprovePayment(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const pSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PAYMENTS);
  const pValues = pSheet.getDataRange().getValues();
  let paymentRow = -1;
  let targetDebtId = '';
  let targetUserId = '';
  let originalAmount = 0;

  for (let i = 1; i < pValues.length; i++) {
    if (pValues[i][0] === data.paymentId) {
      paymentRow = i + 1;
      targetDebtId = pValues[i][1];
      targetUserId = pValues[i][2];
      originalAmount = Number(pValues[i][3]) || 0;
      break;
    }
  }

  if (paymentRow === -1) throw new Error('Payment not found');

  const paidAmount = Number(data.confirmedAmount) || originalAmount;
  pSheet.getRange(paymentRow, 4).setValue(paidAmount);
  pSheet.getRange(paymentRow, 8).setValue('VERIFIED');
  pSheet.getRange(paymentRow, 9).setValue(data.note || 'อนุมัติเรียบร้อย');

  let updatedDebt = null;
  if (targetDebtId) {
    const dSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTS);
    const dValues = dSheet.getDataRange().getValues();

    for (let j = 1; j < dValues.length; j++) {
      if (dValues[j][0] === targetDebtId) {
        const dRow = j + 1;
        const currentRemaining = Number(dValues[j][4]) || 0;
        const newRemaining = Math.max(0, currentRemaining - paidAmount);
        const newStatus = newRemaining === 0 ? 'PAID' : dValues[j][7];
        const nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

        dSheet.getRange(dRow, 5).setValue(newRemaining);
        dSheet.getRange(dRow, 8).setValue(newStatus);
        dSheet.getRange(dRow, 10).setValue(nowStr);

        updatedDebt = { debtId: targetDebtId, remainingBalance: newRemaining, debtStatus: newStatus };
        break;
      }
    }
  }

  return {
    paymentId: data.paymentId,
    debtId: targetDebtId,
    userId: targetUserId,
    paidAmount: paidAmount,
    status: 'VERIFIED',
    updatedDebt: updatedDebt
  };
}

/**
 * ปฏิเสธสลิป
 */
function handleRejectPayment(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const pSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PAYMENTS);
  const pValues = pSheet.getDataRange().getValues();

  for (let i = 1; i < pValues.length; i++) {
    if (pValues[i][0] === data.paymentId) {
      const pRow = i + 1;
      pSheet.getRange(pRow, 8).setValue('REJECTED');
      pSheet.getRange(pRow, 9).setValue(data.reason || 'ยอดเงินหรือสลิปไม่ถูกต้อง');
      return {
        paymentId: data.paymentId,
        debtId: pValues[i][1],
        userId: pValues[i][2],
        status: 'REJECTED',
        reason: data.reason
      };
    }
  }
  throw new Error('Payment not found');
}

/**
 * ดึงรายการหนี้ที่ถึงกำหนดแจ้งเตือน
 */
function handleGetDueDebts() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const dSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTS);
  const uSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTORS);

  const dValues = dSheet.getDataRange().getValues();
  const uValues = uSheet ? uSheet.getDataRange().getValues() : [];
  const userMap = {};

  for (let i = 1; i < uValues.length; i++) {
    userMap[uValues[i][0]] = { name: uValues[i][2] || uValues[i][1] || 'คุณลูกค้า' };
  }

  const todayStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = Utilities.formatDate(tomorrow, 'Asia/Bangkok', 'yyyy-MM-dd');

  const dueList = [];
  for (let i = 1; i < dValues.length; i++) {
    const r = dValues[i];
    const dueDate = r[5] ? Utilities.formatDate(new Date(r[5]), 'Asia/Bangkok', 'yyyy-MM-dd') : '';
    const debtStatus = r[7];

    if (!dueDate || debtStatus === 'PAID' || debtStatus === 'SETTLED') continue;

    let reminderType = null;
    if (dueDate === todayStr) {
      reminderType = 'DUE_TODAY';
    } else if (dueDate === tomorrowStr) {
      reminderType = 'DUE_BEFORE_1_DAY';
    } else if (dueDate < todayStr) {
      reminderType = 'OVERDUE';
    }

    if (reminderType) {
      dueList.push({
        debtId: r[0],
        userId: r[1],
        debtorName: userMap[r[1]]?.name || 'คุณลูกค้า',
        installmentAmount: Number(r[3]) || 0,
        remainingBalance: Number(r[4]) || 0,
        dueDate: dueDate,
        debtStatus: debtStatus,
        reminderType: reminderType
      });
    }
  }

  return dueList;
}

/**
 * บันทึก Log การแจ้งเตือน
 */
function handleLogReminder(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REMINDER_LOGS);
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const logId = 'LOG-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000);

  sheet.appendRow([
    logId,
    data.debtId,
    data.userId,
    data.reminderType,
    nowStr,
    data.status || 'SUCCESS'
  ]);
  return { logId: logId, status: 'LOGGED' };
}

/**
 * ตรวจสอบการส่งซ้ำ
 */
function handleHasBeenRemindedToday(debtId, reminderType) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REMINDER_LOGS);
  const values = sheet.getDataRange().getValues();
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');

  for (let i = 1; i < values.length; i++) {
    const rDebtId = values[i][1];
    const rType = values[i][3];
    const rSentAt = values[i][4] ? String(values[i][4]) : '';

    if (rDebtId === debtId && rType === reminderType && rSentAt.indexOf(todayStr) !== -1) {
      return true;
    }
  }
  return false;
}

/**
 * ==============================================================================
 * ฟังก์ชันจัดการผู้ดูแลระบบ (Admin Management)
 * ==============================================================================
 */

/**
 * ดึงรายชื่อผู้ดูแลระบบทั้งหมดจาก Sheet 'admin'
 */
function handleGetAllAdmins() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ADMINS) || ss.getSheetByName('admin') || ss.getSheetByName('Admins');
  if (!sheet) return [];

  // หากยังไม่มีข้อมูลหรือไม่มี Header
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS.admin);
    return [];
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const admins = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const userId = String(row[0] || '').trim();
    if (userId) {
      admins.push({
        userId: userId,
        displayName: row[1] ? String(row[1]) : '',
        role: row[2] ? String(row[2]) : 'ADMIN',
        phone: row[3] ? String(row[3]) : '',
        note: row[4] ? String(row[4]) : '',
        createdAt: row[5] ? (row[5] instanceof Date ? Utilities.formatDate(row[5], 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss') : String(row[5])) : '',
        status: row[6] ? String(row[6]).toUpperCase() : 'ACTIVE'
      });
    }
  }

  return admins;
}

/**
 * บันทึกหรืออัปเดตข้อมูลผู้ดูแลระบบ
 */
function handleSaveAdmin(contents) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ADMINS) || ss.getSheetByName('admin') || ss.getSheetByName('Admins');
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.ADMINS);
    sheet.appendRow(HEADERS.admin);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS.admin);
  }

  const userId = String(contents.userId || '').trim();
  if (!userId) throw new Error('userId is required');

  const displayName = contents.displayName || '';
  const role = contents.role || 'ADMIN';
  const phone = contents.phone || '';
  const note = contents.note || '';
  const status = (contents.status || 'ACTIVE').toUpperCase();
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

  const data = sheet.getDataRange().getValues();
  let foundRowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === userId) {
      foundRowIndex = i + 1; // 1-indexed
      break;
    }
  }

  if (foundRowIndex > -1) {
    // แก้ไขข้อมูลเดิม
    sheet.getRange(foundRowIndex, 2).setValue(displayName);
    sheet.getRange(foundRowIndex, 3).setValue(role);
    sheet.getRange(foundRowIndex, 4).setValue(phone);
    sheet.getRange(foundRowIndex, 5).setValue(note);
    sheet.getRange(foundRowIndex, 7).setValue(status);
    return { action: 'updated', userId, displayName, role, status };
  } else {
    // เพิ่มแอดมินใหม่
    sheet.appendRow([userId, displayName, role, phone, note, nowStr, status]);
    return { action: 'created', userId, displayName, role, status };
  }
}

/**
 * ลบผู้ดูแลระบบออกจากชีต
 */
function handleDeleteAdmin(userId) {
  const cleanId = String(userId || '').trim();
  if (!cleanId) throw new Error('userId is required');

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ADMINS) || ss.getSheetByName('admin') || ss.getSheetByName('Admins');
  if (!sheet) return { deleted: false, message: 'Sheet not found' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === cleanId) {
      sheet.deleteRow(i + 1);
      return { deleted: true, userId: cleanId };
    }
  }

  return { deleted: false, message: 'Admin not found' };
}
