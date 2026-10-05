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
    ADMINS: 'admin',
    REMINDER_PROFILES: 'ReminderProfiles',
    AUDIT_LOGS: 'AuditLogs'
  }
};

const HEADERS = {
  Debtors: ['userId', 'displayName', 'fullName', 'phone', 'idCardNumber', 'registeredAt', 'status', 'reminderProfileId', 'reminderEnabled', 'pdpaConsent', 'pdpaConsentAt'],
  Debts: ['debtId', 'userId', 'totalAmount', 'installmentAmount', 'remainingBalance', 'dueDate', 'cycleDays', 'debtStatus', 'createdAt', 'updatedAt', 'reminderProfileId', 'reminderEnabled', 'customReminderTimes'],
  Payments: ['paymentId', 'debtId', 'userId', 'amount', 'driveFileId', 'slipViewUrl', 'uploadedAt', 'verificationStatus', 'adminNote', 'receiptNo', 'approvedBy', 'approvedAt', 'fileHash'],
  ReminderLogs: ['logId', 'debtId', 'userId', 'reminderType', 'sentAt', 'status'],
  admin: ['userId', 'displayName', 'role', 'phone', 'note', 'createdAt', 'status'],
  ReminderProfiles: ['profileId', 'name', 'frequencyType', 'scheduleConfig', 'primaryTime', 'secondaryTime', 'rulesConfig', 'templateConfig', 'isDefault', 'status', 'createdAt', 'updatedAt'],
  AuditLogs: ['logId', 'timestamp', 'operatorUserId', 'operatorName', 'action', 'targetType', 'targetId', 'details', 'ipAddress']
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

      case 'recordPayment':
        result = handleRecordPayment(contents);
        break;

      case 'syncDriveSlips':
        result = handleSyncDriveSlips();
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
        result = handleHasBeenRemindedToday(contents.debtId, contents.reminderType, contents.timeSlot);
        break;

      case 'updateDebt':
        result = handleUpdateDebt(contents);
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

      case 'deleteDebt':
        result = handleDeleteDebt(contents.debtId);
        break;

      case 'updateDebtorReminderConfig':
        result = handleUpdateDebtorReminderConfig(contents);
        break;

      case 'updateDebtReminderConfig':
        result = handleUpdateDebtReminderConfig(contents);
        break;

      case 'getSettings':
        result = handleGetSettings();
        break;

      case 'saveSettings':
        result = handleSaveSettings(contents);
        break;

      case 'getReminderProfiles':
        result = handleGetReminderProfiles();
        break;

      case 'saveReminderProfile':
        result = handleSaveReminderProfile(contents);
        break;

      case 'deleteReminderProfile':
        result = handleDeleteReminderProfile(contents.profileId);
        break;

      case 'logAudit':
        result = handleLogAudit(contents);
        break;

      case 'getAuditLogs':
        result = handleGetAuditLogs(contents);
        break;

      case 'setupAutoReminderTrigger':
        result = setupAutoReminderTrigger();
        break;

      case 'triggerVercelReminderCheck':
        result = triggerVercelReminderCheck();
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
  let fileId = '';
  let slipViewUrl = '';

  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const cleanBase64 = data.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const bytes = Utilities.base64Decode(cleanBase64);
    const mimeType = data.mimeType || 'image/jpeg';
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
    const fileName = 'SLIP_' + (data.userId || 'USER') + '_' + timestamp + '.jpg';

    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      console.warn('Set sharing notice:', shareErr);
    }

    fileId = file.getId();
    slipViewUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
  } catch (driveErr) {
    console.warn('DriveApp handleUploadSlip note:', driveErr);
    slipViewUrl = data.slipViewUrl || '';
  }

  const paymentId = 'PAY-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000);
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

  // บันทึกลง Sheet Payments เสมอ!
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PAYMENTS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.PAYMENTS);
    sheet.appendRow(HEADERS.Payments);
  }

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
 * บันทึกรายการสลิปชำระเงินลง Sheet Payments โดยตรง (เมื่อมีไฟล์ใน Drive อยู่แล้ว)
 */
