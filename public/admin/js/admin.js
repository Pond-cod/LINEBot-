/**
 * Admin Portal Controller (PC Dashboard & Automation Engine)
 * Fully supports Desktop PC layout, New Contract Wizard, and Flexible Reminder Engine
 */

const LIFF_ID = '2011816015-RfpKwHVZ';
let currentAdminUser = null;
let allContracts = [];
let allDebtors = [];
let allSlips = [];
let allAdminsList = [];
let selectedMonthlyDays = [];

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
  'view-admin-managers': 'จัดการทีมแอดมิน'
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
  if (targetViewId === 'view-admin-new-contract') loadWizardDebtors();
  if (targetViewId === 'view-admin-contracts') loadContracts();
  if (targetViewId === 'view-admin-slips') loadSlips();
  if (targetViewId === 'view-admin-debtors') loadDebtors();
  if (targetViewId === 'view-admin-reminders') {
    loadReminderSettings();
    loadReminderLogs();
  }
  if (targetViewId === 'view-admin-managers') loadAdmins();
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
      if (statRemaining) statRemaining.textContent = formatMoney(s.totalRemaining);
      if (statPendingSlips) statPendingSlips.textContent = `${s.pendingSlipsCount} ใบ`;
      if (statDueToday) statDueToday.textContent = `${s.dueTodayCount} ราย`;
      if (statTotalContracts) statTotalContracts.textContent = `${s.activeDebtsCount} สัญญา`;
      if (statTotalDebtors) statTotalDebtors.textContent = `${s.debtorsCount} คน`;

      if (sidebarContractsBadge) sidebarContractsBadge.textContent = s.activeDebtsCount;
      if (sidebarSlipsBadge) {
        sidebarSlipsBadge.textContent = `${s.pendingSlipsCount} ใบ`;
        sidebarSlipsBadge.style.display = s.pendingSlipsCount > 0 ? 'inline-block' : 'none';
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
  if (prevSendPush) {
    prevSendPush.textContent = sendPush ? '✅ ส่งทันที' : 'ไม่ส่ง';
    prevSendPush.style.color = sendPush ? '#38BDF8' : '#94A3B8';
  }
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
// 7. Contracts Directory (Data Table)
// ==============================================================================
async function loadContracts() {
  if (!contractsTableBody) return;
  contractsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">กำลังโหลดข้อมูลสัญญา...</td></tr>';

  try {
    const res = await adminFetch('/api/admin/contracts');
    const data = await res.json();

    if (data.success && data.contracts) {
      allContracts = data.contracts;
      renderContractsTable();
    }
  } catch (err) {
    console.error('Error loading contracts:', err);
    contractsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #EF4444; padding: 20px;">เกิดข้อผิดพลาดในการโหลดสัญญา</td></tr>';
  }
}

function renderContractsTable() {
  if (!contractsTableBody) return;

  const query = (contractSearchInput?.value || '').toLowerCase().trim();
  const filterStatus = contractFilterStatus?.value || 'ALL';

  const filtered = allContracts.filter(c => {
    const matchQuery = !query || 
      (c.debtId || '').toLowerCase().includes(query) ||
      (c.debtorName || '').toLowerCase().includes(query) ||
      (c.userId || '').toLowerCase().includes(query);

    const matchStatus = filterStatus === 'ALL' || c.debtStatus === filterStatus;
    return matchQuery && matchStatus;
  });

  if (filtered.length === 0) {
    contractsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">ไม่พบสัญญาหนี้ที่ตรงกับเงื่อนไข</td></tr>';
    return;
  }

  contractsTableBody.innerHTML = filtered.map(c => {
    let statusBadge = `<span class="badge-status active">กำลังผ่อน</span>`;
    if (c.debtStatus === 'OVERDUE') statusBadge = `<span class="badge-status overdue">เกินกำหนด</span>`;
    if (c.debtStatus === 'PAID') statusBadge = `<span class="badge-status paid">ชำระครบ</span>`;

    const total = Number(c.totalAmount) || 0;
    const remaining = Number(c.remainingBalance) || 0;
    const paidPercent = total > 0 ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 0;

    return `
      <tr>
        <td><strong style="color: #38BDF8; font-family: monospace;">${c.debtId}</strong></td>
        <td>
          <div style="font-weight: 600; color: #FFFFFF;">${c.debtorName || 'คุณลูกค้า'}</div>
          <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${c.userId}</div>
        </td>
        <td><strong>${formatMoney(total)}</strong></td>
        <td>
          <div style="color: #38BDF8; font-weight: 600;">${formatMoney(remaining)}</div>
          <div style="width: 100px; height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; margin-top: 4px; overflow: hidden;">
            <div style="width: ${paidPercent}%; height: 100%; background: #10B981;"></div>
          </div>
          <span style="font-size: 10px; color: var(--text-muted);">${paidPercent}% ชำระแล้ว</span>
        </td>
        <td><span style="color: #10B981; font-weight: 600;">${formatMoney(c.installmentAmount)}</span></td>
        <td>
          <div style="font-weight: 600; color: #F59E0B;">${c.dueDate || '-'}</div>
          <small style="font-size: 10px; color: var(--text-muted);">รอบ ${c.cycleDays || 30} วัน</small>
        </td>
        <td>${statusBadge}</td>
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

if (contractSearchInput) contractSearchInput.addEventListener('input', renderContractsTable);
if (contractFilterStatus) contractFilterStatus.addEventListener('change', renderContractsTable);
if (btnRefreshContracts) btnRefreshContracts.addEventListener('click', loadContracts);

window.deleteContract = async function(debtId) {
  if (!confirm(`ต้องการลบสัญญา ${debtId} ใช่หรือไม่? ข้อมูลในระบบจะถูกนำออก`)) return;

  try {
    const res = await adminFetch(`/api/admin/contracts/${debtId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('ลบสัญญาสำเร็จ', '✅');
      loadContracts();
      loadStats();
    } else {
      showToast(data.message || 'ลบสัญญาไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการลบสัญญา', '❌');
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
// 8. Slip Verification Hub
// ==============================================================================
async function loadSlips() {
  if (!slipsContainer) return;
  slipsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted); grid-column: 1 / -1;">กำลังโหลดรายการสลิป...</div>';

  try {
    const res = await adminFetch('/api/admin/slips');
    const data = await res.json();

    if (data.success && data.slips) {
      allSlips = data.slips;
      renderSlips();
    }
  } catch (err) {
    console.error('Error loading slips:', err);
    slipsContainer.innerHTML = '<div style="text-align: center; color: #EF4444; padding: 20px; grid-column: 1 / -1;">เกิดข้อผิดพลาดในการโหลดสลิป</div>';
  }
}

function renderSlips() {
  if (!slipsContainer) return;

  if (allSlips.length === 0) {
    slipsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted); grid-column: 1 / -1;">ไม่มีสลิปรอตรวจสอบในขณะนี้</div>';
    return;
  }

  slipsContainer.innerHTML = allSlips.map(s => {
    const isPending = !s.verificationStatus || s.verificationStatus === 'PENDING';
    const statusPill = isPending
      ? `<span class="badge-status due-today">รอตรวจสอบ</span>`
      : (s.verificationStatus === 'APPROVED' ? `<span class="badge-status active">อนุมัติแล้ว</span>` : `<span class="badge-status overdue">ปฏิเสธ</span>`);

    return `
      <div class="slip-card">
        <div class="slip-header">
          <div>
            <div class="slip-debtor-name">${s.debtorName || 'คุณลูกค้า'}</div>
            <div class="slip-meta">สัญญา: <strong>${s.debtId || '-'}</strong> | รหัส: ${s.paymentId}</div>
            <div class="slip-meta">ส่งเมื่อ: ${s.uploadedAt || '-'}</div>
          </div>
          <div>${statusPill}</div>
        </div>

        <div class="slip-preview-box" onclick="window.open('${s.slipViewUrl}', '_blank')">
          <img src="${s.slipViewUrl}" class="slip-preview-img" alt="สลิปโอนเงิน" onerror="this.src='https://via.placeholder.com/300x200?text=Slip+Image'">
        </div>

        <div style="font-size: 13px; margin-bottom: 12px; display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">ยอดเงินที่ระบุ:</span>
          <strong style="color: #10B981; font-size: 15px;">${formatMoney(s.amount)}</strong>
        </div>

        ${isPending ? `
          <div class="slip-actions">
            <button class="btn-slip-approve" onclick="approveSlip('${s.paymentId}', ${s.amount})">
              ✅ อนุมัติ & หักลดยอด
            </button>
            <button class="btn-slip-reject" onclick="rejectSlip('${s.paymentId}')">
              ❌ ปฏิเสธสลิป
            </button>
          </div>
        ` : `
          <div style="font-size: 12px; color: var(--text-muted); text-align: center; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
            บันทึกผลแล้ว: ${s.adminNote || s.verificationStatus}
          </div>
        `}
      </div>
    `;
  }).join('');
}

if (btnRefreshSlips) btnRefreshSlips.addEventListener('click', loadSlips);

window.approveSlip = async function(paymentId, amount) {
  const confirmed = prompt(`กรุณายืนยันยอดเงินที่อนุมัติ (บาท):`, amount || '');
  if (confirmed === null) return;

  const numAmount = parseFloat(confirmed);
  if (isNaN(numAmount) || numAmount <= 0) {
    alert('กรุณาระบุจำนวนเงินที่ถูกต้อง');
    return;
  }

  showToast('กำลังอนุมัติสลิปและปรับยอดหนี้...', '⏳');
  try {
    const res = await adminFetch('/api/admin/slips/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, confirmedAmount: numAmount })
    });
    const data = await res.json();
    if (data.success) {
      showToast('อนุมัติสลิปและส่งข้อความแจ้งลูกหนี้สำเร็จ!', '✅');
      loadSlips();
      loadStats();
    } else {
      showToast(data.message || 'อนุมัติไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
};

window.rejectSlip = async function(paymentId) {
  const reason = prompt('กรุณาระบุเหตุผลในการปฏิเสธสลิป (จะส่งแจ้งลูกหนี้ทาง LINE):', 'สลิปไม่ถูกต้อง หรือยอดเงินไม่ตรง');
  if (reason === null) return;

  showToast('กำลังปฏิเสธสลิป...', '⏳');
  try {
    const res = await adminFetch('/api/admin/slips/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, reason })
    });
    const data = await res.json();
    if (data.success) {
      showToast('ปฏิเสธสลิปและส่งข้อความแจ้งเตือนแล้ว', '✅');
      loadSlips();
    } else {
      showToast(data.message || 'ปฏิเสธไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
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
    debtorsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">ไม่พบรายชื่อลูกหนี้</td></tr>';
    return;
  }

  debtorsTableBody.innerHTML = filtered.map(d => {
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
        <td style="text-align: center;">
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
// 12. App Initialization
// ==============================================================================
window.addEventListener('DOMContentLoaded', () => {
  initAdminAuth();
});
