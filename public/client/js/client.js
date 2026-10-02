// Client Portal JavaScript Controller (Unified v3.5 - Real LINE Login Support)
let LIFF_ID = '2011816015-RfpKwHVZ';

async function resolveLiffId() {
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

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394A3B8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z'/></svg>";

let currentUser = {
  userId: 'U_GUEST',
  displayName: 'ผู้ใช้งานทั่วไป',
  pictureUrl: DEFAULT_AVATAR
};

let clientData = {
  debtor: null,
  activeDebt: null,
  payments: []
};

let currentSlipBase64 = null;

// Elements
const userAvatarEl = document.getElementById('userAvatar');
const userNameEl = document.getElementById('userName');
const clientStatusBadge = document.getElementById('clientStatusBadge');
const btnClientThemeToggle = document.getElementById('btnClientThemeToggle');

// Sub-views & Nav Items
const navItems = document.querySelectorAll('.nav-item');
const subViews = document.querySelectorAll('.sub-view');

// Dashboard Elements
const heroDebtId = document.getElementById('heroDebtId');
const heroRemaining = document.getElementById('heroRemaining');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const metricDueDate = document.getElementById('metricDueDate');
const metricInstallment = document.getElementById('metricInstallment');
const btnGoToPay = document.getElementById('btnGoToPay');
const loginNoticeBanner = document.getElementById('loginNoticeBanner');
const btnBannerLogin = document.getElementById('btnBannerLogin');

// Pay & Upload Elements
const btnCopyAcc = document.getElementById('btnCopyAcc');
const bankAccNo = document.getElementById('bankAccNo');
const slipAmountInput = document.getElementById('slipAmountInput');
const btnSubmitSlip = document.getElementById('btnSubmitSlip');
const dropzoneArea = document.getElementById('dropzoneArea');
const slipFileInput = document.getElementById('slipFileInput');
const previewContainer = document.getElementById('previewContainer');
const slipPreviewImg = document.getElementById('slipPreviewImg');
const btnRemovePreview = document.getElementById('btnRemovePreview');

// History Elements
const historyListContainer = document.getElementById('historyListContainer');
const historyCountBadge = document.getElementById('historyCountBadge');

// Profile Elements
const profileLoginStatus = document.getElementById('profileLoginStatus');
const profileUserId = document.getElementById('profileUserId');
const profileDisplayName = document.getElementById('profileDisplayName');
const profileFullName = document.getElementById('profileFullName');
const profilePhone = document.getElementById('profilePhone');
const profileIdCard = document.getElementById('profileIdCard');
const profileRegisteredAt = document.getElementById('profileRegisteredAt');
const btnCopyUserId = document.getElementById('btnCopyUserId');
const btnLoginLine = document.getElementById('btnLoginLine');
const btnLogoutLine = document.getElementById('btnLogoutLine');

// Toast
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

/**
 * 1. ควบคุมการสลับ Sub-views (Client-side Routing)
 */
function switchView(targetViewId) {
  subViews.forEach(view => {
    if (view.id === targetViewId) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  navItems.forEach(item => {
    if (item.getAttribute('data-target') === targetViewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const viewport = document.querySelector('.views-viewport');
  if (viewport) viewport.scrollTop = 0;
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const target = item.getAttribute('data-target');
    switchView(target);
  });
});

if (btnGoToPay) {
  btnGoToPay.addEventListener('click', () => {
    switchView('view-pay');
  });
}

/**
 * 2. คัดลอกเลขบัญชี
 */
if (btnCopyAcc) {
  btnCopyAcc.addEventListener('click', async () => {
    const text = bankAccNo.textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      showToast('คัดลอกเลขบัญชีแล้ว', '📋');
    } catch (e) {
      showToast('เลขบัญชี: ' + text, '📋');
    }
  });
}

/**
 * คัดลอก LINE User ID
 */
if (btnCopyUserId) {
  btnCopyUserId.addEventListener('click', async () => {
    if (currentUser.userId && currentUser.userId.startsWith('U')) {
      try {
        await navigator.clipboard.writeText(currentUser.userId);
        showToast('คัดลอก LINE User ID แล้ว', '📋');
      } catch (e) {
        showToast('LINE ID: ' + currentUser.userId, '📋');
      }
    } else {
      showToast('ยังไม่ได้เข้าสู่ระบบ LINE', '⚠️');
    }
  });
}

/**
 * 3. แสดง Toast Notification
 */
function showToast(msg, icon = 'ℹ️') {
  if (!toast) return;
  toastMessage.textContent = msg;
  toastIcon.textContent = icon;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

/**
 * 4. จัดการการเลือกรูปสลิปและบีบอัดภาพ
 */
if (dropzoneArea && slipFileInput) {
  dropzoneArea.addEventListener('click', () => {
    slipFileInput.click();
  });

  dropzoneArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzoneArea.classList.add('dragover');
  });

  dropzoneArea.addEventListener('dragleave', () => {
    dropzoneArea.classList.remove('dragover');
  });

  dropzoneArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzoneArea.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  slipFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });
}