function handleRecordPayment(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PAYMENTS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.PAYMENTS);
    sheet.appendRow(HEADERS.Payments);
  }

  const paymentId = data.paymentId || ('PAY-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000));
  const nowStr = data.uploadedAt || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const fileId = data.driveFileId || '';
  const slipViewUrl = data.slipViewUrl || (fileId ? ('https://lh3.googleusercontent.com/d/' + fileId) : '');

  sheet.appendRow([
    paymentId,
    data.debtId || '',
    data.userId,
    data.amount ? Number(data.amount) : '',
    fileId,
    slipViewUrl,
    nowStr,
    data.verificationStatus || 'PENDING',
    data.adminNote || 'บันทึกการชำระเงิน',
    data.receiptNo || '',
    data.approvedBy || '',
    data.approvedAt || '',
    data.fileHash || ''
  ]);

  return {
    paymentId: paymentId,
    debtId: data.debtId || '',
    userId: data.userId,
    amount: data.amount || 0,
    driveFileId: fileId,
    slipViewUrl: slipViewUrl,
    uploadedAt: nowStr,
    verificationStatus: data.verificationStatus || 'PENDING'
  };
}

/**
 * ซิงค์ไฟล์สลิปที่ค้างอยู่ใน Google Drive เข้าสู่ตาราง Payments
 */
