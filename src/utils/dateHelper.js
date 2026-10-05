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

/**
 * ตรวจสอบว่าเวลาปัจจุบันอยู่ในช่วงเวลาที่กฎหมายอนุญาตให้ทวงถามหนี้หรือไม่
 * ตาม พ.ร.บ. การทวงถามหนี้ พ.ศ. 2558 มาตรา 9:
 * - วันจันทร์ ถึง วันศุกร์: 08:00 - 20:00 น.
 * - วันเสาร์ อาทิตย์ และวันหยุดราชการ: 08:00 - 18:00 น.
 * 
 * @param {dayjs.Dayjs} [dateObj] วัตถุ dayjs (ค่าเริ่มต้นคือเวลาไทยปัจจุบัน)
 * @returns {{ allowed: boolean, reason?: string, currentHour: number, dayOfWeek: number }}
 */
function isLegalDebtCollectionTime(dateObj = null) {
  const now = dateObj ? dateObj.tz(TIMEZONE) : getNowBangkok();
  const dayOfWeek = now.day(); // 0 = อาทิตย์, 1 = จันทร์, ..., 6 = เสาร์
  const currentHour = now.hour();
  const currentMinute = now.minute();
  const timeInMinutes = currentHour * 60 + currentMinute;

  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
  const startMinutes = 8 * 60; // 08:00
  const endMinutes = isWeekend ? (18 * 60) : (20 * 60); // 18:00 ในวันหยุด, 20:00 ในวันธรรมดา

  if (timeInMinutes < startMinutes) {
    return {
      allowed: false,
      reason: `อยู่นอกเวลาที่กฎหมายอนุญาต (ก่อน 08:00 น.) ปัจจุบันเวลา ${now.format('HH:mm')} น.`,
      currentHour,
      dayOfWeek
    };
  }

  if (timeInMinutes >= endMinutes) {
    const limitStr = isWeekend ? '18:00' : '20:00';
    return {
      allowed: false,
      reason: `อยู่นอกเวลาที่กฎหมายอนุญาต (หลัง ${limitStr} น.) ปัจจุบันเวลา ${now.format('HH:mm')} น.`,
      currentHour,
      dayOfWeek
    };
  }

  return {
    allowed: true,
    reason: 'อยู่ในช่วงเวลาที่ได้รับอนุญาตตามกฎหมาย',
    currentHour,
    dayOfWeek
  };
}

/**
 * ตรวจสอบว่าเวลาไทยปัจจุบันตรงกับเวลาเป้าหมาย (HH:mm) หรือไม่
 * โดยให้ความยืดหยุ่นภายในช่วงเวลา ±windowMinutes (ค่าเริ่มต้น 20 นาที)
 * 
 * @param {string} targetTimeStr เวลาเป้าหมาย เช่น '08:30'
 * @param {number} [windowMinutes=20] กรอบเวลาที่ยอมรับได้ (นาที)
 * @param {dayjs.Dayjs} [refDate=null] ออบเจ็กต์ dayjs อ้างอิง (ค่าเริ่มต้นคือเวลาไทยปัจจุบัน)
 * @returns {{ matched: boolean, diffMinutes: number, targetSlot: string, currentBangkokTime: string }}
 */
function isCurrentTimeMatching(targetTimeStr, windowMinutes = 20, refDate = null) {
  if (!targetTimeStr || typeof targetTimeStr !== 'string' || !targetTimeStr.includes(':')) {
    return { matched: false, diffMinutes: 999, targetSlot: '', currentBangkokTime: '' };
  }

  const now = refDate ? refDate.tz(TIMEZONE) : getNowBangkok();
  const [targetHour, targetMin] = targetTimeStr.trim().split(':').map(n => parseInt(n, 10));

  if (isNaN(targetHour) || isNaN(targetMin)) {
    return { matched: false, diffMinutes: 999, targetSlot: targetTimeStr, currentBangkokTime: now.format('HH:mm') };
  }

  const currentMinutesTotal = now.hour() * 60 + now.minute();
  const targetMinutesTotal = targetHour * 60 + targetMin;
  const diffMinutes = Math.abs(currentMinutesTotal - targetMinutesTotal);

  const matched = diffMinutes <= windowMinutes;
  const formattedSlot = `${String(targetHour).padStart(2, '0')}:${String(targetMin).padStart(2, '0')}`;

  return {
    matched,
    diffMinutes,
    targetSlot: formattedSlot,
    currentBangkokTime: now.format('HH:mm')
  };
}

/**
 * ค้นหา Time Slot จากรายการเวลาหลายรอบ ที่ตรงกับเวลาไทยปัจจุบันมากที่สุด
 * รองรับทั้ง Array ['09:00', '13:30', '18:00'] และ String คั่นด้วยจุลภาค '09:00, 18:00'
 * 
 * @param {string[]|string} timeSlots รายการเวลา
 * @param {number} [windowMinutes=20] กรอบเวลา
 * @param {dayjs.Dayjs} [refDate=null] เวลาอ้างอิง
 * @returns {{ matched: boolean, matchedSlot: string|null, allSlots: string[] }}
 */
function findMatchingTimeSlot(timeSlots, windowMinutes = 20, refDate = null) {
  let slots = [];
  if (Array.isArray(timeSlots)) {
    slots = timeSlots.map(s => String(s || '').trim()).filter(Boolean);
  } else if (typeof timeSlots === 'string' && timeSlots.trim()) {
    slots = timeSlots.split(',').map(s => s.trim()).filter(Boolean);
  }

  if (slots.length === 0) {
    return { matched: false, matchedSlot: null, allSlots: [] };
  }

  for (const slot of slots) {
    const check = isCurrentTimeMatching(slot, windowMinutes, refDate);
    if (check.matched) {
      return {
        matched: true,
        matchedSlot: check.targetSlot,
        allSlots: slots
      };
    }
  }

  return { matched: false, matchedSlot: null, allSlots: slots };
}

/**
 * ตรวจสอบว่าวันปัจจุบัน (เวลาไทย) อยู่ในรายชื่อวันที่อนุญาตหรือไม่ (0=อาทิตย์, 1=จันทร์, ..., 6=เสาร์)
 */
function isDayOfWeekAllowed(allowedDays = [], refDate = null) {
  if (!Array.isArray(allowedDays) || allowedDays.length === 0) return true;
  const now = refDate ? refDate.tz(TIMEZONE) : getNowBangkok();
  const currentDay = now.day();
  return allowedDays.map(Number).includes(currentDay);
}

module.exports = {
  TIMEZONE,
  getNowBangkok,
  getTodayStringBangkok,
  getNowStringBangkok,
  normalizeDate,
  calculateNextDueDate,
  isLegalDebtCollectionTime,
  isCurrentTimeMatching,
  findMatchingTimeSlot,
  isDayOfWeekAllowed
};