if (btnRemovePreview) {
  btnRemovePreview.addEventListener('click', (e) => {
    e.stopPropagation();
    resetSlipUpload();
  });
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้นครับ', '⚠️');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    compressImage(event.target.result, 1280, 0.85, (compressedBase64) => {
      currentSlipBase64 = compressedBase64;
      if (slipPreviewImg) slipPreviewImg.src = compressedBase64;
      if (dropzoneArea) dropzoneArea.style.display = 'none';
      if (previewContainer) previewContainer.classList.add('show');
      if (btnSubmitSlip) btnSubmitSlip.disabled = false;
    });
  };
  reader.readAsDataURL(file);
}

function compressImage(srcBase64, maxWidth, quality, callback) {
  const img = new Image();
  img.src = srcBase64;
  img.onload = () => {
    let width = img.width;
    let height = img.height;

    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Prefer modern WebP (3x smaller payload), fallback to JPEG
    let compressed = canvas.toDataURL('image/webp', quality);
    if (!compressed.startsWith('data:image/webp')) {
      compressed = canvas.toDataURL('image/jpeg', quality);
    }
    callback(compressed);
  };
}

function resetSlipUpload() {
  currentSlipBase64 = null;
  if (slipFileInput) slipFileInput.value = '';
  if (slipPreviewImg) slipPreviewImg.src = '';
  if (previewContainer) previewContainer.classList.remove('show');
  if (dropzoneArea) dropzoneArea.style.display = 'block';
  if (btnSubmitSlip) btnSubmitSlip.disabled = true;
}

function getValidClientRedirectUri() {
  let redirectPath = window.location.pathname;
  if (!redirectPath.endsWith('/') && !redirectPath.includes('.')) {
    redirectPath += '/';
  }
  return window.location.origin + redirectPath;
}

/**
 * 5. ฟังก์ชัน Login / Logout ผ่าน LINE LIFF
 */
