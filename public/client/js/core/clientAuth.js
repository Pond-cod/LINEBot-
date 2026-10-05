/**
 * Client Portal LIFF & LINE Login Authentication Service
 * Features Infinite Redirect Loop Guard, Localhost Dev Fallback, and Resilient Init
 */

import { resolveLiffId, CLIENT_LIFF_ID, showToast } from './clientApi.js';
import { store, DEFAULT_AVATAR } from './clientState.js';

export function getValidClientRedirectUri() {
  let redirectPath = window.location.pathname;
  if (!redirectPath.endsWith('/') && !redirectPath.includes('.')) {
    redirectPath += '/';
  }
  return window.location.origin + redirectPath;
}

export function handleLineLogin() {
  if (typeof liff === 'undefined') {
    alert('LIFF SDK กำลังโหลด กรุณารอสักครู่ครับ');
    return;
  }

  if (!liff.isLoggedIn()) {
    if (window.location.protocol === 'http:') {
      alert('⚠️ LINE Login ไม่อนุญาตให้ใช้งานผ่าน http://localhost ได้โดยตรงตามข้อกำหนดของ LINE\n\n👉 ระบบเปิดหน้าต่างพรีวิวและฟังก์ชันส่งสลิปให้ทดสอบได้ทันที\n🌐 หากต้องการทดสอบระบบ LINE Login จริง ให้เปิดผ่าน HTTPS ด้วย Ngrok หรือ Vercel');
      return;
    }
    showToast('กำลังนำไปสู่หน้า LINE Login...', '⏳');
    sessionStorage.setItem('client_login_attempt', Date.now().toString());
    liff.login({ redirectUri: getValidClientRedirectUri() });
  }
}

export function handleLineLogout() {
  if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
    sessionStorage.removeItem('client_login_attempt');
    liff.logout();
    showToast('ออกจากระบบ LINE แล้ว', '👋');
    setTimeout(() => {
      window.location.href = getValidClientRedirectUri() + '?guest=1';
    }, 600);
  }
}

export function setLoginUiState(isLoggedIn) {
  const clientStatusBadge = document.getElementById('clientStatusBadge');
  const loginNoticeBanner = document.getElementById('loginNoticeBanner');
  const btnLoginLine = document.getElementById('btnLoginLine');
  const btnLogoutLine = document.getElementById('btnLogoutLine');
  const profileLoginStatus = document.getElementById('profileLoginStatus');

  if (isLoggedIn) {
    if (clientStatusBadge) {
      clientStatusBadge.textContent = '🟢 บัญชี LINE';
      clientStatusBadge.className = 'header-badge logged-in';
      clientStatusBadge.onclick = () => {
        window.location.hash = '#/profile';
      };
    }
    if (loginNoticeBanner) loginNoticeBanner.style.display = 'none';
    if (btnLoginLine) btnLoginLine.style.display = 'none';
    if (btnLogoutLine) btnLogoutLine.style.display = 'block';
    if (profileLoginStatus) {
      profileLoginStatus.textContent = 'เชื่อมต่อ LINE แล้ว';
      profileLoginStatus.style.color = '#06C755';
    }
  } else {
    if (clientStatusBadge) {
      clientStatusBadge.textContent = '💬 เข้าสู่ระบบ LINE';
      clientStatusBadge.className = 'header-badge login-btn';
      clientStatusBadge.onclick = handleLineLogin;
    }
    if (loginNoticeBanner) {
      loginNoticeBanner.style.display = 'flex';
      loginNoticeBanner.onclick = handleLineLogin;
    }
    if (btnLoginLine) {
      btnLoginLine.style.display = 'flex';
      btnLoginLine.onclick = handleLineLogin;
    }
    if (btnLogoutLine) btnLogoutLine.style.display = 'none';
    if (profileLoginStatus) {
      profileLoginStatus.textContent = 'ยังไม่ได้เข้าสู่ระบบ';
      profileLoginStatus.style.color = '#F59E0B';
    }
  }
}