function handleSyncDriveSlips() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const files = folder.getFiles();
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PAYMENTS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.PAYMENTS);
    sheet.appendRow(HEADERS.Payments);
  }

  const pValues = sheet.getDataRange().getValues();
  const existingFileIds = new Set();
  for (let i = 1; i < pValues.length; i++) {
    if (pValues[i][4]) existingFileIds.add(String(pValues[i][4]).trim());
  }

  let addedCount = 0;
  while (files.hasNext()) {
    const file = files.next();
    const fId = file.getId();
    if (!existingFileIds.has(fId)) {
      const fName = file.getName();
      let uId = '';
      const match = fName.match(/SLIP_(?:WEB_)?([^_]+)_/);
      if (match && match[1]) uId = match[1];

      // ค้นหาสัญญา Active ของลูกหนี้รายนี้จากชีต Debts
      let matchedDebtId = '';
      if (uId) {
        const debtsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTS);
        if (debtsSheet) {
          const dData = debtsSheet.getDataRange().getValues();
          for (let d = 1; d < dData.length; d++) {
            if (dData[d][1] === uId && (dData[d][7] === 'ACTIVE' || dData[d][7] === 'OVERDUE')) {
              matchedDebtId = dData[d][0];
              break;
            }
          }
        }
      }

      const paymentId = 'PAY-' + Utilities.formatDate(file.getDateCreated(), 'Asia/Bangkok', 'yyyyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000);
      const createdStr = Utilities.formatDate(file.getDateCreated(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
      const viewUrl = 'https://lh3.googleusercontent.com/d/' + fId;

      sheet.appendRow([
        paymentId,
        matchedDebtId,
        uId,
        0,
        fId,
        viewUrl,
        createdStr,
        'PENDING',
        'ซิงค์จาก Google Drive'
      ]);
      addedCount++;
    }
  }

  return { success: true, addedCount };
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
    nowStr,
    data.reminderProfileId || '',
    data.reminderEnabled !== false ? 'TRUE' : 'FALSE',
    data.customReminderTimes || ''
  ]);

  return {
    debtId: debtId,
    userId: data.userId,
    totalAmount: Number(data.totalAmount),
    installmentAmount: Number(data.installmentAmount),
    dueDate: data.dueDate,
    reminderProfileId: data.reminderProfileId || '',
    reminderEnabled: data.reminderEnabled !== false
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
      const isRemindEnabled = row[8] === undefined || row[8] === '' || row[8] === 'TRUE' || row[8] === 'true' || row[8] === true;
      list.push({
        userId: row[0],
        displayName: row[1] || '',
        fullName: row[2] || row[1] || '',
        phone: row[3] || '',
        idCardNumber: row[4] || '',
        registeredAt: row[5] ? Utilities.formatDate(new Date(row[5]), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss') : '',
        status: row[6] || 'ACTIVE',
        reminderProfileId: row[7] || '',
        reminderEnabled: isRemindEnabled
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
      adminNote: r[8] || '',
      receiptNo: r[9] || '',
      approvedBy: r[10] || '',
      approvedAt: r[11] || '',
      fileHash: r[12] || ''
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
    const isRemindEnabled = r[11] === undefined || r[11] === '' || r[11] === 'TRUE' || r[11] === 'true' || r[11] === true;
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
      updatedAt: r[9],
      reminderProfileId: r[10] || '',
      reminderEnabled: isRemindEnabled,
      customReminderTimes: r[12] ? String(r[12]).trim() : ''
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
  const nowBangkok = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const yyyymm = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMM');
  const receiptNo = data.receiptNo || ('RC-' + yyyymm + '-' + Math.floor(1000 + Math.random() * 9000));
  const approvedBy = data.approvedBy || 'Admin';

  pSheet.getRange(paymentRow, 4).setValue(paidAmount);
  pSheet.getRange(paymentRow, 8).setValue('VERIFIED');
  pSheet.getRange(paymentRow, 9).setValue(data.note || 'อนุมัติเรียบร้อย');
  pSheet.getRange(paymentRow, 10).setValue(receiptNo);
  pSheet.getRange(paymentRow, 11).setValue(approvedBy);
  pSheet.getRange(paymentRow, 12).setValue(nowBangkok);

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
        const cycleDays = Number(dValues[j][6]) || 30;
        const currentDueDate = dValues[j][5] ? Utilities.formatDate(new Date(dValues[j][5]), 'Asia/Bangkok', 'yyyy-MM-dd') : '';
        let nextDueDate = currentDueDate;
        if (newRemaining > 0 && currentDueDate) {
          const d = new Date(currentDueDate);
          d.setDate(d.getDate() + cycleDays);
          nextDueDate = Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
        }

        dSheet.getRange(dRow, 5).setValue(newRemaining);
        dSheet.getRange(dRow, 6).setValue(nextDueDate);
        dSheet.getRange(dRow, 8).setValue(newStatus);
        dSheet.getRange(dRow, 10).setValue(nowBangkok);

        updatedDebt = { debtId: targetDebtId, remainingBalance: newRemaining, dueDate: nextDueDate, debtStatus: newStatus };
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
    receiptNo: receiptNo,
    approvedBy: approvedBy,
    approvedAt: nowBangkok,
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
function handleHasBeenRemindedToday(debtId, reminderType, timeSlot) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REMINDER_LOGS);
  if (!sheet) return false;
  const values = sheet.getDataRange().getValues();
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');

  for (let i = 1; i < values.length; i++) {
    const rDebtId = values[i][1];
    const rawType = String(values[i][3] || '').trim();
    const cleanType = rawType.split(' [')[0].trim();
    const rSentAt = values[i][4] ? String(values[i][4]) : '';

    if (rDebtId === debtId && (cleanType === reminderType || rawType === reminderType || rawType.startsWith(reminderType)) && rSentAt.indexOf(todayStr) !== -1) {
      if (timeSlot) {
        if (rawType.indexOf('[' + timeSlot + ']') !== -1) return true;
        if (!rawType.match(/\[\d{2}:\d{2}\]/)) return true;
      } else {
        return true;
      }
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

/**
 * ลบสัญญาหนี้ออกจากชีต Debts
 */
function handleDeleteDebt(debtId) {
  const cleanId = String(debtId || '').trim();
  if (!cleanId) throw new Error('debtId is required');

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTS);
  if (!sheet) return { deleted: false, message: 'Sheet not found' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === cleanId) {
      sheet.deleteRow(i + 1);
      return { deleted: true, debtId: cleanId };
    }
  }

  return { deleted: false, message: 'Debt not found' };
}

/**
 * อัปเดตการตั้งค่าการแจ้งเตือนของลูกหนี้
 */
function handleUpdateDebtorReminderConfig(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTORS);
  if (!sheet) return { success: false, message: 'Sheet Debtors not found' };

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(data.userId).trim()) {
      const rowNum = i + 1;
      const profileVal = data.reminderProfileId !== undefined ? (data.reminderProfileId || '') : (values[i][7] || '');
      const enabledVal = data.reminderEnabled !== undefined ? (data.reminderEnabled ? 'TRUE' : 'FALSE') : (values[i][8] || 'TRUE');

      sheet.getRange(rowNum, 8).setValue(profileVal);
      sheet.getRange(rowNum, 9).setValue(enabledVal);
      return { success: true, userId: data.userId, reminderProfileId: profileVal, reminderEnabled: enabledVal === 'TRUE' };
    }
  }
  return { success: false, message: 'Debtor not found' };
}

