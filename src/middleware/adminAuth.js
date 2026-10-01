/**
 * Middleware สำหรับตรวจสอบสิทธิ์การเข้าใช้งาน Admin Portal
 * รองรับทั้งจาก Environment Variables (ADMIN_LINE_USER_IDS)
 * และจาก Google Sheets (ชีต 'admin') แบบ Real-time
 */

const sheetsService = require('../services/sheetsService');

let cachedSheetAdminIds = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 20000; // 20 วินาที

function getEnvAdminUserIds() {
  const raw = process.env.ADMIN_LINE_USER_IDS || '';
  return raw
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
}

function invalidateAdminCache() {
  cachedSheetAdminIds = null;
  lastCacheTime = 0;
}

async function getAdminUserIds() {
  const envAdmins = getEnvAdminUserIds();
  const now = Date.now();

  if (cachedSheetAdminIds !== null && (now - lastCacheTime < CACHE_TTL_MS)) {
    return Array.from(new Set([...envAdmins, ...cachedSheetAdminIds]));
  }

  try {
    const sheetAdmins = await sheetsService.getAllAdmins();
    const activeIds = (sheetAdmins || [])
      .filter(a => a.status === 'ACTIVE' && a.userId)
      .map(a => a.userId);

    cachedSheetAdminIds = activeIds;
    lastCacheTime = now;
    return Array.from(new Set([...envAdmins, ...activeIds]));
  } catch (err) {
    console.warn('Unable to load sheet admins for auth check:', err.message);
    return envAdmins;
  }
}

async function isUserAdmin(userId) {
  const adminIds = await getAdminUserIds();
  const isConfigured = adminIds.length > 0;
  if (!isConfigured) {
    return { authorized: false, isConfigured: false, adminCount: 0 };
  }
  if (!userId) {
    return { authorized: false, isConfigured: true, adminCount: adminIds.length };
  }
  return { authorized: adminIds.includes(userId), isConfigured: true, adminCount: adminIds.length };
}

async function requireAdminAuth(req, res, next) {
  try {
    const userId = req.headers['x-line-userid'] || req.query.adminUserId || req.body?.adminUserId;
    const adminIds = await getAdminUserIds();

    // บล็อกเด็ดขาด หากไม่มีแอดมินในระบบ หรือ userId ไม่อยู่ในรายชื่อแอดมินที่ได้รับอนุญาต
    if (adminIds.length === 0 || !userId || !adminIds.includes(userId)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: adminIds.length === 0
          ? 'ปฏิเสธการเข้าถึง: ยังไม่มีข้อมูลผู้ดูแลระบบในชีต admin (Google Sheet)'
          : 'ปฏิเสธการเข้าถึง: บัญชี LINE นี้ไม่มีสิทธิ์เข้าถึงฟังก์ชันผู้ดูแลระบบ (Admin Hub)'
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAdminUserIds,
  invalidateAdminCache,
  isUserAdmin,
  requireAdminAuth
};
