/**
 * Client Portal API Service
 * Handles network requests, error capturing, and user toast notifications
 */

let LIFF_ID = '2011816015-RfpKwHVZ';

export async function resolveLiffId() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data && data.liffId) {
      LIFF_ID = data.liffId;
    }
  } catch (e) {
    console.warn('Using default LIFF ID fallback:', e.message);
  }
  return LIFF_ID;
}

export function getLiffId() {
  return LIFF_ID;
}

export async function fetchClientProfileApi(userId, displayName) {
  const url = `/api/client/profile/${encodeURIComponent(userId)}?displayName=${encodeURIComponent(displayName || '')}`;
  const res = await fetch(url);
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