/**
 * อัปเดตการตั้งค่าการแจ้งเตือนของสัญญาหนี้
 */
function handleUpdateDebtReminderConfig(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTS);
  if (!sheet) return { success: false, message: 'Sheet Debts not found' };

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(data.debtId).trim()) {
      const rowNum = i + 1;
      const profileVal = data.reminderProfileId !== undefined ? (data.reminderProfileId || '') : (values[i][10] || '');
      const enabledVal = data.reminderEnabled !== undefined ? (data.reminderEnabled ? 'TRUE' : 'FALSE') : (values[i][11] || 'TRUE');
      const customTimesVal = data.customReminderTimes !== undefined ? String(data.customReminderTimes).trim() : (values[i][12] ? String(values[i][12]).trim() : '');

      sheet.getRange(rowNum, 11).setValue(profileVal);
      sheet.getRange(rowNum, 12).setValue(enabledVal);
      sheet.getRange(rowNum, 13).setValue(customTimesVal);
      return {
        success: true,
        debtId: data.debtId,
        reminderProfileId: profileVal,
        reminderEnabled: enabledVal === 'TRUE',
        customReminderTimes: customTimesVal
      };
    }
  }
  return { success: false, message: 'Debt not found' };
}

/**
 * อัปเดตข้อมูลสัญญาหนี้ (Full Edit)
 */
function handleUpdateDebt(data) {
  const cleanId = String(data.debtId || '').trim();
  if (!cleanId) throw new Error('debtId is required');

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DEBTS);
  if (!sheet) throw new Error('Sheet Debts not found');

  const values = sheet.getDataRange().getValues();
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === cleanId) {
      const rowNum = i + 1;
      const currentRow = values[i];

      const newUserId = data.userId !== undefined ? data.userId : currentRow[1];
      const newTotalAmount = data.totalAmount !== undefined ? Number(data.totalAmount) : (Number(currentRow[2]) || 0);
      const newInstallmentAmount = data.installmentAmount !== undefined ? Number(data.installmentAmount) : (Number(currentRow[3]) || 0);
      const newRemainingBalance = data.remainingBalance !== undefined ? Number(data.remainingBalance) : (Number(currentRow[4]) || 0);
      const newDueDate = data.dueDate !== undefined ? data.dueDate : (currentRow[5] ? Utilities.formatDate(new Date(currentRow[5]), 'Asia/Bangkok', 'yyyy-MM-dd') : '');
      const newCycleDays = data.cycleDays !== undefined ? Number(data.cycleDays) : (Number(currentRow[6]) || 30);

      let newDebtStatus = data.debtStatus !== undefined ? String(data.debtStatus).toUpperCase() : (currentRow[7] || 'ACTIVE');
      if (newRemainingBalance <= 0 && newDebtStatus === 'ACTIVE') {
        newDebtStatus = 'PAID';
      }

      const createdAt = currentRow[8] || nowStr;
      const updatedAt = nowStr;
      const newReminderProfileId = data.reminderProfileId !== undefined ? data.reminderProfileId : (currentRow[10] || '');
      const newReminderEnabled = data.reminderEnabled !== undefined ? (data.reminderEnabled ? 'TRUE' : 'FALSE') : (currentRow[11] || 'TRUE');
      const newCustomReminderTimes = data.customReminderTimes !== undefined ? String(data.customReminderTimes).trim() : (currentRow[12] ? String(currentRow[12]).trim() : '');

      // อัปเดตคอลัมน์ B ถึง M (คอลัมน์ 2 ถึง 13)
      sheet.getRange(rowNum, 2, 1, 12).setValues([[
        newUserId,
        newTotalAmount,
        newInstallmentAmount,
        newRemainingBalance,
        newDueDate,
        newCycleDays,
        newDebtStatus,
        createdAt,
        updatedAt,
        newReminderProfileId,
        newReminderEnabled,
        newCustomReminderTimes
      ]]);

      return {
        success: true,
        debtId: cleanId,
        userId: newUserId,
        totalAmount: newTotalAmount,
        installmentAmount: newInstallmentAmount,
        remainingBalance: newRemainingBalance,
        dueDate: newDueDate,
        cycleDays: newCycleDays,
        debtStatus: newDebtStatus,
        updatedAt: updatedAt,
        reminderProfileId: newReminderProfileId,
        reminderEnabled: newReminderEnabled === 'TRUE',
        customReminderTimes: newCustomReminderTimes
      };
    }
  }

  throw new Error('ไม่พบสัญญา ' + cleanId);
}