export async function initLiffAuth() {
  const userNameEl = document.getElementById('userName');
  const userAvatarEl = document.getElementById('userAvatar');
  const clientStatusBadge = document.getElementById('clientStatusBadge');

  if (typeof liff === 'undefined') {
    console.warn('LINE LIFF SDK is not loaded. Operating in guest mode.');
    store.setCurrentUser({
      userId: 'U_DEMO_GUEST',
      displayName: 'ผู้ใช้งานทั่วไป (Guest)',
      pictureUrl: DEFAULT_AVATAR
    });
    setLoginUiState(false);
    return true;
  }

  let liffId = CLIENT_LIFF_ID;
  try {
    const resolved = await resolveLiffId();
    if (resolved && typeof resolved === 'string' && resolved.trim()) {
      liffId = resolved.trim();
    }
  } catch (e) {
    liffId = CLIENT_LIFF_ID;
  }

  if (!liffId || typeof liffId !== 'string' || liffId.trim() === '') {
    liffId = CLIENT_LIFF_ID;
  }

  try {
    await liff.init({ liffId });

    const urlParams = new URLSearchParams(window.location.search);
    const isGuest = urlParams.get('guest') === '1';
    const hasError = urlParams.has('error');
    const hasCode = urlParams.has('code');

    const lastAttempt = sessionStorage.getItem('client_login_attempt');
    const isRecentAttempt = lastAttempt && (Date.now() - Number(lastAttempt) < 25000);

    if (liff.isLoggedIn()) {
      sessionStorage.removeItem('client_login_attempt');
      const profile = await liff.getProfile();
      store.setCurrentUser({
        userId: profile.userId,
        displayName: profile.displayName || 'ผู้ใช้งาน LINE',
        pictureUrl: profile.pictureUrl || DEFAULT_AVATAR
      });
      setLoginUiState(true);
    } else {
      if (isGuest || hasError || (hasCode && !liff.isLoggedIn()) || isRecentAttempt) {
        sessionStorage.removeItem('client_login_attempt');
        store.setCurrentUser({
          userId: 'U_DEMO_GUEST',
          displayName: 'ผู้ใช้งานทั่วไป (Guest)',
          pictureUrl: DEFAULT_AVATAR
        });
        setLoginUiState(false);
      } else {
        if (window.location.protocol === 'http:' && !liff.isInClient()) {
          console.warn('Cannot auto-redirect to LINE Login on HTTP localhost. Using local client demo session.');
          store.setCurrentUser({
            userId: 'U_DEMO_CLIENT',
            displayName: 'ผู้ใช้งานทดสอบ (โหมด Local)',
            pictureUrl: DEFAULT_AVATAR
          });
          setLoginUiState(false);
        } else {
          // Redirect to LINE Login on HTTPS
          if (userNameEl) userNameEl.textContent = 'กำลังเข้าสู่ระบบ LINE...';
          if (clientStatusBadge) clientStatusBadge.textContent = '⏳ เข้าสู่ระบบ...';
          showToast('กำลังนำเข้าสู่ระบบ LINE...', '⏳');
          sessionStorage.setItem('client_login_attempt', Date.now().toString());
          liff.login({ redirectUri: getValidClientRedirectUri() });
          return false;
        }
      }
    }
  } catch (err) {
    console.warn('LIFF init caught warning (falling back to guest mode):', err);
    sessionStorage.removeItem('client_login_attempt');
    store.setCurrentUser({
      userId: 'U_DEMO_GUEST',
      displayName: 'ผู้ใช้งานทั่วไป (Guest)',
      pictureUrl: DEFAULT_AVATAR
    });
    setLoginUiState(false);
  }

  // Update Header UI
  if (userNameEl) userNameEl.textContent = store.currentUser.displayName;
  if (userAvatarEl && store.currentUser.pictureUrl) {
    userAvatarEl.src = store.currentUser.pictureUrl;
  }

  // Bind auth buttons
  const btnLoginLine = document.getElementById('btnLoginLine');
  const btnLogoutLine = document.getElementById('btnLogoutLine');
  const btnBannerLogin = document.getElementById('btnBannerLogin');

  if (btnLoginLine) btnLoginLine.onclick = handleLineLogin;
  if (btnLogoutLine) btnLogoutLine.onclick = handleLineLogout;
  if (btnBannerLogin) btnBannerLogin.onclick = handleLineLogin;

  return true;
}
