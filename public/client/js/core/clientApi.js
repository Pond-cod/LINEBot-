/**
 * Client Portal API Service
 * Handles network requests, error capturing, and user toast notifications
 */

export const CLIENT_LIFF_ID = '2011816015-RfpKwHVZ';

export function getClientLiffId() {
  if (typeof window !== 'undefined' && window.ENV_LIFF_ID && typeof window.ENV_LIFF_ID === 'string' && window.ENV_LIFF_ID.trim()) {
    return window.ENV_LIFF_ID.trim();
  }
  return CLIENT_LIFF_ID;
}

export async function resolveLiffId() {
  let liffId = getClientLiffId();
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.liffId === 'string' && data.liffId.trim() !== '') {
        liffId = data.liffId.trim();
      }
    }
  } catch (e) {
    console.warn('Using default LIFF ID fallback:', e.message);
  }
  return liffId || CLIENT_LIFF_ID;
}

export async function fetchClientProfileApi(userId, displayName) {
  const url = `/api/client/profile/${encodeURIComponent(userId)}?displayName=${encodeURIComponent(displayName || '')}&_t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`HTTP Error ${res.status}`);
  }
  return await res.json();
}

export async function uploadSlipApi(payload) {
  const res = await fetch('/api/client/upload-slip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

/**
 * Toast Notification Helper
 */
export function showToast(msg, icon = 'ℹ️') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  if (!toast || !toastMessage) return;

  toastMessage.textContent = msg;
  if (toastIcon) toastIcon.textContent = icon;
  
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}