/**
 * ดึงการตั้งค่าระบบแจ้งเตือน (Settings)
 */
function handleGetSettings() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('REMINDER_SETTINGS');
  if (raw) {
    try {
      return { reminderSettings: JSON.parse(raw) };
    } catch (e) {}
  }
  return { reminderSettings: null };
}

/**
 * บันทึกการตั้งค่าระบบแจ้งเตือน (Settings)
 */
function handleSaveSettings(data) {
  if (!data || !data.reminderSettings) throw new Error('Missing reminderSettings payload');
  const props = PropertiesService.getScriptProperties();
  props.setProperty('REMINDER_SETTINGS', JSON.stringify(data.reminderSettings));
  return { success: true, saved: true };
}

/**
 * ดึงโปรไฟล์แจ้งเตือนทั้งหมดจากชีต ReminderProfiles
 */
function handleGetReminderProfiles() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REMINDER_PROFILES);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.REMINDER_PROFILES);
    sheet.appendRow(HEADERS.ReminderProfiles);
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (r[0] && String(r[0]).startsWith('PRF-')) {
      let sched = {};
      let rules = {};
      let tpl = {};
      try { sched = typeof r[3] === 'string' ? JSON.parse(r[3]) : r[3] || {}; } catch(e) {}
      try { rules = typeof r[6] === 'string' ? JSON.parse(r[6]) : r[6] || {}; } catch(e) {}
      try { tpl = typeof r[7] === 'string' ? JSON.parse(r[7]) : r[7] || {}; } catch(e) {}

      list.push({
        profileId: r[0],
        name: r[1] || 'รูปแบบแจ้งเตือน',
        frequencyType: r[2] || 'DAILY',
        scheduleConfig: sched,
        primaryTime: r[4] || '08:00',
        secondaryTime: r[5] || '',
        rulesConfig: rules,
        templateConfig: tpl,
        isDefault: r[8] === 'TRUE' || r[8] === true,
        status: (r[9] || 'ACTIVE').toUpperCase(),
        createdAt: r[10] || '',
        updatedAt: r[11] || ''
      });
    }
  }
  return list;
}

/**
 * บันทึกหรืออัปเดตโปรไฟล์แจ้งเตือนในชีต ReminderProfiles
 */
function handleSaveReminderProfile(data) {
  if (!data || !data.profileId) throw new Error('Missing profileId');
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REMINDER_PROFILES);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.REMINDER_PROFILES);
    sheet.appendRow(HEADERS.ReminderProfiles);
  }

  const values = sheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(data.profileId).trim()) {
      foundRow = i + 1;
      break;
    }
  }

  const nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const rowData = [
    data.profileId,
    data.name || 'รูปแบบแจ้งเตือน',
    data.frequencyType || 'DAILY',
    typeof data.scheduleConfig === 'object' ? JSON.stringify(data.scheduleConfig) : data.scheduleConfig || '{}',
    data.primaryTime || '08:00',
    data.secondaryTime || '',
    typeof data.rulesConfig === 'object' ? JSON.stringify(data.rulesConfig) : data.rulesConfig || '{}',
    typeof data.templateConfig === 'object' ? JSON.stringify(data.templateConfig) : data.templateConfig || '{}',
    data.isDefault ? 'TRUE' : 'FALSE',
    (data.status || 'ACTIVE').toUpperCase(),
    data.createdAt || nowStr,
    nowStr
  ];

  if (foundRow > -1) {
    sheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { success: true, profileId: data.profileId };
}

/**
 * ลบโปรไฟล์แจ้งเตือนออกจากชีต ReminderProfiles
 */