function handleLineLogin() {
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

function handleLineLogout() {
  if (liff.isLoggedIn()) {
    sessionStorage.removeItem('client_login_attempt');
    liff.logout();
    showToast('ออกจากระบบ LINE แล้ว', '👋');
    setTimeout(() => {
      // ใส่ ?guest=1 เพื่อไม่ให้ redirect ล็อกอินทันทีหลังกดออกจากระบบ
      window.location.href = getValidClientRedirectUri() + '?guest=1';
    }, 600);
  }
}

if (btnLoginLine) btnLoginLine.addEventListener('click', handleLineLogin);
if (btnLogoutLine) btnLogoutLine.addEventListener('click', handleLineLogout);
if (btnBannerLogin) btnBannerLogin.addEventListener('click', handleLineLogin);

/**
 * อัปเดตสถานะ UI การล็อกอิน
 */
function setLoginUiState(isLoggedIn) {
  if (isLoggedIn) {
    if (clientStatusBadge) {
      clientStatusBadge.textContent = '🟢 บัญชี LINE';
      clientStatusBadge.className = 'header-badge logged-in';
      clientStatusBadge.onclick = () => switchView('view-profile');
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

/**
 * 6. เริ่มต้น LIFF และดึงข้อมูล (พร้อมป้องกัน Infinite Redirect Loop)
 */
async function initApp() {
  try {
    await resolveLiffId();
    await liff.init({ liffId: LIFF_ID });

    const urlParams = new URLSearchParams(window.location.search);
    const isGuest = urlParams.get('guest') === '1';
    const hasError = urlParams.has('error');
    const hasCode = urlParams.has('code');

    // ตรวจสอบว่าเพิ่งพยายามล็อกอินไปเมื่อไม่กี่วินาทีนี้หรือไม่ เพื่อป้องกัน Infinite Redirect Loop
    const lastAttempt = sessionStorage.getItem('client_login_attempt');
    const isRecentAttempt = lastAttempt && (Date.now() - Number(lastAttempt) < 25000);

    if (liff.isLoggedIn()) {
      sessionStorage.removeItem('client_login_attempt');
      const profile = await liff.getProfile();
      currentUser = {
        userId: profile.userId,
        displayName: profile.displayName || 'ผู้ใช้งาน LINE',
        pictureUrl: profile.pictureUrl || DEFAULT_AVATAR
      };
      setLoginUiState(true);
    } else {
      if (isGuest || hasError || (hasCode && !liff.isLoggedIn()) || isRecentAttempt) {
        // หากผู้ใช้เลือกเข้าแบบ Guest, เกิดข้อผิดพลาดจาก LINE Login, หรือเพิ่ง Redirect กลับมาแต่ Login ไม่สำเร็จ
        // ให้อยู่ในโหมด Guest และแสดงปุ่ม Login เพื่อไม่ให้เกิดลูป Redirect วนไม่รู้จบ
        sessionStorage.removeItem('client_login_attempt');
        currentUser = {
          userId: 'U_DEMO_GUEST',
          displayName: 'ผู้ใช้งานทั่วไป (Guest)',
          pictureUrl: DEFAULT_AVATAR
        };
        setLoginUiState(false);
      } else {
        // หากเปิดบน HTTP Localhost ให้เปิดโหมดทดสอบ Local ทันที ไม่ redirect ไปติด 400 Bad Request
        if (window.location.protocol === 'http:' && !liff.isInClient()) {
          console.warn('Cannot auto-redirect to LINE Login on HTTP localhost. Using local client demo session.');
          currentUser = {
            userId: 'U16565ee5abb9acecbbaf08d123f06cd2',
            displayName: '😾POND-IT😸 (โหมดทดสอบ Local)',
            pictureUrl: DEFAULT_AVATAR
          };
          setLoginUiState(false);
        } else {
          // บังคับ Redirect ไปหน้า LINE Login เมื่ออยู่บน HTTPS / Production
          if (userNameEl) userNameEl.textContent = 'กำลังเข้าสู่ระบบ LINE...';
          if (clientStatusBadge) clientStatusBadge.textContent = '⏳ เข้าสู่ระบบ...';
          showToast('กำลังนำเข้าสู่ระบบ LINE...', '⏳');
          sessionStorage.setItem('client_login_attempt', Date.now().toString());
          liff.login({ redirectUri: getValidClientRedirectUri() });
          return;
        }
      }
    }
  } catch (err) {
    console.error('LIFF init error:', err);
    sessionStorage.removeItem('client_login_attempt');
    currentUser = {
      userId: 'U_DEMO_GUEST',
      displayName: 'โหมดออฟไลน์ (ทดสอบ)',
      pictureUrl: DEFAULT_AVATAR
    };
    setLoginUiState(false);
  }

  // อัปเดตข้อมูลบน Header
  if (userNameEl) userNameEl.textContent = currentUser.displayName;
  if (userAvatarEl && currentUser.pictureUrl) {
    userAvatarEl.src = currentUser.pictureUrl;
  }

  // ดึงข้อมูลลูกหนี้และสัญญาจากเซิร์ฟเวอร์
  await loadClientData();
}

/**
 * 7. ดึงข้อมูลจาก Backend API (Stale-While-Revalidate: Instant 0ms Load + Background Sync)
 */
async function loadClientData() {
  const cacheKey = `client_cache_${currentUser.userId}`;

  // 1. Instant Cache Render (0ms)
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        clientData = parsed;
        renderDashboard();
        renderHistory();
        renderProfile();
      }
    }
  } catch (cacheErr) {
    console.warn('Cache read notice:', cacheErr);
  }

  // 2. Background Revalidation from High-Speed Backend
  try {
    const url = `/api/client/profile/${encodeURIComponent(currentUser.userId)}?displayName=${encodeURIComponent(currentUser.displayName)}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.success && json.data) {
      clientData = json.data;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(clientData));
      } catch (saveErr) {}
      renderDashboard();
      renderHistory();
      renderProfile();
    }
  } catch (err) {
    console.error('Failed to load client data:', err);
    if (!clientData.activeDebt && !clientData.debtor) {
      showToast('ไม่สามารถดึงข้อมูลได้', '⚠️');
    }
  }
}

/**
 * 8. เรนเดอร์แดชบอร์ด
 */
function renderDashboard() {
  const debt = clientData.activeDebt;

  if (debt) {
    if (heroDebtId) heroDebtId.textContent = `สัญญาเลขที่: ${debt.debtId}`;
    if (heroRemaining) heroRemaining.textContent = `฿${Number(debt.remainingBalance).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    if (metricDueDate) metricDueDate.textContent = debt.dueDate || '-';
    if (metricInstallment) metricInstallment.textContent = `฿${Number(debt.installmentAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

    const total = Number(debt.totalAmount) || 0;
    const remaining = Number(debt.remainingBalance) || 0;
    const paid = Math.max(0, total - remaining);
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressPercent) progressPercent.textContent = `${pct}% (จ่ายแล้ว ฿${paid.toLocaleString()})`;

    if (clientStatusBadge && liff.isLoggedIn()) {
      clientStatusBadge.textContent = debt.debtStatus === 'ACTIVE' ? '🟢 สัญญาปกติ' : debt.debtStatus;
      clientStatusBadge.className = 'header-badge logged-in';
    }

    if (slipAmountInput) slipAmountInput.value = debt.installmentAmount || '';
  } else {
    if (heroDebtId) {
      heroDebtId.textContent = liff.isLoggedIn() ? 'ยังไม่มีสัญญาหนี้ที่เปิดอยู่' : 'โหมดทดสอบ (กรุณาล็อกอิน)';
    }
    if (heroRemaining) heroRemaining.textContent = '฿0.00';
    if (metricDueDate) metricDueDate.textContent = liff.isLoggedIn() ? 'ไม่มีหนี้ค้าง' : '-';
    if (metricInstallment) metricInstallment.textContent = '฿0.00';
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
  }
}

/**
 * 9. เรนเดอร์ประวัติการชำระเงิน (Next-Gen Minimalist Cards)
 */
function renderHistory() {
  const payments = clientData.payments || [];
  if (historyCountBadge) historyCountBadge.textContent = `${payments.length} รายการ`;

  if (!historyListContainer) return;

  if (payments.length === 0) {
    historyListContainer.innerHTML = `
      <div class="state-box">
        <div style="font-size: 32px; opacity: 0.8;">📭</div>
        <div style="color: var(--text-dim);">ยังไม่มีประวัติการส่งสลิปชำระเงิน</div>
      </div>
    `;
    return;
  }

  historyListContainer.innerHTML = payments.map(p => {
    const status = (p.verificationStatus || 'PENDING').toUpperCase();
    let statusText = 'รอตรวจสอบ';
    if (status === 'VERIFIED') statusText = 'อนุมัติแล้ว';
    if (status === 'REJECTED') statusText = 'ไม่ผ่าน';

    return `
      <div class="history-card">
        <div class="history-card-left">
          <span class="history-amount">฿${Number(p.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
          <span class="history-card-date">📅 ${p.uploadedAt || '-'}</span>
          <span class="history-card-id">${p.paymentId}</span>
        </div>
        <div class="history-card-right">
          <span class="history-badge ${status}">${statusText}</span>
          ${status === 'VERIFIED' ? `<a href="/receipt/${p.paymentId}" target="_blank" style="font-size: 11px; background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; padding: 3px 8px; border-radius: 5px; text-decoration: none; margin-top: 5px; display: inline-flex; align-items: center; gap: 3px; font-weight: 600;">📄 ใบเสร็จ (e-Receipt)</a>` : ''}
          ${p.slipViewUrl ? `<a href="${p.slipViewUrl}" target="_blank" style="font-size: 11px; color: var(--primary); text-decoration: none; margin-top: 4px; display: inline-flex; align-items: center; gap: 3px;">🔍 ดูสลิป</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 10. เรนเดอร์หน้าโปรไฟล์
 */
function renderProfile() {
  const debtor = clientData.debtor;
  if (profileUserId) profileUserId.textContent = currentUser.userId || '-';
  if (profileDisplayName) profileDisplayName.textContent = currentUser.displayName || '-';
  if (profileFullName) profileFullName.textContent = debtor?.fullName || currentUser.displayName || '-';
  if (profilePhone) profilePhone.textContent = debtor?.phone || '-';
  if (profileIdCard) profileIdCard.textContent = debtor?.idCardNumber || '-';
  if (profileRegisteredAt) profileRegisteredAt.textContent = debtor?.registeredAt || '-';
}

/**
 * 11. ส่งสลิปชำระเงิน
 */
if (btnSubmitSlip) {
  btnSubmitSlip.addEventListener('click', async () => {
    if (!currentSlipBase64) {
      showToast('กรุณาเลือกไฟล์สลิปก่อนครับ', '⚠️');
      return;
    }

    btnSubmitSlip.disabled = true;
    btnSubmitSlip.innerHTML = '<span>⏳ กำลังอัปโหลด...</span>';

    const payload = {
      userId: currentUser.userId,
      debtId: clientData.activeDebt?.debtId || '',
      amount: slipAmountInput ? slipAmountInput.value : 0,
      imageBase64: currentSlipBase64
    };

    try {
      const res = await fetch('/api/client/upload-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        showToast('ส่งสลิปชำระเงินเรียบร้อยแล้ว!', '✅');
        try {
          localStorage.removeItem(`client_cache_${currentUser.userId}`);
        } catch (e) {}
        resetSlipUpload();
        await loadClientData();
        switchView('view-history');
      } else {
        showToast(json.message || 'ส่งสลิปไม่สำเร็จ', '❌');
      }
    } catch (err) {
      console.error('Error submitting slip:', err);
      showToast('เกิดข้อผิดพลาดในการส่งสลิป', '❌');
    } finally {
      btnSubmitSlip.disabled = false;
      btnSubmitSlip.innerHTML = '<span>🚀 ส่งสลิปชำระเงิน</span>';
    }
  });
}

/**
 * 12. Theme Management (Light / Dark)
 */
function initClientTheme() {
  const savedTheme = localStorage.getItem('admin_theme') || 'light';
  applyClientTheme(savedTheme);

  if (btnClientThemeToggle) {
    btnClientThemeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyClientTheme(newTheme);
      showToast(`เปลี่ยนธีมเป็น: ${newTheme === 'dark' ? 'โหมดมืด (Dark)' : 'โหมดสว่าง (Light)'}`, '🎨');
    });
  }
}

function applyClientTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('admin_theme', theme);

  if (btnClientThemeToggle) {
    btnClientThemeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
}

// เริ่มต้นระบบ
window.addEventListener('DOMContentLoaded', () => {
  initClientTheme();
  initApp();
});
