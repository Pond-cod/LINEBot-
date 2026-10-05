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

/**
 * ตรวจสอบความถูกต้องของ LINE ID Token ผ่าน LINE OAuth2 Verify API
 */
async function verifyLineIdToken(idToken, expectedUserId = null) {
  if (!idToken || typeof idToken !== 'string') return { valid: false, reason: 'Missing token' };
  try {
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID || (process.env.LIFF_ID || '').split('-')[0];
    const params = new URLSearchParams();
    params.append('id_token', idToken);
    if (channelId) params.append('client_id', channelId);

    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!res.ok) return { valid: false, reason: 'LINE verify rejected' };
    const data = await res.json();
    if (expectedUserId && data.sub !== expectedUserId) {
      return { valid: false, reason: 'User ID mismatch' };
    }
    return { valid: true, userId: data.sub, profile: data };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

async function requireAdminAuth(req, res, next) {
  try {
    const adminKey = process.env.ADMIN_API_KEY;
    const providedKey = req.headers['x-admin-key'] || (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7) : null);

    // 1. ตรวจสอบผ่าน ADMIN_API_KEY (ถ้ามีการตั้งค่าไว้ใน .env)
    if (adminKey && providedKey === adminKey) {
      return next();
    }

    let userId = req.headers['x-line-userid'] || req.query.adminUserId || req.body?.adminUserId;
    const authHeader = req.headers['authorization'];
    const idToken = req.headers['x-line-id-token'] || (authHeader?.startsWith('Bearer ') && authHeader.slice(7) !== adminKey ? authHeader.slice(7) : null);

    // 2. หากมี ID Token ส่งมา ให้ตรวจสอบความถูกต้องกับ LINE Platform
    if (idToken) {
      const verifyResult = await verifyLineIdToken(idToken, userId);
      if (verifyResult.valid) {
        userId = verifyResult.userId;
      }
    }

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
