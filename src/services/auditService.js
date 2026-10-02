const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const { getNowStringBangkok, TIMEZONE } = require('../utils/dateHelper');
const { sheets, sheetId } = require('../config/google');
const { isGasConfigured, callGas } = require('./gasService');

const AUDIT_SHEET_NAME = 'AuditLogs';
const AUDIT_HEADERS = ['logId', 'timestamp', 'operatorUserId', 'operatorName', 'action', 'targetType', 'targetId', 'details', 'ipAddress'];

// In-memory fallback if sheet is not yet created
const inMemoryAuditLogs = [];

/**
 * บันทึกการกระทำลงในระบบ Audit Trail
 */
async function logAuditAction({
  operatorUserId = 'SYSTEM',
  operatorName = 'ระบบอัตโนมัติ',
  action = 'GENERAL_ACTION',
  targetType = '',
  targetId = '',
  details = '',
  ipAddress = '-'
}) {
  const timestamp = getNowStringBangkok();
  const logId = `AUD-${dayjs().tz(TIMEZONE).format('YYYYMMDD')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const logEntry = {
    logId,
    timestamp,
    operatorUserId,
    operatorName,
    action,
    targetType,
    targetId,
    details: typeof details === 'object' ? JSON.stringify(details) : String(details),
    ipAddress
  };

  // เก็บไว้ใน memory เสมอเพื่อความรวดเร็วในการสืบค้นล่าสุด
  inMemoryAuditLogs.unshift(logEntry);
  if (inMemoryAuditLogs.length > 500) inMemoryAuditLogs.pop();

  try {
    if (isGasConfigured()) {
      await callGas('logAudit', logEntry);
      return logEntry;
    }

    if (sheets && sheetId) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${AUDIT_SHEET_NAME}!A:I`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            logId,
            timestamp,
            operatorUserId,
            operatorName,
            action,
            targetType,
            targetId,
            logEntry.details,
            ipAddress
          ]]
        }
      });
    }
  } catch (error) {
    console.warn('⚠️ [AuditLog Warning] Could not persist audit log to Sheets:', error.message);
  }

  return logEntry;
}

/**
 * ดึงรายการ Audit Logs ล่าสุด (สำหรับแสดงใน Admin Portal)
 */
async function getRecentAuditLogs(limit = 100) {
  try {
    if (isGasConfigured()) {
      const res = await callGas('getAuditLogs', { limit });
      if (res && Array.isArray(res.logs)) return res.logs;
    }

    if (sheets && sheetId) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${AUDIT_SHEET_NAME}!A2:I`
      });
      const rows = res.data.values || [];
      const logs = rows.map(r => ({
        logId: r[0] || '',
        timestamp: r[1] || '',
        operatorUserId: r[2] || '',
        operatorName: r[3] || '',
        action: r[4] || '',
        targetType: r[5] || '',
        targetId: r[6] || '',
        details: r[7] || '',
        ipAddress: r[8] || ''
      }));
      return logs.reverse().slice(0, limit);
    }
  } catch (error) {
    console.warn('⚠️ [AuditLog Warning] Falling back to memory logs:', error.message);
  }

  return inMemoryAuditLogs.slice(0, limit);
}

module.exports = {
  logAuditAction,
  getRecentAuditLogs,
  AUDIT_SHEET_NAME,
  AUDIT_HEADERS
};
