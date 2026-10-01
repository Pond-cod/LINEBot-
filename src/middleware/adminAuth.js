/**
 * Middleware สำหรับตรวจสอบสิทธิ์การเข้าใช้งาน Admin Portal
 * ผูกสิทธิ์กับ LINE User ID ของผู้ดูแลระบบ
 */

function getAdminUserIds() {
  const raw = process.env.ADMIN_LINE_USER_IDS || '';
  return raw
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
}

function isUserAdmin(userId) {
  const adminIds = getAdminUserIds();
  const isConfigured = adminIds.length > 0;
  if (!isConfigured) {
    return { authorized: false, isConfigured: false };
  }
  if (!userId) {
    return { authorized: false, isConfigured: true };
  }
  return { authorized: adminIds.includes(userId), isConfigured: true };
}

function requireAdminAuth(req, res, next) {
  const userId = req.headers['x-line-userid'] || req.query.adminUserId || req.body?.adminUserId;
  const adminIds = getAdminUserIds();

  // หากมีการตั้งค่ารายชื่อแอดมินไว้แล้ว
  if (adminIds.length > 0) {
    if (!userId || !adminIds.includes(userId)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'ปฏิเสธการเข้าถึง: บัญชี LINE นี้ไม่มีสิทธิ์เข้าถึงฟังก์ชันผู้ดูแลระบบ (Admin Hub)'
      });
    }
  }

  next();
}

module.exports = {
  getAdminUserIds,
  isUserAdmin,
  requireAdminAuth
};
