/**
 * Admin Portal Controller (PC Dashboard & Automation Engine)
 * Fully supports Desktop PC layout, New Contract Wizard, and Flexible Reminder Engine
 */

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

let currentAdminUser = null;
let allContracts = [];
let allDebtors = [];
let allSlips = [];
let allAdminsList = [];
let allReminderProfiles = [];
let selectedMonthlyDays = [];
let selectedModalDays = [];

// ==============================================================================
// 1. DOM Elements
// ==============================================================================
// Auth Overlay
const adminAuthOverlay = document.getElementById('adminAuthOverlay');
const authCheckingState = document.getElementById('authCheckingState');
const authLoginState = document.getElementById('authLoginState');
const authDeniedState = document.getElementById('authDeniedState');
const btnAdminLoginLine = document.getElementById('btnAdminLoginLine');
const btnLocalAdminLogin = document.getElementById('btnLocalAdminLogin');
const inputLocalAdminUserId = document.getElementById('inputLocalAdminUserId');
const btnQuickAdminLogin = document.getElementById('btnQuickAdminLogin');
const btnSwitchAccount = document.getElementById('btnSwitchAccount');
const deniedDisplayName = document.getElementById('deniedDisplayName');
const deniedUserId = document.getElementById('deniedUserId');

// Sidebar & Topbar
const adminSidebar = document.getElementById('adminSidebar');
const btnToggleSidebar = document.getElementById('btnToggleSidebar');
const topbarCurrentViewTitle = document.getElementById('topbarCurrentViewTitle');
const sidebarAdminName = document.getElementById('sidebarAdminName');
const sidebarAdminId = document.getElementById('sidebarAdminId');
const sidebarAvatar = document.getElementById('sidebarAvatar');
const btnAdminLogout = document.getElementById('btnAdminLogout');
const sidebarNavItems = document.querySelectorAll('.sidebar-nav-item');
const subViews = document.querySelectorAll('.sub-view');
const sidebarContractsBadge = document.getElementById('sidebarContractsBadge');
const sidebarSlipsBadge = document.getElementById('sidebarSlipsBadge');
const btnThemeToggle = document.getElementById('btnThemeToggle');
const themeToggleIcon = document.getElementById('themeToggleIcon');
const themeToggleText = document.getElementById('themeToggleText');

// Toast
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// Stats Elements
const statRemaining = document.getElementById('statRemaining');
const statPendingSlips = document.getElementById('statPendingSlips');
const statDueToday = document.getElementById('statDueToday');
const statTotalContracts = document.getElementById('statTotalContracts');
const statTotalDebtors = document.getElementById('statTotalDebtors');
const btnTriggerCronNow = document.getElementById('btnTriggerCronNow');
const btnTopTriggerCron = document.getElementById('btnTopTriggerCron');

// New Contract Wizard Elements
const createContractWizardForm = document.getElementById('createContractWizardForm');
const wizardDebtorSelect = document.getElementById('wizardDebtorSelect');
const wizardUserId = document.getElementById('wizardUserId');
const wizardDebtorName = document.getElementById('wizardDebtorName');
const wizardPhone = document.getElementById('wizardPhone');
const wizardIdCard = document.getElementById('wizardIdCard');
const wizardTotalAmount = document.getElementById('wizardTotalAmount');
const wizardInstallmentCount = document.getElementById('wizardInstallmentCount');
const wizardInstallmentAmount = document.getElementById('wizardInstallmentAmount');
const wizardCycleDays = document.getElementById('wizardCycleDays');
const wizardDueDate = document.getElementById('wizardDueDate');
const wizardSendPushCheck = document.getElementById('wizardSendPushCheck');
const btnSubmitWizardContract = document.getElementById('btnSubmitWizardContract');
const btnResetWizardForm = document.getElementById('btnResetWizardForm');

// Preview Elements
const prevTotalAmount = document.getElementById('prevTotalAmount');
const prevDebtorName = document.getElementById('prevDebtorName');
const prevInstallment = document.getElementById('prevInstallment');
const prevDueDate = document.getElementById('prevDueDate');
const prevCycle = document.getElementById('prevCycle');
const prevSendPush = document.getElementById('prevSendPush');

// Contracts Elements
const contractsTableBody = document.getElementById('contractsTableBody');
const contractSearchInput = document.getElementById('contractSearchInput');
const contractFilterStatus = document.getElementById('contractFilterStatus');
const btnRefreshContracts = document.getElementById('btnRefreshContracts');

// Slips Elements
const slipsContainer = document.getElementById('slipsContainer');
const btnRefreshSlips = document.getElementById('btnRefreshSlips');

// Debtors Elements
const debtorsTableBody = document.getElementById('debtorsTableBody');
const debtorSearchInput = document.getElementById('debtorSearchInput');

// Reminders Elements
const cfgEnabled = document.getElementById('cfgEnabled');
const cfgScheduleMode = document.getElementById('cfgScheduleMode');
const cfgMonthlyEnabled = document.getElementById('cfgMonthlyEnabled');
const monthlyDaysGrid = document.getElementById('monthlyDaysGrid');
const cfgMonthlyLastDay = document.getElementById('cfgMonthlyLastDay');
const cfgPrimaryTime = document.getElementById('cfgPrimaryTime');
const cfgSecondaryEnabled = document.getElementById('cfgSecondaryEnabled');
const cfgSecondaryTime = document.getElementById('cfgSecondaryTime');
const cfgRemindBeforeEnabled = document.getElementById('cfgRemindBeforeEnabled');
const cfgRemindBeforeDays = document.getElementById('cfgRemindBeforeDays');
const cfgRemindDueTodayEnabled = document.getElementById('cfgRemindDueTodayEnabled');
const cfgRemindOverdueEnabled = document.getElementById('cfgRemindOverdueEnabled');
const cfgOverdueFrequency = document.getElementById('cfgOverdueFrequency');
const cfgTone = document.getElementById('cfgTone');
const cfgCustomHeader = document.getElementById('cfgCustomHeader');
const cfgBankName = document.getElementById('cfgBankName');
const cfgAccountNumber = document.getElementById('cfgAccountNumber');
const cfgAccountName = document.getElementById('cfgAccountName');
const cfgPromptPay = document.getElementById('cfgPromptPay');
const cfgCustomFooter = document.getElementById('cfgCustomFooter');
const cfgNotifyAdmin = document.getElementById('cfgNotifyAdmin');
const btnSaveReminderSettings = document.getElementById('btnSaveReminderSettings');
const btnSaveReminderSettingsTop = document.getElementById('btnSaveReminderSettingsTop');
const btnTestPushToAdmin = document.getElementById('btnTestPushToAdmin');
const btnRefreshLogs = document.getElementById('btnRefreshLogs');
const reminderLogsContainer = document.getElementById('reminderLogsContainer');

// Admins Management Elements
const adminsTableBody = document.getElementById('adminsTableBody');
const adminSearchInput = document.getElementById('adminSearchInput');
const btnOpenAddAdminModal = document.getElementById('btnOpenAddAdminModal');
const modalAdminForm = document.getElementById('modalAdminForm');
const btnCloseAdminModal = document.getElementById('btnCloseAdminModal');
const btnCancelAdminModal = document.getElementById('btnCancelAdminModal');
const adminManagerForm = document.getElementById('adminManagerForm');
const adminFormMode = document.getElementById('adminFormMode');
const adminInputUserId = document.getElementById('adminInputUserId');
const adminInputDisplayName = document.getElementById('adminInputDisplayName');
const adminInputRole = document.getElementById('adminInputRole');
const adminInputPhone = document.getElementById('adminInputPhone');
const adminInputStatus = document.getElementById('adminInputStatus');
const modalAdminTitle = document.getElementById('modalAdminTitle');

