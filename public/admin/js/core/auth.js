/**
 * Admin Authentication & Access Control Core
 * Manages LIFF SDK authentication, local session persistence, admin verification, and overlay state.
 */

import { adminFetch, setCurrentAdminUser, showToast } from './api.js';

let isUserAuthorized = false;

export function getIsUserAuthorized() {
  return isUserAuthorized;
}

export async function initAdminAuth() {
  // 1. ตรวจสอบ Local Session ก่อน
  const savedSession = localStorage.getItem('debt_admin_session');
  if (savedSession) {
    try {
      const parsed = JSON.parse(savedSession);
      if (parsed && parsed.userId) {
        setCurrentAdminUser(parsed);
        const verifyRes = await adminFetch(`/api/admin/verify-access?userId=${parsed.userId}`);
        const verifyData = await verifyRes.json();

        if (verifyData.authorized) {
          isUserAuthorized = true;
          hideAuthOverlay();
          updateAdminProfileUI(parsed);
          return true;
        }
      }
    } catch (e) {
      console.warn('Session parse error:', e);
    }
  }

async function resolveAdminLiffId() {
  if (typeof window !== 'undefined' && window.ENV_LIFF_ID && typeof window.ENV_LIFF_ID === 'string' && window.ENV_LIFF_ID.trim()) {
    return window.ENV_LIFF_ID.trim();
  }
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.liffId === 'string' && data.liffId.trim() !== '') {
        return data.liffId.trim();
      }
    }
  } catch (e) {
    console.warn('Could not fetch liffId from /api/config:', e.message);
  }
  return '2011816015-RfpKwHVZ';
}

  // 2. เริ่มต้น LIFF SDK
  try {
    if (typeof liff !== 'undefined') {
      const liffId = await resolveAdminLiffId();
      await liff.init({ liffId });

      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        const user = {
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl
        };
        setCurrentAdminUser(user);

        const verifyRes = await adminFetch(`/api/admin/verify-access?userId=${user.userId}`);
        const verifyData = await verifyRes.json();

        if (verifyData.authorized) {
          isUserAuthorized = true;
          localStorage.setItem('debt_admin_session', JSON.stringify(user));
          hideAuthOverlay();
          updateAdminProfileUI(user);
          return true;
        } else {
          showDeniedState(user);
          return false;
        }
      } else {
        showLoginState();
        return false;
      }
    }
  } catch (err) {
    console.warn('LIFF init notice:', err.message);
  }

  showLoginState();
  return false;
}

export function hideAuthOverlay() {
  const overlay = document.getElementById('adminAuthOverlay');
  if (overlay) overlay.classList.add('hidden');
}

export function showDeniedState(user) {
  const overlay = document.getElementById('adminAuthOverlay');
  const deniedCard = document.getElementById('authDeniedCard');
  const loginCard = document.getElementById('authLoginCard');
  const deniedName = document.getElementById('deniedDisplayName');
  const deniedId = document.getElementById('deniedUserId');

  if (overlay) overlay.classList.remove('hidden');
  if (deniedCard) deniedCard.classList.remove('hidden');
  if (loginCard) loginCard.classList.add('hidden');
  if (deniedName) deniedName.textContent = user.displayName || 'ไม่ทราบชื่อ';
  if (deniedId) deniedId.textContent = user.userId || '-';
}

export function showLoginState() {
  const overlay = document.getElementById('adminAuthOverlay');
  const deniedCard = document.getElementById('authDeniedCard');
  const loginCard = document.getElementById('authLoginCard');

  if (overlay) overlay.classList.remove('hidden');
  if (deniedCard) deniedCard.classList.add('hidden');
  if (loginCard) loginCard.classList.remove('hidden');
}

export function updateAdminProfileUI(user) {
  const avatarEl = document.getElementById('topbarAdminAvatar');
  const nameEl = document.getElementById('topbarAdminName');
  const sidebarAvatar = document.getElementById('sidebarAdminAvatar');
  const sidebarName = document.getElementById('sidebarAdminName');
  const sidebarRole = document.getElementById('sidebarAdminRole');

  if (avatarEl && user.pictureUrl) {
    avatarEl.innerHTML = `<img src="${user.pictureUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
  }
  if (sidebarAvatar && user.pictureUrl) {
    sidebarAvatar.innerHTML = `<img src="${user.pictureUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
  }
  if (nameEl) nameEl.textContent = user.displayName || 'Admin';
  if (sidebarName) sidebarName.textContent = user.displayName || 'Admin';
  if (sidebarRole) sidebarRole.textContent = 'ผู้ดูแลระบบ';
}

export function logout() {
  localStorage.removeItem('debt_admin_session');
  try {
    if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
      liff.logout();
    }
  } catch (e) {}
  window.location.reload();
}

window.logoutAdmin = logout;