function handleDeleteReminderProfile(profileId) {
  if (!profileId) throw new Error('Missing profileId');
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.REMINDER_PROFILES);
  if (!sheet) return { deleted: false, message: 'Sheet not found' };

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(profileId).trim()) {
      sheet.deleteRow(i + 1);
      return { deleted: true, profileId: profileId };
    }
  }
  return { deleted: false, message: 'Profile not found' };
}

/**
 * บันทึกประวัติการกระทำลงในแท็บ AuditLogs
 */
function handleLogAudit(data) {
  if (!data) return { success: false };
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOGS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.AUDIT_LOGS);
    sheet.appendRow(HEADERS.AuditLogs);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.AuditLogs.length);
    headerRange.setFontWeight('bold').setBackground('#1E293B').setFontColor('#FFFFFF');
  }

  const nowBangkok = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  const logId = data.logId || ('AUD-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000));
  const detailsStr = typeof data.details === 'object' ? JSON.stringify(data.details) : String(data.details || '');

  sheet.appendRow([
    logId,
    data.timestamp || nowBangkok,
    data.operatorUserId || 'SYSTEM',
    data.operatorName || 'ระบบอัตโนมัติ',
    data.action || 'GENERAL_ACTION',
    data.targetType || '',
    data.targetId || '',
    detailsStr,
    data.ipAddress || '-'
  ]);

  return { success: true, logId: logId };
}

/**
 * ดึงประวัติ Audit Logs
 */
function handleGetAuditLogs(data) {
  const limit = (data && data.limit) ? Number(data.limit) : 100;
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.AUDIT_LOGS);
  if (!sheet) return { logs: [] };

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { logs: [] };

  const logs = [];
  for (let i = values.length - 1; i >= 1 && logs.length < limit; i--) {
    const row = values[i];
    logs.push({
      logId: row[0],
      timestamp: row[1],
      operatorUserId: row[2],
      operatorName: row[3],
      action: row[4],
      targetType: row[5],
      targetId: row[6],
      details: row[7],
      ipAddress: row[8]
    });
  }

  return { logs: logs };
}

/**
 * ==============================================================================
 * ฟังก์ชันตั้งเวลาอัตโนมัติบน Google Apps Script (GAS 24/7 Cloud Trigger for Vercel)
 * สำหรับปลุกและสั่งให้ระบบแจ้งเตือนบน Vercel ตรวจสอบรอบเวลาส่งทุกๆ 5 นาที
 * โดยทำงานบน Cloud ของ Google ตลอด 24 ชม. ฟรี ไม่ต้องเปิดคอมพิวเตอร์ทิ้งไว้
 * ==============================================================================
 */
function triggerVercelReminderCheck() {
  const vercelUrl = 'https://lineautomatic.vercel.app/api/reminder/trigger-now';
  try {
    const response = UrlFetchApp.fetch(vercelUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        triggerType: 'อัตโนมัติ (GAS Cloud Trigger)'
      }),
      muteHttpExceptions: true
    });
    Logger.log('Trigger Vercel Response: ' + response.getContentText());
    return { success: true, response: response.getContentText() };
  } catch (err) {
    Logger.log('Trigger Vercel Error: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * ติดตั้ง Trigger อัตโนมัติใน Google Apps Script เพียงกดรันฟังก์ชันนี้ 1 ครั้ง
 * จะสร้าง Trigger ทำงานทุกๆ 5 นาทีเพื่อยิงไปปลุก Vercel ให้ตรวจสอบรอบเวลา
 */
function setupAutoReminderTrigger() {
  // ลบ Trigger เดิมที่เคยสร้างไว้เพื่อไม่ให้ซ้ำซ้อน
  const allTriggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < allTriggers.length; i++) {
    if (allTriggers[i].getHandlerFunction() === 'triggerVercelReminderCheck') {
      ScriptApp.deleteTrigger(allTriggers[i]);
    }
  }

  // สร้าง Trigger ใหม่ รันทุกๆ 5 นาที (Every 5 minutes)
  ScriptApp.newTrigger('triggerVercelReminderCheck')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('✅ ตั้งค่า Trigger ตรวจสอบแจ้งเตือนทุกๆ 5 นาทีเรียบร้อยแล้ว');
  return { success: true, message: 'ตั้งค่า Trigger ทุก 5 นาทีเรียบร้อยแล้ว' };
}

