const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const TIMEZONE = process.env.TIMEZONE || 'Asia/Bangkok';

/**
 * ดึงวัตถุ dayjs ณ เวลาปัจจุบันในเขตเวลาไทย
 */
function getNowBangkok() {
  return dayjs().tz(TIMEZONE);
}

/**
 * ดึงสตริงวันที่ปัจจุบันในรูปแบบ YYYY-MM-DD
 */
function getTodayStringBangkok() {
  return getNowBangkok().format('YYYY-MM-DD');
}

/**
 * ดึงสตริงวันเวลาปัจจุบันในรูปแบบ YYYY-MM-DD HH:mm:ss
 */
function getNowStringBangkok() {
  return getNowBangkok().format('YYYY-MM-DD HH:mm:ss');
}

/**
 * แปลงสตริงวันที่ใดๆ ให้อยู่ในรูปแบบ YYYY-MM-DD อย่างปลอดภัย
 * รองรับทั้ง ISO (2026-10-02), วันที่ไทย (02/10/2026), หรือรูปแบบอื่น
 */
function normalizeDate(rawDate) {
  if (!rawDate) return '';
  const str = String(rawDate).trim();
  if (!str) return '';

  // ตรวจสอบถ้าเป็น YYYY-MM-DD อยู่แล้ว
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // รูปแบบ DD/MM/YYYY หรือ DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    let year = parseInt(dmyMatch[3], 10);
    // กรณีปี พ.ศ. (เกิน 2500) ให้แปลงเป็น ค.ศ.
    if (year > 2400) year -= 543;
    const month = String(dmyMatch[2]).padStart(2, '0');
    const day = String(dmyMatch[1]).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = dayjs(str).tz(TIMEZONE);
  if (parsed.isValid()) {
    return parsed.format('YYYY-MM-DD');
  }

  return str;
}

/**
 * คำนวณวันครบกำหนดในงวดถัดไปตามจำนวนวันรอบบิล (cycleDays)
 */
function calculateNextDueDate(currentDueDate, cycleDays = 30) {
  const normalized = normalizeDate(currentDueDate);
  const baseDate = normalized ? dayjs(normalized).tz(TIMEZONE) : getNowBangkok();
  const validBase = baseDate.isValid() ? baseDate : getNowBangkok();
  return validBase.add(Number(cycleDays) || 30, 'day').format('YYYY-MM-DD');
}

module.exports = {
  TIMEZONE,
  getNowBangkok,
  getTodayStringBangkok,
  getNowStringBangkok,
  normalizeDate,
  calculateNextDueDate
};
