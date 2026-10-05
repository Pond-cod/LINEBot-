/**
 * Admin API Client & Core Utilities
 * Handles authenticated API requests, safe JSON parsing, error toasts, and formatting.
 */

let currentAdminUser = null;

export function setCurrentAdminUser(user) {
  currentAdminUser = user;
}

export function getCurrentAdminUser() {
  return currentAdminUser;
}

export function showToast(msg, icon = 'ℹ️') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  if (!toast || !toastMessage || !toastIcon) return;
  toastMessage.textContent = msg;
  toastIcon.textContent = icon;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

export function formatMoney(num) {
  if (isNaN(num)) return '฿0.00';
  return '฿' + Number(num).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function adminFetch(url, options = {}) {
  const headers = options.headers || {};
  if (currentAdminUser && currentAdminUser.userId) {
    headers['x-line-userid'] = currentAdminUser.userId;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 403) {
    showToast('ไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้ (403 Forbidden)', '⛔');
    const adminAuthOverlay = document.getElementById('adminAuthOverlay');
    if (adminAuthOverlay) {
      adminAuthOverlay.classList.remove('hidden');
    }
  }

  // ป้องกันการ throw Unexpected token เมื่อเซิร์ฟเวอร์คืน HTML หรือ Plain text Error
  const originalText = res.text.bind(res);
  let cachedText = null;

  res.text = async () => {
    if (cachedText === null) {
      cachedText = await originalText();
    }
    return cachedText;
  };

  res.json = async () => {
    const raw = await res.text();
    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      console.error(`Server returned non-JSON response from ${url}:`, raw);
      if (res.status >= 500) {
        throw new Error(`เซิร์ฟเวอร์ทำงานผิดพลาด (${res.status}): ${raw.slice(0, 120)}`);
      }
      throw new Error(`รูปแบบข้อมูลไม่ถูกต้อง (${res.status})`);
    }
  };

  return res;
}