// ==============================================================================
// 2. Helpers & API Fetcher
// ==============================================================================
function showToast(msg, icon = 'ℹ️') {
  if (!toast) return;
  toastMessage.textContent = msg;
  toastIcon.textContent = icon;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

async function adminFetch(url, options = {}) {
  const headers = options.headers || {};
  if (currentAdminUser && currentAdminUser.userId) {
    headers['x-line-userid'] = currentAdminUser.userId;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 403) {
    showToast('ไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้ (403 Forbidden)', '⛔');
    if (adminAuthOverlay) {
      adminAuthOverlay.classList.remove('hidden');
      showDeniedState(currentAdminUser || { displayName: 'ไม่ทราบ', userId: '-' });
    }
  }

  // ป้องกันการ throw Unexpected token เมื่อเซิร์ฟเวอร์คืน HTML หรือ Plain text 500 Error
  const originalJson = res.json.bind(res);
  res.json = async () => {
    try {
      return await originalJson();
    } catch (parseErr) {
      try {
        const text = await res.clone().text();
        console.error(`Server returned non-JSON response from ${url}:`, text);
        if (res.status >= 500) {
          throw new Error(`เซิร์ฟเวอร์ทำงานผิดพลาด (${res.status}): ${text.slice(0, 120)}`);
        }
        throw new Error(`รูปแบบข้อมูลไม่ถูกต้อง (${res.status})`);
      } catch (cloneErr) {
        throw new Error(`การเชื่อมต่อเซิร์ฟเวอร์ผิดพลาด (${res.status})`);
      }
    }
  };

  return res;
}

function formatMoney(num) {
  if (isNaN(num)) return '฿0.00';
  return '฿' + Number(num).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ==============================================================================
// 3. Authentication & Access Control
// ==============================================================================
async function initAdminAuth() {
  // 1. ตรวจสอบ Local Session
  const savedSession = localStorage.getItem('debt_admin_session');
  if (savedSession) {
    try {
      const parsed = JSON.parse(savedSession);
      if (parsed && parsed.userId) {
        const res = await fetch(`/api/admin/verify-access?userId=${encodeURIComponent(parsed.userId)}`);
        const authData = await res.json();
        if (authData.authorized) {
          currentAdminUser = parsed;
          unlockAdminView(parsed);
          return;
        } else {
          localStorage.removeItem('debt_admin_session');
        }
      }
    } catch (e) {
      localStorage.removeItem('debt_admin_session');
    }
  }

  // 2. ตรวจสอบผ่าน LINE LIFF SDK
  try {
    await resolveLiffId();
    await liff.init({ liffId: LIFF_ID });

    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      currentAdminUser = profile;

      const res = await fetch(`/api/admin/verify-access?userId=${encodeURIComponent(profile.userId)}`);
      const authData = await res.json();

      if (authData.authorized) {
        unlockAdminView(profile);
      } else {
        const reason = authData.adminCount === 0
          ? 'ยังไม่มีรายชื่อผู้ดูแลระบบใน Google Sheet (แท็บ admin ยังว่างเปล่า)'
          : 'บัญชี LINE ของคุณไม่มีสิทธิ์เข้าใช้งานในส่วนผู้ดูแลระบบ';
        showDeniedState(profile, reason);
      }
    } else {
      if (liff.isInClient()) {
        liff.login({ redirectUri: window.location.href });
      } else {
        showLoginState();
      }
    }
  } catch (err) {
    console.error('LIFF Init error:', err);
    showLoginState();
  }
}

function unlockAdminView(profile) {
  if (adminAuthOverlay) adminAuthOverlay.classList.add('hidden');
  if (sidebarAdminName) sidebarAdminName.textContent = profile.displayName || 'ผู้ดูแลระบบ';
  if (sidebarAdminId) sidebarAdminId.textContent = profile.userId || '-';
  if (sidebarAvatar && profile.pictureUrl) {
    sidebarAvatar.innerHTML = `<img src="${profile.pictureUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
  }

  loadStats();
  loadReminderSettings();
  initWizardDefaults();
}

function showLoginState() {
  if (authCheckingState) authCheckingState.style.display = 'none';
  if (authDeniedState) authDeniedState.style.display = 'none';
  if (authLoginState) authLoginState.style.display = 'block';
}

function showDeniedState(profile, reason) {
  if (deniedDisplayName) deniedDisplayName.textContent = profile.displayName || '-';
  if (deniedUserId) deniedUserId.textContent = profile.userId || '-';
  const reasonEl = document.getElementById('deniedReasonText');
  if (reasonEl && reason) reasonEl.innerHTML = reason;
  if (authCheckingState) authCheckingState.style.display = 'none';
  if (authLoginState) authLoginState.style.display = 'none';
  if (authDeniedState) authDeniedState.style.display = 'block';
}

async function loginAsLocalAdmin(userId, displayName = 'ผู้ดูแลระบบ (Local Mode)') {
  if (!userId || !userId.trim()) {
    showToast('กรุณาระบุ LINE User ID ของแอดมิน', '⚠️');
    return;
  }
  const cleanId = userId.trim();
  try {
    const res = await fetch(`/api/admin/verify-access?userId=${encodeURIComponent(cleanId)}`);
    const authData = await res.json();

    if (authData.authorized) {
      const userObj = { userId: cleanId, displayName };
      currentAdminUser = userObj;
      localStorage.setItem('debt_admin_session', JSON.stringify(userObj));
      unlockAdminView(userObj);
      showToast(`เข้าสู่ระบบสำเร็จ: ${displayName}`, '✅');
    } else {
      showToast('LINE User ID นี้ไม่มีสิทธิ์แอดมินในระบบ', '⛔');
      alert(`⛔ ปฏิเสธการเข้าถึง:\nLINE User ID: ${cleanId}\nไม่พบในรายการแอดมินที่ได้รับอนุญาตใน .env หรือ Google Sheet`);
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์: ' + err.message, '❌');
  }
}

// Event Listeners for Login & Logout
if (btnAdminLoginLine) {
  btnAdminLoginLine.addEventListener('click', () => {
    if (window.location.protocol === 'http:') {
      alert('⚠️ LINE Login ไม่อนุญาตให้ Redirect กลับมาที่ http://localhost ได้โดยตรงตามข้อกำหนดของ LINE\n\n👉 บนเครื่องคอมฯ: กรุณาใช้ปุ่ม "เข้าสู่ระบบในเครื่อง (Localhost Mode)" ด้านล่าง เพื่อเข้าใช้งานได้ทันทีครับ\n\n🌐 หากต้องการทดสอบ LINE Login จริง ให้เปิดผ่าน HTTPS ด้วย Ngrok');
      return;
    }
    liff.login({ redirectUri: window.location.href });
  });
}

if (btnLocalAdminLogin && inputLocalAdminUserId) {
  btnLocalAdminLogin.addEventListener('click', () => {
    loginAsLocalAdmin(inputLocalAdminUserId.value, 'ผู้ดูแลระบบ');
  });
}

if (btnQuickAdminLogin) {
  btnQuickAdminLogin.addEventListener('click', () => {
    loginAsLocalAdmin('U16565ee5abb9acecbbaf08d123f06cd2', '😾POND-IT😸 (Admin หลัก)');
  });
}

if (btnAdminLogout) {
  btnAdminLogout.addEventListener('click', () => {
    if (confirm('ต้องการออกจากระบบผู้ดูแลระบบใช่หรือไม่?')) {
      localStorage.removeItem('debt_admin_session');
      try {
        if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
          liff.logout();
        }
      } catch (e) {}
      window.location.reload();
    }
  });
}

if (btnSwitchAccount) {
  btnSwitchAccount.addEventListener('click', () => {
    localStorage.removeItem('debt_admin_session');
    try {
      if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
        liff.logout();
      }
    } catch (e) {}
    window.location.reload();
  });
}

// ==============================================================================
// 4. View Switching & Navigation (PC Layout)
// ==============================================================================
const viewTitleMap = {
  'view-admin-overview': 'ภาพรวม & สถิติ',
  'view-admin-new-contract': 'สร้างสัญญาหนี้ใหม่',
  'view-admin-contracts': 'จัดการสัญญาหนี้',
  'view-admin-slips': 'ตรวจสอบสลิปโอนเงิน',
  'view-admin-debtors': 'สมุดรายชื่อลูกหนี้',
  'view-admin-reminders': 'ระบบแจ้งเตือนอัตโนมัติ',
  'view-admin-managers': 'จัดการทีมแอดมิน',
  'view-admin-audit': 'บันทึกประวัติระบบ (Audit Trail)'
};

function switchView(targetViewId) {
  subViews.forEach(view => {
    if (view.id === targetViewId) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  sidebarNavItems.forEach(item => {
    if (item.getAttribute('data-target') === targetViewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  if (topbarCurrentViewTitle) {
    topbarCurrentViewTitle.textContent = viewTitleMap[targetViewId] || 'Admin Hub';
  }

  // Scroll viewport to top
  const viewport = document.querySelector('.views-viewport');
  if (viewport) viewport.scrollTop = 0;

  // Close mobile sidebar if open
  if (adminSidebar) adminSidebar.classList.remove('open');

  // Trigger data loader for view
  if (targetViewId === 'view-admin-overview') loadStats();
  if (targetViewId === 'view-admin-new-contract') {
    loadWizardDebtors();
    loadReminderProfiles();
  }
  if (targetViewId === 'view-admin-contracts') {
    loadReminderProfiles();
    loadContracts();
  }
  if (targetViewId === 'view-admin-slips') loadSlips();
  if (targetViewId === 'view-admin-debtors') {
    loadReminderProfiles();
    loadDebtors();
  }
  if (targetViewId === 'view-admin-reminders') {
    loadReminderProfiles();
    loadReminderSettings();
    loadReminderLogs();
  }
  if (targetViewId === 'view-admin-managers') loadAdmins();
  if (targetViewId === 'view-admin-audit') loadAuditLogs();
}

window.switchView = switchView;

sidebarNavItems.forEach(item => {
  item.addEventListener('click', () => {
    const target = item.getAttribute('data-target');
    if (target) switchView(target);
  });
});

if (btnToggleSidebar && adminSidebar) {
  btnToggleSidebar.addEventListener('click', () => {
    adminSidebar.classList.toggle('open');
  });
}

// ==============================================================================
// 5. Overview & Stats
// ==============================================================================
async function loadStats() {
  try {
    const res = await adminFetch('/api/admin/stats');
    const data = await res.json();

    if (data.success && data.stats) {
      const s = data.stats;
      const totalContractsNum = s.activeCount ?? s.totalContracts ?? s.activeDebtsCount ?? 0;
      const totalDebtorsNum = s.totalDebtors ?? s.debtorsCount ?? 0;

      if (statRemaining) statRemaining.textContent = formatMoney(s.totalRemaining);
      if (statPendingSlips) statPendingSlips.textContent = `${s.pendingSlipsCount || 0} ใบ`;
      if (statDueToday) statDueToday.textContent = `${s.dueTodayCount || 0} ราย`;
      if (statTotalContracts) statTotalContracts.textContent = `${totalContractsNum} สัญญา`;
      if (statTotalDebtors) statTotalDebtors.textContent = `${totalDebtorsNum} คน`;

      if (sidebarContractsBadge) sidebarContractsBadge.textContent = totalContractsNum;
      if (sidebarSlipsBadge) {
        sidebarSlipsBadge.textContent = `${s.pendingSlipsCount || 0} ใบ`;
        sidebarSlipsBadge.style.display = (s.pendingSlipsCount > 0) ? 'inline-block' : 'none';
      }
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// Topbar Trigger Cron & Overview Trigger
if (btnTriggerCronNow) btnTriggerCronNow.addEventListener('click', triggerCronExecution);
if (btnTopTriggerCron) btnTopTriggerCron.addEventListener('click', triggerCronExecution);

async function triggerCronExecution() {
  if (!confirm('ต้องการสั่งรันการตรวจสอบและยิงแจ้งเตือนวันนี้ทันทีใช่หรือไม่?')) return;
  showToast('กำลังสั่งรันระบบแจ้งเตือน...', '⏳');

  try {
    const res = await adminFetch('/api/reminder/trigger-now', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      const sum = data.summary || {};
      alert(`✅ สั่งยิงแจ้งเตือนเสร็จสมบูรณ์!\n\n📋 พบหนี้ที่เข้าเกณฑ์: ${sum.totalCandidates || 0} ราย\n✅ ส่งสำเร็จ: ${sum.sent || 0} ราย\n⏭️ ข้าม (ส่งไปแล้ววันนี้): ${sum.skipped || 0} ราย\n❌ ส่งไม่สำเร็จ: ${sum.failed || 0} ราย`);
      loadStats();
      loadReminderLogs();
    } else {
      showToast(data.message || 'เกิดข้อผิดพลาดในการยิงแจ้งเตือน', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
}

// ==============================================================================
// 6. Dedicated New Contract Creator (Wizard & Live Preview)
// ==============================================================================
function initWizardDefaults() {
  const today = new Date();
  today.setDate(today.getDate() + 30);
  const defaultDueDate = today.toISOString().split('T')[0];
  if (wizardDueDate) wizardDueDate.value = defaultDueDate;
  loadReminderProfiles();
  updateWizardPreview();
}

async function loadWizardDebtors() {
  try {
    const res = await adminFetch('/api/admin/debtors');
    const data = await res.json();
    if (data.success && data.debtors) {
      allDebtors = data.debtors;
      if (wizardDebtorSelect) {
        wizardDebtorSelect.innerHTML = '<option value="">-- เลือกลูกหนี้จากรายชื่อ (หรือกรอกเองด้านล่าง) --</option>' +
          allDebtors.map(d => `<option value="${d.userId}">${d.fullName || d.displayName} (${d.phone || d.userId.slice(0, 10)}...)</option>`).join('');
      }
    }
  } catch (err) {
    console.warn('Could not load debtors for wizard:', err.message);
  }
}

if (wizardDebtorSelect) {
  wizardDebtorSelect.addEventListener('change', () => {
    const selectedId = wizardDebtorSelect.value;
    if (!selectedId) return;

    const found = allDebtors.find(d => d.userId === selectedId);
    if (found) {
      if (wizardUserId) wizardUserId.value = found.userId;
      if (wizardDebtorName) wizardDebtorName.value = found.fullName || found.displayName || '';
      if (wizardPhone) wizardPhone.value = found.phone || '';
      if (wizardIdCard) wizardIdCard.value = found.idCardNumber || '';
      updateWizardPreview();
    }
  });
}

// Smart Payment Calculator
function handleCalculatorFromCount() {
  const total = Number(wizardTotalAmount.value) || 0;
  const count = Number(wizardInstallmentCount.value) || 0;

  if (total > 0 && count > 0) {
    const installment = Math.ceil(total / count);
    wizardInstallmentAmount.value = installment;
  }
  updateWizardPreview();
}

function handleCalculatorFromInstallment() {
  const total = Number(wizardTotalAmount.value) || 0;
  const installment = Number(wizardInstallmentAmount.value) || 0;

  if (total > 0 && installment > 0) {
    const count = Math.ceil(total / installment);
    wizardInstallmentCount.value = count;
  }
  updateWizardPreview();
}

if (wizardTotalAmount) {
  wizardTotalAmount.addEventListener('input', handleCalculatorFromCount);
}
if (wizardInstallmentCount) {
  wizardInstallmentCount.addEventListener('input', handleCalculatorFromCount);
}
if (wizardInstallmentAmount) {
  wizardInstallmentAmount.addEventListener('input', handleCalculatorFromInstallment);
}
if (wizardDebtorName) {
  wizardDebtorName.addEventListener('input', updateWizardPreview);
}
if (wizardDueDate) {
  wizardDueDate.addEventListener('change', updateWizardPreview);
}
if (wizardCycleDays) {
  wizardCycleDays.addEventListener('change', updateWizardPreview);
}
if (wizardSendPushCheck) {
  wizardSendPushCheck.addEventListener('change', updateWizardPreview);
}

function updateWizardPreview() {
  const total = Number(wizardTotalAmount?.value) || 0;
  const installment = Number(wizardInstallmentAmount?.value) || 0;
  const name = wizardDebtorName?.value || 'คุณลูกค้า';
  const dueDate = wizardDueDate?.value || '-';
  const cycle = wizardCycleDays?.value || '30';
  const sendPush = wizardSendPushCheck?.checked;

  if (prevTotalAmount) prevTotalAmount.textContent = formatMoney(total);
  if (prevDebtorName) prevDebtorName.textContent = name;
  if (prevInstallment) prevInstallment.textContent = formatMoney(installment);
  if (prevDueDate) prevDueDate.textContent = dueDate;
  if (prevCycle) prevCycle.textContent = `ทุกๆ ${cycle} วัน`;
  
  const profSelect = document.getElementById('wizardReminderProfile');
  const profName = (profSelect && profSelect.selectedIndex >= 0 && profSelect.value) ? profSelect.options[profSelect.selectedIndex].text : 'รูปแบบเริ่มต้น (Default)';
  const prevProf = document.getElementById('prevReminderProfile');
  if (prevProf) prevProf.textContent = profName;

  if (prevSendPush) {
    prevSendPush.textContent = sendPush ? '✅ ส่งทันที' : 'ไม่ส่ง';
    prevSendPush.style.color = sendPush ? '#38BDF8' : '#94A3B8';
  }
}

// Attach listener to wizard reminder profile select
if (document.getElementById('wizardReminderProfile')) {
  document.getElementById('wizardReminderProfile').addEventListener('change', updateWizardPreview);
}

// Submit Wizard Form
let isSubmittingWizard = false;
if (createContractWizardForm) {
  createContractWizardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmittingWizard) return;

    const payload = {
      userId: wizardUserId.value.trim(),
      debtorName: wizardDebtorName.value.trim(),
      phone: wizardPhone.value.trim(),
      idCardNumber: wizardIdCard.value.trim(),
      totalAmount: Number(wizardTotalAmount.value),
      installmentAmount: Number(wizardInstallmentAmount.value),
      dueDate: wizardDueDate.value,
      cycleDays: Number(wizardCycleDays.value) || 30,
      reminderProfileId: document.getElementById('wizardReminderProfile')?.value || '',
      reminderEnabled: document.getElementById('wizardReminderEnabled')?.checked !== false,
      sendLineNotification: wizardSendPushCheck.checked
    };

    if (!payload.userId || !payload.debtorName || !payload.totalAmount || !payload.installmentAmount || !payload.dueDate) {
      showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', '⚠️');
      return;
    }

    isSubmittingWizard = true;
    if (btnSubmitWizardContract) {
      btnSubmitWizardContract.disabled = true;
      btnSubmitWizardContract.textContent = '⏳ กำลังบันทึกสัญญาและส่งแจ้งเตือน...';
    }

    try {
      const res = await adminFetch('/api/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'สร้างสัญญาใหม่สำเร็จ!', '✅');
        createContractWizardForm.reset();
        initWizardDefaults();
        loadContracts();
        loadStats();
        setTimeout(() => switchView('view-admin-contracts'), 800);
      } else {
        showToast(json.message || 'สร้างสัญญาไม่สำเร็จ', '❌');
      }
    } catch (err) {
      console.error('Error creating contract:', err);
      showToast('เกิดข้อผิดพลาดในการสร้างสัญญา: ' + err.message, '❌');
    } finally {
      isSubmittingWizard = false;
      if (btnSubmitWizardContract) {
        btnSubmitWizardContract.disabled = false;
        btnSubmitWizardContract.textContent = '💾 บันทึกและเปิดสัญญาเงินกู้ใหม่';
      }
    }
  });
}

if (btnResetWizardForm) {
  btnResetWizardForm.addEventListener('click', () => {
    createContractWizardForm.reset();
    initWizardDefaults();
    showToast('ล้างข้อมูลฟอร์มแล้ว', '🔄');
  });
}

// Quick action to open contract wizard for specific debtor
window.openContractForDebtor = function(userId, name, phone, idCard) {
  switchView('view-admin-new-contract');
  if (wizardUserId) wizardUserId.value = userId || '';
  if (wizardDebtorName) wizardDebtorName.value = name || '';
  if (wizardPhone) wizardPhone.value = phone || '';
  if (wizardIdCard) wizardIdCard.value = idCard || '';
  updateWizardPreview();
  showToast(`เลือกข้อมูลคุณ ${name} เรียบร้อยแล้ว`, '👤');
};

// ==============================================================================
// 7. Contracts Directory (Grouped by Debtor - Selection Required)
// ==============================================================================
let contractSelectedDebtorId = ''; // ค่าเริ่มต้น: ต้องเลือกลูกหนี้ก่อน

const contractDebtorFilter = document.getElementById('contractDebtorFilter');
const btnClearContractDebtor = document.getElementById('btnClearContractDebtor');
const contractsDebtorPickerContainer = document.getElementById('contractsDebtorPickerContainer');
const contractsTableContainer = document.getElementById('contractsTableContainer');
const debtorCardsGrid = document.getElementById('debtorCardsGrid');
const debtorCardSearchInput = document.getElementById('debtorCardSearchInput');
const selectedDebtorBanner = document.getElementById('selectedDebtorBanner');
const heroDebtorAvatar = document.getElementById('heroDebtorAvatar');
const heroDebtorName = document.getElementById('heroDebtorName');
const heroDebtorUserId = document.getElementById('heroDebtorUserId');
const heroDebtorPhone = document.getElementById('heroDebtorPhone');
const heroStatContractsCount = document.getElementById('heroStatContractsCount');
const heroStatTotalAmount = document.getElementById('heroStatTotalAmount');
const heroStatRemainingAmount = document.getElementById('heroStatRemainingAmount');
const btnHeroOpenContract = document.getElementById('btnHeroOpenContract');

/**
 * ดึงข้อมูลสัญญาและรายชื่อลูกหนี้
 */
async function loadContracts() {
  if (contractsTableBody) {
    contractsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">กำลังโหลดข้อมูลสัญญา...</td></tr>';
  }
  if (debtorCardsGrid) {
    debtorCardsGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">กำลังโหลดรายชื่อลูกหนี้และยอดหนี้...</div>';
  }

  try {
    const [contractsRes, debtorsRes] = await Promise.all([
      adminFetch('/api/admin/contracts'),
      adminFetch('/api/admin/debtors')
    ]);

    const contractsData = await contractsRes.json();
    const debtorsData = await debtorsRes.json();

    if (contractsData.success && contractsData.contracts) {
      allContracts = contractsData.contracts;
    }
    if (debtorsData.success && debtorsData.debtors) {
      allDebtors = debtorsData.debtors;
    }

    renderDebtorDropdownAndCards();
    renderContractsView();
  } catch (err) {
    console.error('Error loading contracts:', err);
    if (contractsTableBody) {
      contractsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #EF4444; padding: 20px;">เกิดข้อผิดพลาดในการโหลดสัญญา</td></tr>';
    }
  }
}

/**
 * รวมกลุ่มข้อมูลลูกหนี้และสัญญาเข้าด้วยกัน
 */
function getDebtorGroupMap() {
  const map = new Map();

  (allDebtors || []).forEach(d => {
    map.set(d.userId, {
      userId: d.userId,
      fullName: d.fullName || d.displayName || 'คุณลูกค้า',
      displayName: d.displayName || '',
      phone: d.phone || '',
      idCardNumber: d.idCardNumber || '',
      contracts: [],
      totalAmount: 0,
      remainingBalance: 0,
      activeCount: 0,
      overdueCount: 0,
      paidCount: 0
    });
  });

  (allContracts || []).forEach(c => {
    const uid = c.userId || 'UNKNOWN';
    if (!map.has(uid)) {
      map.set(uid, {
        userId: uid,
        fullName: c.debtorName || 'คุณลูกค้า',
        displayName: c.debtorName || '',
        phone: '',
        idCardNumber: '',
        contracts: [],
        totalAmount: 0,
        remainingBalance: 0,
        activeCount: 0,
        overdueCount: 0,
        paidCount: 0
      });
    }

    const debtor = map.get(uid);
    debtor.contracts.push(c);
    const total = Number(c.totalAmount) || 0;
    const remaining = Number(c.remainingBalance) || 0;
    debtor.totalAmount += total;
    debtor.remainingBalance += remaining;

    if (c.debtStatus === 'OVERDUE') debtor.overdueCount++;
    else if (c.debtStatus === 'PAID') debtor.paidCount++;
    else debtor.activeCount++;
  });

  return map;
}

/**
 * อัปเดต Dropdown เลือกลูกหนี้ และเรนเดอร์การ์ดลูกหนี้ (State 1)
 */
function renderDebtorDropdownAndCards() {
  const debtorMap = getDebtorGroupMap();
  const debtorList = Array.from(debtorMap.values());

  debtorList.sort((a, b) => {
    if (b.remainingBalance !== a.remainingBalance) {
      return b.remainingBalance - a.remainingBalance;
    }
    return b.contracts.length - a.contracts.length;
  });

  if (contractDebtorFilter) {
    let options = '<option value="">-- กรุณาเลือกลูกหนี้ (เลือกก่อนดูสัญญา) --</option>';
    debtorList.forEach(d => {
      const remainingStr = d.remainingBalance > 0 ? ` (ค้าง ${formatMoney(d.remainingBalance)})` : '';
      options += `<option value="${d.userId}">👤 ${d.fullName} [${d.contracts.length} สัญญา${remainingStr}]</option>`;
    });
    options += '<option value="ALL">🌐 ดูสัญญาหนี้ของลูกหนี้ทุกคน (โหมดรวมทั้งหมด)</option>';
    contractDebtorFilter.innerHTML = options;
    contractDebtorFilter.value = contractSelectedDebtorId || '';
  }

  renderDebtorCardsGrid();
}

/**
 * เรนเดอร์การ์ดรายชื่อลูกหนี้ (State 1: Picker)
 */
function renderDebtorCardsGrid() {
  if (!debtorCardsGrid) return;

  const debtorMap = getDebtorGroupMap();
  let debtorList = Array.from(debtorMap.values());
  const query = (debtorCardSearchInput?.value || '').toLowerCase().trim();

  if (query) {
    debtorList = debtorList.filter(d => 
      (d.fullName || '').toLowerCase().includes(query) ||
      (d.displayName || '').toLowerCase().includes(query) ||
      (d.phone || '').toLowerCase().includes(query) ||
      (d.userId || '').toLowerCase().includes(query)
    );
  }

  debtorList.sort((a, b) => {
    if (b.remainingBalance !== a.remainingBalance) return b.remainingBalance - a.remainingBalance;
    return b.contracts.length - a.contracts.length;
  });

  if (debtorList.length === 0) {
    debtorCardsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        🔍 ไม่พบลูกหนี้ที่ตรงกับคำค้นหา "${query}"
      </div>
    `;
    return;
  }

  debtorCardsGrid.innerHTML = debtorList.map(d => {
    const contractsCount = d.contracts.length;
    const initial = (d.fullName || d.displayName || 'U').charAt(0).toUpperCase();
    const hasOverdue = d.overdueCount > 0;
    const hasActive = d.activeCount > 0;

    let badgeStatusHtml = `<span class="badge-status ${hasActive ? 'active' : 'paid'}">${contractsCount} สัญญา</span>`;
    if (hasOverdue) {
      badgeStatusHtml += ` <span class="badge-status overdue" style="margin-left: 4px;">เกินกำหนด ${d.overdueCount}</span>`;
    }

    return `
      <div class="debtor-select-card" onclick="selectContractDebtor('${d.userId}')" title="คลิกเพื่อดูสัญญาหนี้ของคุณ ${d.fullName}">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
            <div class="debtor-avatar-circle">${initial}</div>
            <div style="overflow: hidden;">
              <div style="font-weight: 700; font-size: 15px; color: var(--text-main); white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                ${d.fullName}
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted); font-family: monospace; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                ${d.userId}
              </div>
              ${d.phone ? `<div style="font-size: 11px; color: var(--text-sub); margin-top: 1px;">📞 ${d.phone}</div>` : ''}
            </div>
          </div>
          <div>${badgeStatusHtml}</div>
        </div>

        <div style="display: flex; justify-content: space-between; background: var(--surface-subtle); padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 14px; border: 1px solid var(--surface-border);">
          <div>
            <div style="font-size: 11px; color: var(--text-muted);">ยอดหนี้รวม</div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">${formatMoney(d.totalAmount)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: var(--text-muted);">ยอดคงเหลือสุทธิ</div>
            <div style="font-weight: 700; font-size: 14px; color: var(--primary);">${formatMoney(d.remainingBalance)}</div>
          </div>
        </div>

        <button type="button" class="btn-primary-admin" style="width: 100%; padding: 10px; font-size: 13px; justify-content: center; gap: 8px;">
          <span>📂 เปิดดูสัญญาหนี้ (${contractsCount} สัญญา)</span>
          <span style="font-size: 14px;">➔</span>
        </button>
      </div>
    `;
  }).join('');
}

/**
 * สลับมุมมองตาม Debtor ที่ถูกเลือก
 */
function renderContractsView() {
  if (!contractSelectedDebtorId) {
    if (contractsDebtorPickerContainer) contractsDebtorPickerContainer.style.display = 'block';
    if (contractsTableContainer) contractsTableContainer.style.display = 'none';
    if (btnClearContractDebtor) btnClearContractDebtor.style.display = 'none';
    if (contractDebtorFilter) contractDebtorFilter.value = '';
    renderDebtorCardsGrid();
  } else {
    if (contractsDebtorPickerContainer) contractsDebtorPickerContainer.style.display = 'none';
    if (contractsTableContainer) contractsTableContainer.style.display = 'block';
    if (btnClearContractDebtor) btnClearContractDebtor.style.display = 'inline-block';
    if (contractDebtorFilter) contractDebtorFilter.value = contractSelectedDebtorId;

    updateSelectedDebtorHero();
    renderContractsTable();
  }
}

/**
 * อัปเดตการ์ดโปรไฟล์ลูกหนี้ที่เลือก (Selected Debtor Hero Banner)
 */
function updateSelectedDebtorHero() {
  if (!selectedDebtorBanner) return;

  if (contractSelectedDebtorId === 'ALL') {
    if (heroDebtorAvatar) heroDebtorAvatar.textContent = '🌐';
    if (heroDebtorName) heroDebtorName.textContent = 'ลูกหนี้ทุกคน (โหมดรวมทั้งหมด)';
    const statusBadge = document.getElementById('heroDebtorStatusBadge');
    if (statusBadge) {
      statusBadge.className = 'badge-status active';
      statusBadge.textContent = 'แสดงสัญญาหนี้ทั้งหมด';
    }
    if (heroDebtorUserId) heroDebtorUserId.textContent = 'รวมข้อมูลทุกบัญชีลูกหนี้';
    if (heroDebtorPhone) heroDebtorPhone.textContent = `จำนวนสัญญาในระบบทั้งหมด ${allContracts.length} ฉบับ`;

    let totalAll = 0, remainingAll = 0;
    allContracts.forEach(c => {
      totalAll += Number(c.totalAmount) || 0;
      remainingAll += Number(c.remainingBalance) || 0;
    });

    if (heroStatContractsCount) heroStatContractsCount.textContent = `${allContracts.length} สัญญา`;
    if (heroStatTotalAmount) heroStatTotalAmount.textContent = formatMoney(totalAll);
    if (heroStatRemainingAmount) heroStatRemainingAmount.textContent = formatMoney(remainingAll);
    if (btnHeroOpenContract) {
      btnHeroOpenContract.onclick = () => switchView('view-admin-new-contract');
    }
    return;
  }

  const debtorMap = getDebtorGroupMap();
  const d = debtorMap.get(contractSelectedDebtorId) || {
    userId: contractSelectedDebtorId,
    fullName: 'คุณลูกค้า',
    phone: '',
    contracts: [],
    totalAmount: 0,
    remainingBalance: 0
  };

  const initial = (d.fullName || d.displayName || 'U').charAt(0).toUpperCase();
  if (heroDebtorAvatar) heroDebtorAvatar.textContent = initial;
  if (heroDebtorName) heroDebtorName.textContent = d.fullName;
  const statusBadge = document.getElementById('heroDebtorStatusBadge');
  if (statusBadge) {
    if (d.overdueCount > 0) {
      statusBadge.className = 'badge-status overdue';
      statusBadge.textContent = '⚠️ มีสัญญาค้างชำระ';
    } else if (d.contracts.length > 0) {
      statusBadge.className = 'badge-status active';
      statusBadge.textContent = '🟢 ปกติ (กำลังผ่อน)';
    } else {
      statusBadge.className = 'badge-status paid';
      statusBadge.textContent = 'ไม่มีสัญญาค้าง';
    }
  }

  if (heroDebtorUserId) heroDebtorUserId.textContent = d.userId;
  if (heroDebtorPhone) heroDebtorPhone.textContent = d.phone ? `📞 เบอร์โทร: ${d.phone}` : '📞 ยังไม่ระบุเบอร์โทร';

  if (heroStatContractsCount) heroStatContractsCount.textContent = `${d.contracts.length} สัญญา`;
  if (heroStatTotalAmount) heroStatTotalAmount.textContent = formatMoney(d.totalAmount);
  if (heroStatRemainingAmount) heroStatRemainingAmount.textContent = formatMoney(d.remainingBalance);

  if (btnHeroOpenContract) {
    btnHeroOpenContract.onclick = () => {
      openContractForDebtor(d.userId, d.fullName, d.phone, d.idCardNumber);
    };
  }
}

/**
 * เรนเดอร์แถวตารางสัญญาหนี้ (เฉพาะลูกหนี้ที่เลือก)
 */
function renderContractsTable() {
  if (!contractsTableBody) return;

  const query = (contractSearchInput?.value || '').toLowerCase().trim();
  const filterStatus = contractFilterStatus?.value || 'ALL';

  let filtered = allContracts;
  if (contractSelectedDebtorId && contractSelectedDebtorId !== 'ALL') {
    filtered = filtered.filter(c => c.userId === contractSelectedDebtorId);
  }

  filtered = filtered.filter(c => {
    const matchQuery = !query || 
      (c.debtId || '').toLowerCase().includes(query) ||
      (c.debtorName || '').toLowerCase().includes(query) ||
      (c.userId || '').toLowerCase().includes(query);

    const matchStatus = filterStatus === 'ALL' || c.debtStatus === filterStatus;
    return matchQuery && matchStatus;
  });

  if (filtered.length === 0) {
    contractsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">ไม่พบสัญญาหนี้ของลูกหนี้นี้ที่ตรงกับเงื่อนไข</td></tr>';
    return;
  }

  contractsTableBody.innerHTML = filtered.map(c => {
    let statusBadge = `<span class="badge-status active">กำลังผ่อน</span>`;
    if (c.debtStatus === 'OVERDUE') statusBadge = `<span class="badge-status overdue">เกินกำหนด</span>`;
    if (c.debtStatus === 'PAID') statusBadge = `<span class="badge-status paid">ชำระครบ</span>`;

    const total = Number(c.totalAmount) || 0;
    const remaining = Number(c.remainingBalance) || 0;
    const paidPercent = total > 0 ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 0;
    const isRemindActive = c.reminderEnabled !== false;
    const profileLabel = isRemindActive ? getProfileName(c.reminderProfileId) : 'ปิดแจ้งเตือน';

    return `
      <tr>
        <td><strong style="color: var(--primary); font-family: monospace;">${c.debtId}</strong></td>
        <td><strong>${formatMoney(total)}</strong></td>
        <td>
          <div style="color: var(--primary); font-weight: 700;">${formatMoney(remaining)}</div>
          <div style="width: 100px; height: 5px; background: rgba(0,0,0,0.08); border-radius: 3px; margin-top: 4px; overflow: hidden;">
            <div style="width: ${paidPercent}%; height: 100%; background: var(--success);"></div>
          </div>
          <span style="font-size: 10.5px; color: var(--text-muted);">${paidPercent}% ชำระแล้ว</span>
        </td>
        <td><span style="color: var(--success); font-weight: 600;">${formatMoney(c.installmentAmount)}</span></td>
        <td>
          <div style="font-weight: 600; color: var(--warning);">${c.dueDate || '-'}</div>
          <small style="font-size: 10px; color: var(--text-muted);">รอบ ${c.cycleDays || 30} วัน</small>
        </td>
        <td>${statusBadge}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge-status ${isRemindActive ? 'active' : 'overdue'}" style="cursor: pointer; font-size: 10.5px;" onclick="openAssignReminderModal('contract', '${c.debtId}', '${c.reminderProfileId || ''}', ${isRemindActive}, '${c.debtId} (${c.debtorName || 'คุณลูกค้า'})')" title="คลิกเพื่อเปลี่ยนรูปแบบแจ้งเตือน">
              ${profileLabel} ⚙️
            </span>
            <label class="switch-toggle" style="transform: scale(0.75);" title="${isRemindActive ? 'เปิดแจ้งเตือนอยู่ (คลิกเพื่อปิด)' : 'ปิดแจ้งเตือนอยู่ (คลิกเพื่อเปิด)'}">
              <input type="checkbox" ${isRemindActive ? 'checked' : ''} onchange="toggleContractReminder('${c.debtId}', this.checked)">
              <span class="slider-toggle"></span>
            </label>
          </div>
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <button class="btn-action-icon remind" onclick="sendSingleReminder('${c.debtId}')" title="ยิงแจ้งเตือนทันที">
            🔔
          </button>
          <button class="btn-action-icon delete" onclick="deleteContract('${c.debtId}')" title="ลบสัญญา">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Global functions for window
window.selectContractDebtor = function(userId) {
  contractSelectedDebtorId = userId;
  renderContractsView();
};

window.clearSelectedContractDebtor = function() {
  contractSelectedDebtorId = '';
  renderContractsView();
};

window.viewContractsForDebtor = function(userId) {
  contractSelectedDebtorId = userId;
  switchView('view-admin-contracts');
};

if (contractDebtorFilter) {
  contractDebtorFilter.addEventListener('change', () => {
    contractSelectedDebtorId = contractDebtorFilter.value;
    renderContractsView();
  });
}
if (debtorCardSearchInput) {
  debtorCardSearchInput.addEventListener('input', renderDebtorCardsGrid);
}
if (contractSearchInput) contractSearchInput.addEventListener('input', renderContractsTable);
if (contractFilterStatus) contractFilterStatus.addEventListener('change', renderContractsTable);
if (btnRefreshContracts) btnRefreshContracts.addEventListener('click', loadContracts);

window.deleteContract = async function(debtId) {
  if (!confirm(`ต้องการลบสัญญา ${debtId} ใช่หรือไม่? ข้อมูลในระบบจะถูกนำออก`)) return;

  // Optimistic UI update: Remove row immediately from local table
  allContracts = allContracts.filter(c => c.debtId !== debtId);
  renderContractsTable();

  try {
    const res = await adminFetch(`/api/admin/contracts/${debtId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('ลบสัญญาสำเร็จ', '✅');
      loadStats();
    } else {
      showToast(data.message || 'ลบสัญญาไม่สำเร็จ', '❌');
      loadContracts();
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการลบสัญญา', '❌');
    loadContracts();
  }
};

window.sendSingleReminder = async function(debtId) {
  if (!confirm(`ต้องการส่งข้อความแจ้งเตือนสัญญา ${debtId} ไปยัง LINE ลูกหนี้ทันทีใช่หรือไม่?`)) return;
  showToast('กำลังส่งข้อความแจ้งเตือน...', '⏳');

  try {
    const res = await adminFetch(`/api/admin/remind/${debtId}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('ส่งแจ้งเตือนเข้า LINE เรียบร้อยแล้ว!', '✅');
      loadReminderLogs();
    } else {
      showToast(data.message || 'ส่งแจ้งเตือนไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
};

// ==============================================================================
// 8. Slip Verification Hub (Enhanced with Filters & Lightbox Modal)
// ==============================================================================
let currentSlipFilter = 'PENDING';
const btnSyncDriveSlips = document.getElementById('btnSyncDriveSlips');
const slipSearchInput = document.getElementById('slipSearchInput');
const slipFilterTabs = document.getElementById('slipFilterTabs');
const badgePendingCount = document.getElementById('badgePendingCount');
const badgeAllCount = document.getElementById('badgeAllCount');
const badgeVerifiedCount = document.getElementById('badgeVerifiedCount');
const badgeRejectedCount = document.getElementById('badgeRejectedCount');

// Modal Elements
const slipLightboxModal = document.getElementById('slipLightboxModal');
const btnCloseSlipModal = document.getElementById('btnCloseSlipModal');
const lightboxImg = document.getElementById('lightboxImg');
const btnOpenSlipFull = document.getElementById('btnOpenSlipFull');
const modalSlipDebtorName = document.getElementById('modalSlipDebtorName');
const modalSlipMeta = document.getElementById('modalSlipMeta');
const modalSlipAmount = document.getElementById('modalSlipAmount');
const modalSlipDate = document.getElementById('modalSlipDate');
const modalSlipDebtId = document.getElementById('modalSlipDebtId');
const modalSlipDebtor = document.getElementById('modalSlipDebtor');
const modalSlipPhone = document.getElementById('modalSlipPhone');
const modalSlipStatusBadge = document.getElementById('modalSlipStatusBadge');
const btnModalApprove = document.getElementById('btnModalApprove');
const btnModalReject = document.getElementById('btnModalReject');
let activeModalSlip = null;

async function loadSlips() {
  if (!slipsContainer) return;
  slipsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted); grid-column: 1 / -1;">กำลังโหลดรายการสลิป...</div>';

  try {
    const res = await adminFetch('/api/admin/slips');
    const data = await res.json();

    if (data.success && data.slips) {
      allSlips = data.slips;
      updateSlipBadgeCounts();
      renderSlips();
    }
  } catch (err) {
    console.error('Error loading slips:', err);
    slipsContainer.innerHTML = '<div style="text-align: center; color: #EF4444; padding: 20px; grid-column: 1 / -1;">เกิดข้อผิดพลาดในการโหลดสลิป</div>';
  }
}

function updateSlipBadgeCounts() {
  const pending = allSlips.filter(s => !s.verificationStatus || s.verificationStatus === 'PENDING').length;
  const verified = allSlips.filter(s => s.verificationStatus === 'VERIFIED' || s.verificationStatus === 'APPROVED').length;
  const rejected = allSlips.filter(s => s.verificationStatus === 'REJECTED').length;

  if (badgePendingCount) badgePendingCount.textContent = pending;
  if (badgeAllCount) badgeAllCount.textContent = allSlips.length;
  if (badgeVerifiedCount) badgeVerifiedCount.textContent = verified;
  if (badgeRejectedCount) badgeRejectedCount.textContent = rejected;

  // อัปเดตตัวเลขในการ์ดสถิติตรวจสอบสลิปด้วย
  if (statPendingSlips) statPendingSlips.textContent = `${pending} ใบ`;
}

function renderSlips() {
  if (!slipsContainer) return;

  const query = (slipSearchInput?.value || '').toLowerCase().trim();

  const filtered = allSlips.filter(s => {
    const status = s.verificationStatus || 'PENDING';
    const matchFilter = currentSlipFilter === 'ALL' ||
      (currentSlipFilter === 'PENDING' && status === 'PENDING') ||
      (currentSlipFilter === 'VERIFIED' && (status === 'VERIFIED' || status === 'APPROVED')) ||
      (currentSlipFilter === 'REJECTED' && status === 'REJECTED');

    const matchQuery = !query ||
      (s.debtorName || '').toLowerCase().includes(query) ||
      (s.debtId || '').toLowerCase().includes(query) ||
      (s.paymentId || '').toLowerCase().includes(query) ||
      (s.userId || '').toLowerCase().includes(query);

    return matchFilter && matchQuery;
  });

  if (filtered.length === 0) {
    const emptyMsg = currentSlipFilter === 'PENDING'
      ? '🎉 ไม่มีสลิปรอตรวจสอบในขณะนี้'
      : 'ไม่พบรายการสลิปตามเงื่อนไขที่เลือก';
    slipsContainer.innerHTML = `<div style="text-align: center; padding: 50px 20px; color: var(--text-muted); grid-column: 1 / -1;">${emptyMsg}</div>`;
    return;
  }

  slipsContainer.innerHTML = filtered.map(s => {
    const isPending = !s.verificationStatus || s.verificationStatus === 'PENDING';
    let statusPill = `<span class="badge-status due-today">รอตรวจสอบ</span>`;
    if (s.verificationStatus === 'VERIFIED' || s.verificationStatus === 'APPROVED') {
      statusPill = `<span class="badge-status active">อนุมัติแล้ว</span>`;
    } else if (s.verificationStatus === 'REJECTED') {
      statusPill = `<span class="badge-status overdue">ปฏิเสธ</span>`;
    }

    const previewUrl = s.slipViewUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%231E293B"/><text x="50%" y="50%" fill="%2394A3B8" font-size="14" text-anchor="middle" dominant-baseline="middle">🧾 สลิปโอนเงิน</text></svg>';

    return `
      <div class="slip-card">
        <div class="slip-header">
          <div>
            <div class="slip-debtor-name">${s.debtorName || 'คุณลูกค้า'}</div>
            <div class="slip-meta">สัญญา: <strong>${s.debtId || '-'}</strong> | รหัส: ${s.paymentId}</div>
            <div class="slip-meta">📅 ส่งเมื่อ: ${s.uploadedAt || '-'}</div>
          </div>
          <div>${statusPill}</div>
        </div>

        <div class="slip-preview-box" onclick="openSlipLightbox('${s.paymentId}')" title="คลิกเพื่อซูมดูรูปสลิปขนาดใหญ่">
          <img src="${previewUrl}" class="slip-preview-img" alt="สลิปโอนเงิน" onerror="this.src='https://via.placeholder.com/300x200?text=Slip+Image'">
          <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 6px; font-size: 11px; color: #FFF;">🔍 คลิกซูม</div>
        </div>

        <div style="font-size: 13px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px;">
          <span style="color: var(--text-muted);">ยอดเงินที่ระบุ:</span>
          <strong style="color: #10B981; font-size: 17px;">${formatMoney(s.amount)}</strong>
        </div>

        ${isPending ? `
          <div class="slip-actions">
            <button class="btn-slip-approve" onclick="approveSlip('${s.paymentId}', ${s.amount})">
              ✅ อนุมัติ & ตัดยอด
            </button>
            <button class="btn-slip-reject" onclick="rejectSlip('${s.paymentId}')">
              ❌ ปฏิเสธ
            </button>
          </div>
        ` : `
          <div style="font-size: 12px; color: var(--text-muted); text-align: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <span>บันทึกผลแล้ว: ${s.adminNote || s.verificationStatus}</span>
            ${s.verificationStatus === 'VERIFIED' ? `
              <a href="/receipt/${s.paymentId}" target="_blank" style="padding: 4px 10px; background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; font-size: 11.5px; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                📄 ใบเสร็จ
              </a>
            ` : ''}
          </div>
        `}
      </div>
    `;
  }).join('');
}

// Lightbox Modal Functions
window.openSlipLightbox = function(paymentId) {
  const slip = allSlips.find(s => s.paymentId === paymentId);
  if (!slip) return;

  activeModalSlip = slip;
  if (modalSlipDebtorName) modalSlipDebtorName.textContent = slip.debtorName || 'คุณลูกค้า';
  if (modalSlipMeta) modalSlipMeta.textContent = `สัญญา: ${slip.debtId || '-'} | รหัส: ${slip.paymentId}`;
  if (modalSlipAmount) modalSlipAmount.textContent = formatMoney(slip.amount);
  if (modalSlipDate) modalSlipDate.textContent = slip.uploadedAt || '-';
  if (modalSlipDebtId) modalSlipDebtId.textContent = slip.debtId || '-';
  if (modalSlipDebtor) modalSlipDebtor.textContent = slip.debtorName || 'คุณลูกค้า';
  if (modalSlipPhone) modalSlipPhone.textContent = slip.debtorPhone || '-';

  const isPending = !slip.verificationStatus || slip.verificationStatus === 'PENDING';
  if (modalSlipStatusBadge) {
    modalSlipStatusBadge.textContent = isPending ? 'รอตรวจสอบ' : (slip.verificationStatus === 'VERIFIED' ? 'อนุมัติแล้ว' : 'ปฏิเสธ');
    modalSlipStatusBadge.className = isPending ? 'badge-status due-today' : (slip.verificationStatus === 'VERIFIED' ? 'badge-status active' : 'badge-status overdue');
  }

  const previewUrl = slip.slipViewUrl || 'https://via.placeholder.com/600x800?text=Slip+Image';
  if (lightboxImg) lightboxImg.src = previewUrl;
  if (btnOpenSlipFull) btnOpenSlipFull.href = previewUrl;

  const modalActions = document.getElementById('modalSlipActions');
  if (modalActions) modalActions.style.display = isPending ? 'flex' : 'none';

  if (slipLightboxModal) slipLightboxModal.style.display = 'flex';
};

function closeSlipLightbox() {
  if (slipLightboxModal) slipLightboxModal.style.display = 'none';
  activeModalSlip = null;
}

if (btnCloseSlipModal) btnCloseSlipModal.addEventListener('click', closeSlipLightbox);
if (slipLightboxModal) {
  slipLightboxModal.addEventListener('click', (e) => {
    if (e.target === slipLightboxModal) closeSlipLightbox();
  });
}

if (btnModalApprove) {
  btnModalApprove.addEventListener('click', () => {
    if (activeModalSlip) {
      const pId = activeModalSlip.paymentId;
      const amt = activeModalSlip.amount;
      closeSlipLightbox();
      approveSlip(pId, amt);
    }
  });
}

if (btnModalReject) {
  btnModalReject.addEventListener('click', () => {
    if (activeModalSlip) {
      const pId = activeModalSlip.paymentId;
      closeSlipLightbox();
      rejectSlip(pId);
    }
  });
}

// Slip Filters & Tabs
if (slipFilterTabs) {
  slipFilterTabs.querySelectorAll('button[data-slip-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      slipFilterTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSlipFilter = btn.getAttribute('data-slip-filter');
      renderSlips();
    });
  });
}

if (slipSearchInput) slipSearchInput.addEventListener('input', renderSlips);
if (btnRefreshSlips) btnRefreshSlips.addEventListener('click', loadSlips);

// Sync Drive Slips Button
if (btnSyncDriveSlips) {
  btnSyncDriveSlips.addEventListener('click', async () => {
    btnSyncDriveSlips.disabled = true;
    const oldText = btnSyncDriveSlips.innerHTML;
    btnSyncDriveSlips.innerHTML = '<span>⏳ กำลังซิงค์จาก Drive...</span>';
    showToast('กำลังค้นหาไฟล์สลิปใน Google Drive...', '⏳');

    try {
      const res = await adminFetch('/api/admin/slips/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'ซิงค์สลิปสำเร็จ!', '✅');
        await loadSlips();
      } else {
        showToast(data.message || 'ซิงค์ไม่สำเร็จ', '⚠️');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการซิงค์: ' + err.message, '❌');
    } finally {
      btnSyncDriveSlips.disabled = false;
      btnSyncDriveSlips.innerHTML = oldText;
    }
  });
}

window.approveSlip = async function(paymentId, amount) {
  const confirmed = prompt(`กรุณายืนยันยอดเงินที่อนุมัติ (บาท):\n(ระบบจะตัดลดยอดหนี้คงเหลือให้อัตโนมัติ)`, amount || '');
  if (confirmed === null) return;

  const numAmount = parseFloat(confirmed);
  if (isNaN(numAmount) || numAmount <= 0) {
    alert('กรุณาระบุจำนวนเงินที่ถูกต้อง');
    return;
  }

  // Optimistic UI update: instantly mark slip as VERIFIED in local array
  const slip = allSlips.find(s => s.paymentId === paymentId);
  if (slip) {
    slip.verificationStatus = 'VERIFIED';
    slip.amount = numAmount;
    updateSlipBadgeCounts();
    renderSlips();
  }

  showToast('อนุมัติสลิปและปรับยอดหนี้เรียบร้อย...', '✅');
  try {
    const res = await adminFetch('/api/admin/slips/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, confirmedAmount: numAmount })
    });
    const data = await res.json();
    if (data.success) {
      loadStats();
      loadContracts();
    } else {
      showToast(data.message || 'อนุมัติไม่สำเร็จ', '❌');
      loadSlips();
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
    loadSlips();
  }
};

window.rejectSlip = async function(paymentId) {
  const reason = prompt('กรุณาระบุเหตุผลในการปฏิเสธสลิป (จะส่งแจ้งลูกหนี้ทาง LINE):', 'สลิปไม่ถูกต้อง หรือยอดเงินไม่ตรง');
  if (reason === null) return;

  // Optimistic UI update: instantly mark slip as REJECTED in local array
  const slip = allSlips.find(s => s.paymentId === paymentId);
  if (slip) {
    slip.verificationStatus = 'REJECTED';
    slip.adminNote = reason;
    updateSlipBadgeCounts();
    renderSlips();
  }

  showToast('ปฏิเสธสลิปและส่งข้อความแจ้งเตือนแล้ว...', 'ℹ️');
  try {
    const res = await adminFetch('/api/admin/slips/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, reason })
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.message || 'ปฏิเสธไม่สำเร็จ', '❌');
      loadSlips();
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
    loadSlips();
  }
};

// ==============================================================================
// 9. Debtors Directory (Data Table)
// ==============================================================================
async function loadDebtors() {
  if (!debtorsTableBody) return;
  debtorsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">กำลังโหลดรายชื่อลูกหนี้...</td></tr>';

  try {
    const res = await adminFetch('/api/admin/debtors');
    const data = await res.json();

    if (data.success && data.debtors) {
      allDebtors = data.debtors;
      renderDebtorsTable();
    }
  } catch (err) {
    console.error('Error loading debtors:', err);
    debtorsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #EF4444; padding: 20px;">เกิดข้อผิดพลาดในการโหลดลูกหนี้</td></tr>';
  }
}

function renderDebtorsTable() {
  if (!debtorsTableBody) return;

  const query = (debtorSearchInput?.value || '').toLowerCase().trim();
  const filtered = allDebtors.filter(d => {
    return !query ||
      (d.fullName || '').toLowerCase().includes(query) ||
      (d.displayName || '').toLowerCase().includes(query) ||
      (d.userId || '').toLowerCase().includes(query) ||
      (d.phone || '').includes(query);
  });

  if (filtered.length === 0) {
    debtorsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">ไม่พบรายชื่อลูกหนี้</td></tr>';
    return;
  }

  debtorsTableBody.innerHTML = filtered.map(d => {
    const isRemindActive = d.reminderEnabled !== false;
    const profileLabel = isRemindActive ? getProfileName(d.reminderProfileId) : 'ปิดแจ้งเตือน';

    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: #FFFFFF;">${d.fullName || d.displayName || 'คุณลูกค้า'}</div>
          <small style="font-size: 11px; color: var(--text-muted);">${d.displayName || '-'}</small>
        </td>
        <td><span style="font-family: monospace; color: #38BDF8; font-size: 12px;">${d.userId}</span></td>
        <td>${d.phone || '-'}</td>
        <td style="font-size: 12px; color: var(--text-muted);">${d.registeredAt || '-'}</td>
        <td><span class="badge-status active">${d.status || 'ACTIVE'}</span></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge-status ${isRemindActive ? 'active' : 'overdue'}" style="cursor: pointer; font-size: 10.5px;" onclick="openAssignReminderModal('debtor', '${d.userId}', '${d.reminderProfileId || ''}', ${isRemindActive}, '${d.fullName || d.displayName || d.userId}')" title="คลิกเพื่อตั้งค่าแจ้งเตือนลูกหนี้รายนี้">
              ${profileLabel} ⚙️
            </span>
            <label class="switch-toggle" style="transform: scale(0.75);" title="${isRemindActive ? 'เปิดแจ้งเตือนอยู่ (คลิกเพื่อปิด)' : 'ปิดแจ้งเตือนอยู่ (คลิกเพื่อเปิด)'}">
              <input type="checkbox" ${isRemindActive ? 'checked' : ''} onchange="toggleDebtorReminder('${d.userId}', this.checked)">
              <span class="slider-toggle"></span>
            </label>
          </div>
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <button class="topbar-btn" style="padding: 5px 12px; font-size: 12px; margin-right: 6px;" onclick="viewContractsForDebtor('${d.userId}')" title="เปิดดูสัญญาหนี้ของลูกหนี้นี้">
            📑 ดูสัญญา
          </button>
          <button class="topbar-btn primary" style="padding: 5px 12px; font-size: 12px;" onclick="openContractForDebtor('${d.userId}', '${d.fullName || d.displayName || ''}', '${d.phone || ''}', '${d.idCardNumber || ''}')">
            ➕ เปิดสัญญา
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

if (debtorSearchInput) debtorSearchInput.addEventListener('input', renderDebtorsTable);

// ==============================================================================
// 10. Automated Reminder Engine (Settings & Logs)
// ==============================================================================
function initMonthlyDaysChips() {
  if (!monthlyDaysGrid) return;
  monthlyDaysGrid.innerHTML = '';

  for (let i = 1; i <= 31; i++) {
    const chip = document.createElement('div');
    chip.className = 'day-chip' + (selectedMonthlyDays.includes(i) ? ' selected' : '');
    chip.textContent = i;
    chip.addEventListener('click', () => {
      if (selectedMonthlyDays.includes(i)) {
        selectedMonthlyDays = selectedMonthlyDays.filter(d => d !== i);
        chip.classList.remove('selected');
      } else {
        selectedMonthlyDays.push(i);
        selectedMonthlyDays.sort((a, b) => a - b);
        chip.classList.add('selected');
      }
    });
    monthlyDaysGrid.appendChild(chip);
  }
}

async function loadReminderSettings() {
  initMonthlyDaysChips();

  try {
    const res = await adminFetch('/api/admin/reminder/settings');
    const data = await res.json();

    if (data.success && data.settings) {
      const s = data.settings;

      if (cfgEnabled) cfgEnabled.checked = Boolean(s.enabled);
      if (cfgScheduleMode) cfgScheduleMode.value = s.scheduleMode || 'COMBINED';
      if (cfgPrimaryTime) cfgPrimaryTime.value = s.primaryTime || '08:00';
      if (cfgSecondaryEnabled) cfgSecondaryEnabled.checked = Boolean(s.secondaryTimeEnabled);
      if (cfgSecondaryTime) cfgSecondaryTime.value = s.secondaryTime || '18:00';

      // Monthly Schedule
      const m = s.monthlySchedule || {};
      if (cfgMonthlyEnabled) cfgMonthlyEnabled.checked = Boolean(m.enabled);
      if (cfgMonthlyLastDay) cfgMonthlyLastDay.checked = Boolean(m.lastDayOfMonth);
      selectedMonthlyDays = (m.daysOfMonth || [1, 25]).map(Number);
      initMonthlyDaysChips();

      // Due Date Rules
      const r = s.rules || {};
      if (cfgRemindBeforeEnabled) cfgRemindBeforeEnabled.checked = Boolean(r.remindBeforeEnabled);
      if (cfgRemindBeforeDays) cfgRemindBeforeDays.value = r.remindBeforeDays || 1;
      if (cfgRemindDueTodayEnabled) cfgRemindDueTodayEnabled.checked = Boolean(r.remindDueTodayEnabled);
      if (cfgRemindOverdueEnabled) cfgRemindOverdueEnabled.checked = Boolean(r.remindOverdueEnabled);
      if (cfgOverdueFrequency) cfgOverdueFrequency.value = r.overdueFrequency || 'DAILY';

      // Template & Bank
      const t = s.template || {};
      if (cfgTone) cfgTone.value = t.tone || 'POLITE';
      if (cfgCustomHeader) cfgCustomHeader.value = t.customHeader || '';
      if (cfgBankName) cfgBankName.value = t.bankName || '';
      if (cfgAccountNumber) cfgAccountNumber.value = t.accountNumber || '';
      if (cfgAccountName) cfgAccountName.value = t.accountName || '';
      if (cfgPromptPay) cfgPromptPay.value = t.promptPayNumber || '';
      if (cfgCustomFooter) cfgCustomFooter.value = t.customFooter || '';
      if (cfgNotifyAdmin) cfgNotifyAdmin.checked = Boolean(s.notifyAdminOnRun);

      // Update overview badge
      const overviewBadge = document.getElementById('overviewReminderStatusBadge');
      if (overviewBadge) {
        overviewBadge.textContent = s.enabled ? `เปิดใช้งาน (${s.primaryTime || '08:00'} น.)` : 'ปิดการทำงาน';
        overviewBadge.className = s.enabled ? 'badge-status active' : 'badge-status overdue';
      }
    }
  } catch (err) {
    console.error('Error loading reminder settings:', err);
  }
}

async function saveReminderSettings() {
  const payload = {
    enabled: cfgEnabled?.checked,
    scheduleMode: cfgScheduleMode?.value || 'COMBINED',
    primaryTime: cfgPrimaryTime?.value || '08:00',
    secondaryTimeEnabled: cfgSecondaryEnabled?.checked,
    secondaryTime: cfgSecondaryTime?.value || '18:00',
    monthlySchedule: {
      enabled: cfgMonthlyEnabled?.checked,
      daysOfMonth: selectedMonthlyDays,
      lastDayOfMonth: cfgMonthlyLastDay?.checked
    },
    rules: {
      remindBeforeEnabled: cfgRemindBeforeEnabled?.checked,
      remindBeforeDays: Number(cfgRemindBeforeDays?.value) || 1,
      remindDueTodayEnabled: cfgRemindDueTodayEnabled?.checked,
      remindOverdueEnabled: cfgRemindOverdueEnabled?.checked,
      overdueFrequency: cfgOverdueFrequency?.value || 'DAILY'
    },
    template: {
      tone: cfgTone?.value || 'POLITE',
      customHeader: cfgCustomHeader?.value || '',
      bankName: cfgBankName?.value || '',
      accountNumber: cfgAccountNumber?.value || '',
      accountName: cfgAccountName?.value || '',
      promptPayNumber: cfgPromptPay?.value || '',
      customFooter: cfgCustomFooter?.value || ''
    },
    notifyAdminOnRun: cfgNotifyAdmin?.checked
  };

  showToast('กำลังบันทึกการตั้งค่า...', '⏳');

  try {
    const res = await adminFetch('/api/admin/reminder/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('บันทึกการตั้งค่าระบบแจ้งเตือนเรียบร้อยแล้ว!', '✅');
      loadReminderSettings();
    } else {
      showToast(data.message || 'บันทึกไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการบันทึก: ' + err.message, '❌');
  }
}

if (btnSaveReminderSettings) btnSaveReminderSettings.addEventListener('click', saveReminderSettings);
if (btnSaveReminderSettingsTop) btnSaveReminderSettingsTop.addEventListener('click', saveReminderSettings);

if (btnTestPushToAdmin) {
  btnTestPushToAdmin.addEventListener('click', async () => {
    showToast('กำลังส่งตัวอย่าง Flex Message เข้า LINE...', '⏳');
    try {
      const res = await adminFetch('/api/admin/reminder/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: {
            bankName: cfgBankName?.value,
            accountNumber: cfgAccountNumber?.value,
            accountName: cfgAccountName?.value,
            promptPayNumber: cfgPromptPay?.value,
            customHeader: cfgCustomHeader?.value,
            customFooter: cfgCustomFooter?.value
          },
          tone: cfgTone?.value || 'POLITE',
          reminderType: 'DUE_TODAY'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('ส่งตัวอย่างเข้า LINE ของคุณแล้ว!', '📲');
      } else {
        showToast(data.message || 'ส่งตัวอย่างไม่สำเร็จ', '❌');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
    }
  });
}

async function loadReminderLogs() {
  if (!reminderLogsContainer) return;
  reminderLogsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 14px; font-size: 12px;">กำลังโหลดประวัติการแจ้งเตือน...</div>';

  try {
    const res = await adminFetch('/api/admin/reminder/logs');
    const data = await res.json();

    if (data.success && data.logs) {
      const logs = data.logs;
      if (logs.length === 0) {
        reminderLogsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 14px; font-size: 12px;">ยังไม่มีประวัติการส่งแจ้งเตือน</div>';
        return;
      }

      reminderLogsContainer.innerHTML = logs.slice(0, 15).map(l => {
        const isSuccess = l.status === 'SUCCESS';
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 6px; font-size: 12px;">
            <div>
              <strong style="color: #FFFFFF;">${l.debtId}</strong>
              <span style="color: var(--text-muted); font-size: 11px; margin-left: 6px;">[${l.reminderType}]</span>
            </div>
            <div style="text-align: right;">
              <span class="badge-status ${isSuccess ? 'active' : 'overdue'}" style="font-size: 10px;">${l.status}</span>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${l.sentAt || '-'}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('Could not load reminder logs:', err.message);
  }
}

if (btnRefreshLogs) btnRefreshLogs.addEventListener('click', loadReminderLogs);

// ==============================================================================
// 11. Admins Management Hub
// ==============================================================================
async function loadAdmins() {
  if (!adminsTableBody) return;
  adminsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">กำลังโหลดรายชื่อผู้ดูแลระบบ...</td></tr>';

  try {
    const res = await adminFetch('/api/admin/admins');
    const data = await res.json();

    if (data.success && data.admins) {
      allAdminsList = data.admins;
      renderAdminsTable();
    }
  } catch (err) {
    console.error('Error loading admins:', err);
    adminsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #EF4444; padding: 20px;">เกิดข้อผิดพลาดในการโหลดแอดมิน</td></tr>';
  }
}

function renderAdminsTable() {
  if (!adminsTableBody) return;

  const query = (adminSearchInput?.value || '').toLowerCase().trim();
  const filtered = allAdminsList.filter(a => {
    return !query ||
      (a.displayName || '').toLowerCase().includes(query) ||
      (a.userId || '').toLowerCase().includes(query) ||
      (a.phone || '').includes(query);
  });

  if (filtered.length === 0) {
    adminsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">ไม่พบข้อมูลผู้ดูแลระบบ</td></tr>';
    return;
  }

  adminsTableBody.innerHTML = filtered.map(a => {
    const isSuper = a.role === 'SUPER_ADMIN';
    const isActive = a.status === 'ACTIVE';

    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: #FFFFFF;">${a.displayName || 'ผู้ดูแลระบบ'}</div>
          <small style="font-size: 11px; color: var(--text-muted);">${a.note || '-'}</small>
        </td>
        <td><span style="font-family: monospace; color: #38BDF8; font-size: 12px;">${a.userId}</span></td>
        <td><span class="badge-status ${isSuper ? 'due-today' : 'paid'}">${a.role || 'ADMIN'}</span></td>
        <td>${a.phone || '-'}</td>
        <td><span class="badge-status ${isActive ? 'active' : 'overdue'}">${a.status || 'ACTIVE'}</span></td>
        <td style="text-align: center;">
          <button class="btn-action-icon delete" onclick="deleteAdmin('${a.userId}')" title="ลบสิทธิ์แอดมิน">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

if (adminSearchInput) adminSearchInput.addEventListener('input', renderAdminsTable);

if (btnOpenAddAdminModal && modalAdminForm) {
  btnOpenAddAdminModal.addEventListener('click', () => {
    adminManagerForm.reset();
    if (adminFormMode) adminFormMode.value = 'create';
    if (modalAdminTitle) modalAdminTitle.textContent = '➕ เพิ่มผู้ดูแลระบบใหม่';
    modalAdminForm.classList.remove('hidden');
    modalAdminForm.style.display = 'flex';
  });
}

function closeAdminModal() {
  if (modalAdminForm) {
    modalAdminForm.classList.add('hidden');
    modalAdminForm.style.display = 'none';
  }
}

if (btnCloseAdminModal) btnCloseAdminModal.addEventListener('click', closeAdminModal);
if (btnCancelAdminModal) btnCancelAdminModal.addEventListener('click', closeAdminModal);

if (adminManagerForm) {
  adminManagerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      userId: adminInputUserId?.value.trim(),
      displayName: adminInputDisplayName?.value.trim(),
      role: adminInputRole?.value || 'ADMIN',
      phone: adminInputPhone?.value.trim() || '',
      note: '',
      status: adminInputStatus?.value || 'ACTIVE'
    };

    if (!payload.userId) {
      showToast('กรุณาระบุ LINE User ID', '⚠️');
      return;
    }

    try {
      const res = await adminFetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('บันทึกข้อมูลผู้ดูแลระบบสำเร็จ!', '✅');
        closeAdminModal();
        loadAdmins();
      } else {
        showToast(data.message || 'บันทึกไม่สำเร็จ', '❌');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
    }
  });
}

window.deleteAdmin = async function(userId) {
  if (!confirm(`ต้องการลบสิทธิ์ผู้ดูแลระบบของบัญชี ${userId} ใช่หรือไม่?`)) return;

  try {
    const res = await adminFetch(`/api/admin/admins/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('ลบสิทธิ์แอดมินสำเร็จ', '✅');
      loadAdmins();
    } else {
      showToast(data.message || 'ลบไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
};

// ==============================================================================
// 12. Reminder Profiles & Granular Overrides Engine
// ==============================================================================
function getProfileName(profileId) {
  if (!profileId) return 'ค่าเริ่มต้น (Default)';
  const p = allReminderProfiles.find(x => x.profileId === profileId);
  return p ? p.name : profileId;
}

async function loadReminderProfiles() {
  try {
    const res = await adminFetch('/api/admin/reminder/profiles');
    const data = await res.json();
    if (data.success && Array.isArray(data.profiles)) {
      allReminderProfiles = data.profiles;
      renderReminderProfilesGrid();
      updateProfileDropdowns();
    }
  } catch (err) {
    console.warn('Error loading reminder profiles:', err.message);
  }
}

function updateProfileDropdowns() {
  const wizardProf = document.getElementById('wizardReminderProfile');
  const assignProf = document.getElementById('assignProfileSelect');

  const optionsHtml = '<option value="">⚙️ รูปแบบเริ่มต้น (Default Profile)</option>' +
    allReminderProfiles.map(p => `<option value="${p.profileId}">${p.name}${p.isDefault ? ' [เริ่มต้น]' : ''} (${p.frequencyType})</option>`).join('');

  if (wizardProf) {
    const currentVal = wizardProf.value;
    wizardProf.innerHTML = optionsHtml;
    if (currentVal) wizardProf.value = currentVal;
  }
  if (assignProf) assignProf.innerHTML = optionsHtml;
}

function renderReminderProfilesGrid() {
  const grid = document.getElementById('reminderProfilesGrid');
  const countBadge = document.getElementById('badgeProfileCount');
  if (countBadge) countBadge.textContent = `${allReminderProfiles.length} รูปแบบ`;
  if (!grid) return;

  if (allReminderProfiles.length === 0) {
    grid.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px; grid-column: 1 / -1;">ไม่พบรูปแบบการแจ้งเตือน</div>';
    return;
  }

  const freqLabels = {
    DAILY: '📅 รายวัน',
    END_OF_MONTH: '📆 ทุกวันสิ้นเดือน',
    SPECIFIC_DAYS: '🎯 วันที่ระบุของเดือน',
    MONTHLY: '🗓️ รายเดือน',
    DUE_DATE_RELATIVE: '⏳ อิงวันครบกำหนด'
  };

  grid.innerHTML = allReminderProfiles.map(p => {
    const isActive = p.status === 'ACTIVE';
    const isDefault = Boolean(p.isDefault);
    const freqLabel = freqLabels[p.frequencyType] || p.frequencyType;

    let scheduleDetail = '';
    if (p.frequencyType === 'DAILY') {
      const interval = p.scheduleConfig?.dailyInterval || 1;
      scheduleDetail = interval === 1 ? 'ทุกวัน' : `ทุกๆ ${interval} วัน`;
    } else if (p.frequencyType === 'SPECIFIC_DAYS') {
      const days = (p.scheduleConfig?.daysOfMonth || []).join(', ');
      scheduleDetail = `วันที่ ${days}${p.scheduleConfig?.lastDayOfMonth ? ' & สิ้นเดือน' : ''}`;
    } else if (p.frequencyType === 'END_OF_MONTH') {
      scheduleDetail = 'วันสุดท้ายของเดือน';
    } else if (p.frequencyType === 'MONTHLY') {
      scheduleDetail = `ทุกวันที่ ${p.scheduleConfig?.dayOfMonth || 1}`;
    } else {
      scheduleDetail = 'ตามวันครบกำหนด';
    }

    const timeStr = `${p.primaryTime || '08:00'} น.${p.secondaryTime ? ` & ${p.secondaryTime} น.` : ''}`;

    return `
      <div class="profile-card ${isDefault ? 'is-default' : ''} ${!isActive ? 'paused' : ''}">
        <div>
          <div class="profile-card-header">
            <div>
              <div class="profile-card-title">${p.name} ${isDefault ? '<span style="font-size: 10px; color: #38BDF8; font-weight: normal; margin-left: 4px;">★ เริ่มต้น</span>' : ''}</div>
              <div class="profile-card-id">${p.profileId}</div>
            </div>
            <span class="badge-status ${isActive ? 'active' : 'overdue'}" style="font-size: 10px;">
              ${isActive ? 'เปิดใช้งาน' : 'ปิดชั่วคราว'}
            </span>
          </div>

          <div class="profile-card-body">
            <div class="profile-detail-chip">
              <span>${freqLabel}</span> • <span>${scheduleDetail}</span>
            </div>
            <div class="profile-detail-chip">
              <span>⏰ เวลาส่ง:</span> <strong>${timeStr}</strong>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
              โทน: <strong>${p.templateConfig?.tone || 'POLITE'}</strong> | ${p.rulesConfig?.remindDueTodayEnabled ? 'เตือนตรงวัน ' : ''}${p.rulesConfig?.remindBeforeEnabled ? `เตือนล่วงหน้า ${p.rulesConfig?.remindBeforeDays || 1}ว ` : ''}${p.rulesConfig?.remindOverdueEnabled ? 'เตือนเกินกำหนด' : ''}
            </div>
          </div>
        </div>

        <div class="profile-card-footer">
          <label class="switch-toggle" style="transform: scale(0.8);" title="${isActive ? 'คลิกเพื่อปิดชั่วคราว' : 'คลิกเพื่อเปิดใช้งาน'}">
            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleReminderProfileStatus('${p.profileId}', this.checked ? 'ACTIVE' : 'PAUSED')">
            <span class="slider-toggle"></span>
          </label>
          <div class="profile-actions">
            <button class="btn-profile-action" onclick="openEditProfileModal('${p.profileId}')" title="แก้ไขรูปแบบ">
              ✏️ แก้ไข
            </button>
            ${!isDefault ? `
              <button class="btn-profile-action delete" onclick="deleteReminderProfile('${p.profileId}')" title="ลบรูปแบบ">
                🗑️ ลบ
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleReminderProfileStatus = async function(profileId, newStatus) {
  const prof = allReminderProfiles.find(p => p.profileId === profileId);
  if (prof) prof.status = newStatus;
  renderReminderProfilesGrid();

  try {
    const res = await adminFetch(`/api/admin/reminder/profiles/${profileId}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`เปลี่ยนสถานะเป็น ${newStatus === 'ACTIVE' ? 'เปิดใช้งาน' : 'ปิดชั่วคราว'} สำเร็จ`, '✅');
    } else {
      showToast(data.message || 'บันทึกไม่สำเร็จ', '❌');
      loadReminderProfiles();
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
    loadReminderProfiles();
  }
};

window.openCreateProfileModal = function() {
  document.getElementById('formReminderProfile')?.reset();
  document.getElementById('profFormId').value = '';
  document.getElementById('modalProfileTitle').textContent = '➕ สร้างรูปแบบการแจ้งเตือนใหม่';
  selectedModalDays = [];
  initModalDaysChips();
  onProfileFrequencyChange('DAILY');
  document.getElementById('modalReminderProfile')?.classList.add('open');
};

window.openEditProfileModal = function(profileId) {
  const p = allReminderProfiles.find(x => x.profileId === profileId);
  if (!p) return;

  document.getElementById('profFormId').value = p.profileId;
  document.getElementById('modalProfileTitle').textContent = `✏️ แก้ไขรูปแบบ: ${p.name}`;
  document.getElementById('profFormName').value = p.name;
  document.getElementById('profFormFrequency').value = p.frequencyType;
  document.getElementById('profFormPrimaryTime').value = p.primaryTime || '08:00';
  document.getElementById('profFormSecondaryTime').value = p.secondaryTime || '';
  document.getElementById('profFormIsDefault').checked = Boolean(p.isDefault);

  if (p.frequencyType === 'DAILY') {
    document.getElementById('profDailyInterval').value = p.scheduleConfig?.dailyInterval || 1;
  }
  selectedModalDays = (p.scheduleConfig?.daysOfMonth || []).map(Number);
  document.getElementById('profSpecificLastDay').checked = Boolean(p.scheduleConfig?.lastDayOfMonth);
  initModalDaysChips();

  const r = p.rulesConfig || {};
  document.getElementById('profRemindDueToday').checked = Boolean(r.remindDueTodayEnabled !== false);
  document.getElementById('profRemindOverdue').checked = Boolean(r.remindOverdueEnabled !== false);
  document.getElementById('profRemindBefore').checked = Boolean(r.remindBeforeEnabled);
  document.getElementById('profRemindBeforeDays').value = r.remindBeforeDays || 1;

  const t = p.templateConfig || {};
  document.getElementById('profTone').value = t.tone || 'POLITE';
  document.getElementById('profCustomHeader').value = t.customHeader || '';
  document.getElementById('profCustomFooter').value = t.customFooter || '';

  onProfileFrequencyChange(p.frequencyType);
  document.getElementById('modalReminderProfile')?.classList.add('open');
};

window.closeProfileModal = function() {
  document.getElementById('modalReminderProfile')?.classList.remove('open');
};

window.onProfileFrequencyChange = function(type) {
  const dailyBox = document.getElementById('profDailySettings');
  const specBox = document.getElementById('profSpecificDaysSettings');
  if (dailyBox) dailyBox.style.display = type === 'DAILY' ? 'block' : 'none';
  if (specBox) specBox.style.display = (type === 'SPECIFIC_DAYS' || type === 'MONTHLY') ? 'block' : 'none';
};

function initModalDaysChips() {
  const grid = document.getElementById('modalDaysChipsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 1; i <= 31; i++) {
    const chip = document.createElement('div');
    chip.className = 'day-chip' + (selectedModalDays.includes(i) ? ' selected' : '');
    chip.textContent = i;
    chip.addEventListener('click', () => {
      if (selectedModalDays.includes(i)) {
        selectedModalDays = selectedModalDays.filter(d => d !== i);
        chip.classList.remove('selected');
      } else {
        selectedModalDays.push(i);
        selectedModalDays.sort((a, b) => a - b);
        chip.classList.add('selected');
      }
    });
    grid.appendChild(chip);
  }
}

const formReminderProfile = document.getElementById('formReminderProfile');
if (formReminderProfile) {
  formReminderProfile.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('profFormId').value;
    const isEdit = Boolean(id);

    const payload = {
      name: document.getElementById('profFormName').value.trim(),
      frequencyType: document.getElementById('profFormFrequency').value,
      primaryTime: document.getElementById('profFormPrimaryTime').value || '08:00',
      secondaryTime: document.getElementById('profFormSecondaryTime').value || '',
      isDefault: document.getElementById('profFormIsDefault').checked,
      scheduleConfig: {
        dailyInterval: Number(document.getElementById('profDailyInterval').value) || 1,
        daysOfMonth: selectedModalDays,
        lastDayOfMonth: document.getElementById('profSpecificLastDay').checked
      },
      rulesConfig: {
        remindDueTodayEnabled: document.getElementById('profRemindDueToday').checked,
        remindOverdueEnabled: document.getElementById('profRemindOverdue').checked,
        remindBeforeEnabled: document.getElementById('profRemindBefore').checked,
        remindBeforeDays: Number(document.getElementById('profRemindBeforeDays').value) || 1
      },
      templateConfig: {
        tone: document.getElementById('profTone').value,
        customHeader: document.getElementById('profCustomHeader').value.trim(),
        customFooter: document.getElementById('profCustomFooter').value.trim()
      }
    };

    showToast('กำลังบันทึกรูปแบบการแจ้งเตือน...', '⏳');

    try {
      const url = isEdit ? `/api/admin/reminder/profiles/${id}` : '/api/admin/reminder/profiles';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEdit ? 'อัปเดตรูปแบบสำเร็จ!' : 'สร้างรูปแบบการแจ้งเตือนใหม่สำเร็จ!', '✅');
        closeProfileModal();
        await loadReminderProfiles();
      } else {
        showToast(data.message || 'บันทึกไม่สำเร็จ', '❌');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
    }
  });
}

window.deleteReminderProfile = async function(profileId) {
  if (!confirm(`ต้องการลบรูปแบบการแจ้งเตือน ${profileId} ใช่หรือไม่?`)) return;
  showToast('กำลังลบรูปแบบ...', '⏳');
  try {
    const res = await adminFetch(`/api/admin/reminder/profiles/${profileId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('ลบรูปแบบเรียบร้อยแล้ว', '✅');
      await loadReminderProfiles();
    } else {
      showToast(data.message || 'ลบไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
};

window.openAssignReminderModal = function(targetType, targetId, currentProfileId, isEnabled, displayName) {
  document.getElementById('assignTargetType').value = targetType;
  document.getElementById('assignTargetId').value = targetId;
  document.getElementById('assignTargetName').textContent = `${targetType === 'debtor' ? '👤 ลูกหนี้:' : '📑 สัญญา:'} ${displayName}`;
  document.getElementById('modalAssignTitle').textContent = `🔔 ตั้งค่าแจ้งเตือน (${targetType === 'debtor' ? 'ระดับลูกหนี้' : 'ระดับสัญญา'})`;
  
  updateProfileDropdowns();
  document.getElementById('assignProfileSelect').value = currentProfileId || '';
  document.getElementById('assignEnabledCheck').checked = isEnabled !== false;

  document.getElementById('modalAssignReminder')?.classList.add('open');
};

window.closeAssignReminderModal = function() {
  document.getElementById('modalAssignReminder')?.classList.remove('open');
};

const formAssignReminder = document.getElementById('formAssignReminder');
if (formAssignReminder) {
  formAssignReminder.addEventListener('submit', async (e) => {
    e.preventDefault();
    const targetType = document.getElementById('assignTargetType').value;
    const targetId = document.getElementById('assignTargetId').value;
    const reminderProfileId = document.getElementById('assignProfileSelect').value;
    const reminderEnabled = document.getElementById('assignEnabledCheck').checked;

    showToast('กำลังบันทึกการตั้งค่า...', '⏳');

    try {
      const url = targetType === 'debtor'
        ? `/api/admin/debtors/${targetId}/reminder`
        : `/api/admin/contracts/${targetId}/reminder`;

      const res = await adminFetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderProfileId, reminderEnabled })
      });
      const data = await res.json();
      if (data.success) {
        showToast('บันทึกการตั้งค่าแจ้งเตือนเรียบร้อยแล้ว!', '✅');
        closeAssignReminderModal();
        if (targetType === 'debtor') {
          await loadDebtors();
        } else {
          await loadContracts();
        }
      } else {
        showToast(data.message || 'บันทึกไม่สำเร็จ', '❌');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
    }
  });
}

window.toggleContractReminder = async function(debtId, isEnabled) {
  const contract = allContracts.find(c => c.debtId === debtId);
  if (contract) contract.reminderEnabled = isEnabled;
  renderContractsTable();

  try {
    const res = await adminFetch(`/api/admin/contracts/${debtId}/reminder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderEnabled: isEnabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`${isEnabled ? 'เปิด' : 'ปิด'}การแจ้งเตือนสัญญา ${debtId} แล้ว`, '🔔');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
    loadContracts();
  }
};

window.toggleDebtorReminder = async function(userId, isEnabled) {
  const debtor = allDebtors.find(d => d.userId === userId);
  if (debtor) debtor.reminderEnabled = isEnabled;
  renderDebtorsTable();

  try {
    const res = await adminFetch(`/api/admin/debtors/${userId}/reminder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderEnabled: isEnabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`${isEnabled ? 'เปิด' : 'ปิด'}การแจ้งเตือนสำหรับลูกหนี้แล้ว`, '🔔');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
    loadDebtors();
  }
};

const btnOpenCreateProfileModal = document.getElementById('btnOpenCreateProfileModal');
if (btnOpenCreateProfileModal) {
  btnOpenCreateProfileModal.addEventListener('click', openCreateProfileModal);
}

const btnTestTriggerReminderNow = document.getElementById('btnTestTriggerReminderNow');
if (btnTestTriggerReminderNow) {
  btnTestTriggerReminderNow.addEventListener('click', async () => {
    if (!confirm('ต้องการสั่งตรวจเช็กและยิงแจ้งเตือนลูกหนี้ตามเงื่อนไขทันทีใช่หรือไม่?')) return;
    showToast('กำลังประมวลผลการแจ้งเตือน...', '⏳');
    try {
      const res = await adminFetch('/api/reminder/trigger-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRun: true })
      });
      const data = await res.json();
      if (data.success && data.summary) {
        const s = data.summary;
        showToast(`สแกนเสร็จสิ้น: ส่งสำเร็จ ${s.sent} ฉบับ, ข้าม ${s.skipped}, ผิดพลาด ${s.failed}`, '🚀');
        loadReminderLogs();
      } else {
        showToast(data.message || 'การตรวจสอบแจ้งเตือนไม่สำเร็จ', '❌');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
    }
  });
}

// ==============================================================================
// 12b. Theme Management (Vibrant Light SaaS / Obsidian Dark)
// ==============================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('admin_theme') || 'light';
  applyTheme(savedTheme);

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      showToast(`เปลี่ยนธีมเป็น: ${newTheme === 'dark' ? 'โหมดมืด (Dark)' : 'โหมดสว่าง (Light)'}`, '🎨');
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('admin_theme', theme);

  if (themeToggleIcon && themeToggleText) {
    if (theme === 'dark') {
      themeToggleIcon.textContent = '🌙';
      themeToggleText.textContent = 'โหมดมืด';
    } else {
      themeToggleIcon.textContent = '☀️';
      themeToggleText.textContent = 'โหมดสว่าง';
    }
  }
}

// ==============================================================================
// 12. Audit Trail Logs
// ==============================================================================
async function loadAuditLogs() {
  const tableBody = document.getElementById('auditTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 25px; color: var(--text-muted);"><div class="spinner" style="margin: 0 auto 10px;"></div>กำลังโหลดประวัติระบบ...</td></tr>`;

  try {
    const res = await adminFetch('/api/admin/audit-logs');
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
      if (data.data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">ยังไม่มีบันทึกประวัติในระบบ</td></tr>`;
        return;
      }
      tableBody.innerHTML = data.data.map(log => {
        let actionBadge = `<span class="badge-status" style="background: rgba(100,116,139,0.15); color: #64748B;">${log.action}</span>`;
        if (log.action.includes('APPROVE')) actionBadge = `<span class="badge-status active">✅ ${log.action}</span>`;
        if (log.action.includes('REJECT')) actionBadge = `<span class="badge-status overdue">❌ ${log.action}</span>`;
        if (log.action.includes('CREATE')) actionBadge = `<span class="badge-status" style="background: rgba(2,132,199,0.15); color: #0284C7;">➕ ${log.action}</span>`;

        return `
          <tr>
            <td style="font-size: 12px; font-family: monospace; white-space: nowrap;">${log.timestamp || '-'}</td>
            <td><strong>${log.operatorName || log.operatorUserId || '-'}</strong></td>
            <td>${actionBadge}</td>
            <td style="font-family: monospace; font-size: 12px;">${log.targetType ? `${log.targetType}: ${log.targetId}` : '-'}</td>
            <td style="font-size: 12px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.details || ''}">${log.details || '-'}</td>
            <td style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${log.ipAddress || '-'}</td>
          </tr>
        `;
      }).join('');
    } else {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 25px; color: var(--danger);">ไม่สามารถโหลดประวัติระบบได้</td></tr>`;
    }
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 25px; color: var(--danger);">เกิดข้อผิดพลาดในการโหลดประวัติ</td></tr>`;
  }
}

const btnRefreshAuditLogs = document.getElementById('btnRefreshAuditLogs');
if (btnRefreshAuditLogs) {
  btnRefreshAuditLogs.addEventListener('click', () => {
    loadAuditLogs();
    showToast('รีเฟรชประวัติระบบเรียบร้อย', '🔄');
  });
}

// ==============================================================================
// 13. App Initialization
// ==============================================================================
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAdminAuth();
});
