// Admin Portal JavaScript Controller (v4.0 - LINE User ID Access Control)
const LIFF_ID = '2011816015-RfpKwHVZ';
let currentAdminUser = null;

// Auth Overlay Elements
const adminAuthOverlay = document.getElementById('adminAuthOverlay');
const authCheckingState = document.getElementById('authCheckingState');
const authLoginState = document.getElementById('authLoginState');
const authDeniedState = document.getElementById('authDeniedState');
const authSetupState = document.getElementById('authSetupState');
const btnAdminLoginLine = document.getElementById('btnAdminLoginLine');
const btnSwitchAccount = document.getElementById('btnSwitchAccount');
const btnProceedSetup = document.getElementById('btnProceedSetup');
const deniedDisplayName = document.getElementById('deniedDisplayName');
const deniedUserId = document.getElementById('deniedUserId');
const btnCopyDeniedId = document.getElementById('btnCopyDeniedId');
const setupDisplayName = document.getElementById('setupDisplayName');
const setupUserId = document.getElementById('setupUserId');
const btnCopySetupId = document.getElementById('btnCopySetupId');
const adminSubtitle = document.getElementById('adminSubtitle');
const btnAdminLogout = document.getElementById('btnAdminLogout');

// Nav & Views Elements
const navItems = document.querySelectorAll('.nav-item');
const subViews = document.querySelectorAll('.sub-view');

// Stats Elements
const statRemaining = document.getElementById('statRemaining');
const statPendingSlips = document.getElementById('statPendingSlips');
const statDueToday = document.getElementById('statDueToday');
const statTotalContracts = document.getElementById('statTotalContracts');
const statTotalDebtors = document.getElementById('statTotalDebtors');
const btnTriggerCronNow = document.getElementById('btnTriggerCronNow');

// Contracts Elements
const createContractForm = document.getElementById('createContractForm');
const contractsListContainer = document.getElementById('contractsListContainer');
const contractsCount = document.getElementById('contractsCount');

// Slips Elements
const slipsContainer = document.getElementById('slipsContainer');
const pendingSlipsBadge = document.getElementById('pendingSlipsBadge');

// Reminders Elements
const manualDebtIdInput = document.getElementById('manualDebtIdInput');
const btnManualPushSingle = document.getElementById('btnManualPushSingle');

// Debtors Elements
const debtorsCountBadge = document.getElementById('debtorsCountBadge');
const debtorSearchInput = document.getElementById('debtorSearchInput');
const debtorsListContainer = document.getElementById('debtorsListContainer');
let allDebtors = [];

// Admin Managers Elements
const adminsCountBadge = document.getElementById('adminsCountBadge');
const adminSearchInput = document.getElementById('adminSearchInput');
const adminsListContainer = document.getElementById('adminsListContainer');
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
const adminInputNote = document.getElementById('adminInputNote');
const adminInputStatus = document.getElementById('adminInputStatus');
const modalAdminTitle = document.getElementById('modalAdminTitle');
const btnSelectFromDebtors = document.getElementById('btnSelectFromDebtors');
let allAdminsList = [];

// Toast
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

/**
 * ฟังก์ชันเรียก API สำหรับ Admin โดยส่ง x-line-userid ไปตรวจสอบสิทธิ์อัตโนมัติ
 */
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

/**
 * 1. ตรวจสอบสิทธิ์การเข้าใช้งาน Admin ผ่าน LIFF และ LINE User ID
 */
async function initAdminAuth() {
  try {
    await liff.init({ liffId: LIFF_ID });

    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      currentAdminUser = profile;

      // ตรวจสอบสิทธิ์กับ Backend API
      const res = await fetch(`/api/admin/verify-access?userId=${encodeURIComponent(profile.userId)}`);
      const authData = await res.json();

      if (authData.isConfigured && authData.authorized) {
        // มีสิทธิ์ถูกต้อง -> ปลดล็อกหน้าแอดมิน
        unlockAdminView(profile);
      } else if (!authData.isConfigured) {
        // ยังไม่มีการตั้งค่า ADMIN_LINE_USER_IDS ในระบบ -> โชว์หน้า Setup เพื่อแจ้งให้กำหนดสิทธิ์
        showSetupState(profile);
      } else {
        // บัญชีไม่อยู่ในรายการที่อนุญาต -> ปฏิเสธการเข้าถึง
        showDeniedState(profile);
      }
    } else {
      if (liff.isInClient()) {
        // หากเปิดใน LINE App ให้ redirect login อัตโนมัติ
        liff.login({ redirectUri: window.location.href });
      } else {
        // เปิดผ่านเบราว์เซอร์ทั่วไป ให้แสดงปุ่มล็อกอิน LINE
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
  if (adminSubtitle) adminSubtitle.textContent = `แอดมิน: ${profile.displayName}`;
  if (btnAdminLogout) btnAdminLogout.style.display = 'block';
  loadStats();
}

function showLoginState() {
  if (authCheckingState) authCheckingState.style.display = 'none';
  if (authDeniedState) authDeniedState.style.display = 'none';
  if (authSetupState) authSetupState.style.display = 'none';
  if (authLoginState) authLoginState.style.display = 'block';
}

function showDeniedState(profile) {
  if (deniedDisplayName) deniedDisplayName.textContent = profile.displayName || '-';
  if (deniedUserId) deniedUserId.textContent = profile.userId || '-';
  if (authCheckingState) authCheckingState.style.display = 'none';
  if (authLoginState) authLoginState.style.display = 'none';
  if (authSetupState) authSetupState.style.display = 'none';
  if (authDeniedState) authDeniedState.style.display = 'block';
}

function showSetupState(profile) {
  if (setupDisplayName) setupDisplayName.textContent = profile.displayName || '-';
  if (setupUserId) setupUserId.textContent = profile.userId || '-';
  if (authCheckingState) authCheckingState.style.display = 'none';
  if (authLoginState) authLoginState.style.display = 'none';
  if (authDeniedState) authDeniedState.style.display = 'none';
  if (authSetupState) authSetupState.style.display = 'block';
}

// ผูก Event Listeners สำหรับระบบความปลอดภัย
if (btnAdminLoginLine) {
  btnAdminLoginLine.addEventListener('click', () => {
    liff.login({ redirectUri: window.location.href });
  });
}

if (btnAdminLogout) {
  btnAdminLogout.addEventListener('click', () => {
    if (confirm('ต้องการออกจากระบบผู้ดูแลระบบใช่หรือไม่?')) {
      liff.logout();
      window.location.reload();
    }
  });
}

if (btnSwitchAccount) {
  btnSwitchAccount.addEventListener('click', () => {
    liff.logout();
    liff.login({ redirectUri: window.location.href });
  });
}

if (btnProceedSetup) {
  btnProceedSetup.addEventListener('click', () => {
    unlockAdminView(currentAdminUser || { displayName: 'Admin' });
  });
}

if (btnCopyDeniedId) {
  btnCopyDeniedId.addEventListener('click', () => {
    copyText(currentAdminUser?.userId, 'คัดลอก LINE User ID เรียบร้อยแล้ว');
  });
}

if (btnCopySetupId) {
  btnCopySetupId.addEventListener('click', () => {
    copyText(currentAdminUser?.userId, 'คัดลอก LINE User ID เรียบร้อยแล้ว');
  });
}

/**
 * 2. ควบคุมการสลับ Sub-views
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

  // โหลดข้อมูลตามหน้า
  if (targetViewId === 'view-admin-overview') loadStats();
  if (targetViewId === 'view-admin-debtors') loadDebtors();
  if (targetViewId === 'view-admin-contracts') loadContracts();
  if (targetViewId === 'view-admin-slips') loadSlips();
  if (targetViewId === 'view-admin-managers') loadAdmins();
}

window.switchView = switchView;

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const target = item.getAttribute('data-target');
    switchView(target);
  });
});

function showToast(msg, icon = 'ℹ️') {
  toastMessage.textContent = msg;
  toastIcon.textContent = icon;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

/**
 * 3. โหลดสถิติภาพรวม (Overview)
 */
async function loadStats() {
  try {
    const res = await adminFetch('/api/admin/stats');
    const json = await res.json();

    if (json.success && json.stats) {
      const s = json.stats;
      statRemaining.textContent = `฿${Number(s.totalRemaining).toLocaleString()}`;
      statPendingSlips.textContent = `${s.pendingSlipsCount} ใบ`;
      statDueToday.textContent = `${s.dueTodayCount} ราย`;
      statTotalContracts.textContent = `${s.totalContracts}`;
      if (statTotalDebtors) statTotalDebtors.textContent = `${s.totalDebtors || 0} คน`;
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

/**
 * 4. โหลดและแสดงรายการสัญญา (Contracts)
 */
async function loadContracts() {
  try {
    contractsListContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">กำลังโหลด...</div>';
    const res = await adminFetch('/api/admin/contracts');
    const json = await res.json();

    if (json.success && json.contracts) {
      const contracts = json.contracts;
      contractsCount.textContent = `${contracts.length} รายการ`;

      if (contracts.length === 0) {
        contractsListContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">ยังไม่มีสัญญาในระบบ</div>';
        return;
      }

      contractsListContainer.innerHTML = contracts.map(c => {
        let statusClass = 'active';
        if (c.debtStatus === 'OVERDUE') statusClass = 'overdue';
        if (c.debtStatus === 'PAID') statusClass = 'paid';

        return `
          <div class="contract-card">
            <div class="contract-top">
              <span class="contract-id">${c.debtId}</span>
              <span class="contract-status ${statusClass}">${c.debtStatus}</span>
            </div>
            <div class="contract-body">
              <div>ผู้กู้: <strong>${c.debtorName}</strong> (${c.debtorPhone || '-'})</div>
              <div>ยอดคงเหลือ: <strong style="color: var(--primary);">฿${Number(c.remainingBalance).toLocaleString()}</strong> / ยอดรวม ฿${Number(c.totalAmount).toLocaleString()}</div>
              <div>ค่างวด: ฿${Number(c.installmentAmount).toLocaleString()} | กำหนดชำระ: <strong style="color: #EF4444;">${c.dueDate || '-'}</strong></div>
            </div>
            <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
              <button onclick="sendSingleReminder('${c.debtId}')" style="background: none; border: 1px solid var(--surface-border); color: var(--text-muted); font-size: 11px; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                🔔 ส่งแจ้งเตือน
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error loading contracts:', err);
    contractsListContainer.innerHTML = '<div style="text-align: center; color: #EF4444; padding: 20px;">เกิดข้อผิดพลาดในการโหลดสัญญา</div>';
  }
}

/**
 * 5. สร้างสัญญาใหม่
 */
createContractForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    userId: document.getElementById('newUserId').value.trim(),
    debtorName: document.getElementById('newDebtorName').value.trim(),
    phone: document.getElementById('newPhone').value.trim(),
    totalAmount: document.getElementById('newTotalAmount').value,
    installmentAmount: document.getElementById('newInstallmentAmount').value,
    dueDate: document.getElementById('newDueDate').value,
    cycleDays: document.getElementById('newCycleDays').value
  };

  try {
    const res = await adminFetch('/api/admin/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (json.success) {
      showToast('สร้างสัญญาใหม่สำเร็จ!', '✅');
      createContractForm.reset();
      loadContracts();
      loadStats();
    } else {
      showToast(json.message || 'สร้างสัญญาไม่สำเร็จ', '❌');
    }
  } catch (err) {
    console.error('Error creating contract:', err);
    showToast('เกิดข้อผิดพลาดในการสร้างสัญญา', '❌');
  }
});

/**
 * 6. โหลดและจัดการสลิป (Slips Approval Hub)
 */
async function loadSlips() {
  try {
    slipsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">กำลังโหลดรายการสลิป...</div>';
    const res = await adminFetch('/api/admin/slips');
    const json = await res.json();

    if (json.success && json.slips) {
      const slips = json.slips;
      const pendingSlips = slips.filter(s => s.verificationStatus === 'PENDING');
      pendingSlipsBadge.textContent = `รอตรวจ ${pendingSlips.length} ใบ`;

      if (slips.length === 0) {
        slipsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">ยังไม่มีสลิปส่งเข้ามาในระบบ</div>';
        return;
      }

      slipsContainer.innerHTML = slips.map(s => {
        const isPending = s.verificationStatus === 'PENDING';
        return `
          <div class="slip-card">
            <div class="slip-header">
              <div>
                <div class="slip-debtor-name">${s.debtorName}</div>
                <div class="slip-meta">รหัส: ${s.paymentId} | 📅 ${s.uploadedAt}</div>
              </div>
              <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: ${isPending ? 'rgba(245, 158, 11, 0.2)' : s.verificationStatus === 'VERIFIED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${isPending ? '#F59E0B' : s.verificationStatus === 'VERIFIED' ? '#10B981' : '#EF4444'};">
                ${s.verificationStatus === 'VERIFIED' ? 'อนุมัติแล้ว' : s.verificationStatus === 'REJECTED' ? 'ปฏิเสธ' : 'รอตรวจสอบ'}
              </span>
            </div>

            ${s.slipViewUrl ? `
              <div class="slip-preview-box" onclick="window.open('${s.slipViewUrl}', '_blank')">
                <img src="${s.slipViewUrl}" alt="Slip" class="slip-preview-img" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'150\' viewBox=\'0 0 300 150\' fill=\'%231E293B\'><text x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%2394A3B8\' font-family=\'sans-serif\' font-size=\'14\'>คลิกเพื่อเปิดดูสลิปใน Google Drive</text></svg>';">
              </div>
            ` : ''}

            <div style="font-size: 13px; margin: 8px 0; color: #FFFFFF;">
              ยอดระบุ: <strong>฿${Number(s.amount || 0).toLocaleString()}</strong>
            </div>

            ${isPending ? `
              <div class="slip-actions">
                <button class="btn-approve" onclick="approveSlip('${s.paymentId}', ${s.amount || 0})">
                  ✅ อนุมัติ & หักยอดหนี้
                </button>
                <button class="btn-reject" onclick="rejectSlip('${s.paymentId}')">
                  ❌ ไม่อนุมัติ
                </button>
              </div>
            ` : `
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
                บันทึก: ${s.adminNote || '-'}
              </div>
            `}
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error loading slips:', err);
    slipsContainer.innerHTML = '<div style="text-align: center; color: #EF4444; padding: 40px;">เกิดข้อผิดพลาดในการโหลดสลิป</div>';
  }
}

/**
 * 7. อนุมัติสลิป
 */
window.approveSlip = async function(paymentId, currentAmount) {
  const confirmed = prompt(`ยืนยันยอดเงินที่จะตัดออกจากยอดหนี้ (บาท):`, currentAmount || '');
  if (confirmed === null) return;

  const amount = Number(confirmed);
  if (isNaN(amount) || amount <= 0) {
    alert('กรุณากรอกยอดเงินที่ถูกต้องครับ');
    return;
  }

  try {
    const res = await adminFetch('/api/admin/slips/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, confirmedAmount: amount })
    });
    const json = await res.json();
    if (json.success) {
      showToast('อนุมัติสลิปและปรับลดยอดหนี้แล้ว!', '✅');
      loadSlips();
      loadStats();
    } else {
      showToast(json.message || 'อนุมัติไม่สำเร็จ', '❌');
    }
  } catch (err) {
    console.error('Error approving slip:', err);
    showToast('เกิดข้อผิดพลาด', '❌');
  }
};

/**
 * 8. ปฏิเสธสลิป
 */
window.rejectSlip = async function(paymentId) {
  const reason = prompt('ระบุเหตุผลที่ปฏิเสธสลิป:', 'สลิปไม่ถูกต้องหรือยอดเงินไม่ตรง');
  if (reason === null) return;

  try {
    const res = await adminFetch('/api/admin/slips/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, reason })
    });
    const json = await res.json();
    if (json.success) {
      showToast('ปฏิเสธสลิปเรียบร้อยแล้ว', 'ℹ️');
      loadSlips();
      loadStats();
    } else {
      showToast(json.message || 'ปฏิเสธไม่สำเร็จ', '❌');
    }
  } catch (err) {
    console.error('Error rejecting slip:', err);
    showToast('เกิดข้อผิดพลาด', '❌');
  }
};

/**
 * 9. ยิงแจ้งเตือน 08:00 น. ทันที
 */
btnTriggerCronNow.addEventListener('click', async () => {
  btnTriggerCronNow.disabled = true;
  btnTriggerCronNow.textContent = '⏳ กำลังประมวลผลและยิงข้อความ...';

  try {
    const res = await adminFetch('/api/reminder/trigger-now', { method: 'POST' });
    const json = await res.json();

    if (json.success) {
      const s = json.summary;
      showToast(`ยิงเตือนสำเร็จ ${s.sent} ราย (ข้าม ${s.skipped} ราย)`, '🚀');
    } else {
      showToast('เกิดข้อผิดพลาดในการยิงแจ้งเตือน', '❌');
    }
  } catch (err) {
    showToast('ไม่สามารถเชื่อมต่อระบบแจ้งเตือนได้', '❌');
  } finally {
    btnTriggerCronNow.disabled = false;
    btnTriggerCronNow.textContent = '🚀 สั่งยิงแจ้งเตือนวันนี้ทันที (Manual Trigger)';
  }
});

/**
 * 10. ยิงแจ้งเตือนรายคน
 */
window.sendSingleReminder = async function(debtId) {
  if (!confirm(`ต้องการส่ง LINE แจ้งเตือนยอดหนี้สัญญา ${debtId} ใช่หรือไม่?`)) return;

  try {
    const res = await adminFetch(`/api/admin/remind/${encodeURIComponent(debtId)}`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message || 'ส่งแจ้งเตือนเรียบร้อยแล้ว', '✅');
    } else {
      showToast(json.message || 'ส่งแจ้งเตือนไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด', '❌');
  }
};

btnManualPushSingle.addEventListener('click', () => {
  const debtId = manualDebtIdInput.value.trim();
  if (!debtId) {
    showToast('กรุณาระบุรหัสสัญญา', '⚠️');
    return;
  }
  window.sendSingleReminder(debtId);
});

/**
 * 11. จัดการรายชื่อลูกหนี้ (Debtors Management)
 */
async function loadDebtors() {
  if (!debtorsListContainer) return;
  try {
    debtorsListContainer.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-muted);"><div class="spinner"></div> กำลังโหลดรายชื่อลูกหนี้...</div>';
    const res = await adminFetch('/api/admin/debtors');
    const json = await res.json();

    if (json.success && json.debtors) {
      allDebtors = json.debtors;
      if (debtorsCountBadge) debtorsCountBadge.textContent = `${allDebtors.length} คน`;
      if (statTotalDebtors) statTotalDebtors.textContent = `${allDebtors.length} คน`;
      renderDebtors(allDebtors);
    } else {
      debtorsListContainer.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-muted);">ไม่สามารถโหลดข้อมูลลูกหนี้ได้</div>';
    }
  } catch (err) {
    console.error('Error loading debtors:', err);
    debtorsListContainer.innerHTML = '<div style="text-align: center; padding: 30px; color: #EF4444;">เกิดข้อผิดพลาดในการโหลด</div>';
  }
}

function renderDebtors(list) {
  if (!debtorsListContainer) return;

  if (!list || list.length === 0) {
    debtorsListContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
        <div style="font-size: 44px; margin-bottom: 12px;">👥</div>
        <div style="font-weight: 600; color: #FFFFFF; font-size: 15px; margin-bottom: 4px;">ยังไม่มีรายชื่อลูกหนี้ในระบบ</div>
        <div style="font-size: 12px; line-height: 1.6;">เมื่อมีผู้ใช้ล็อกอินผ่าน LINE Client Portal หรือสร้างสัญญา รายชื่อจะเข้ามาแสดงที่นี่โดยอัตโนมัติ</div>
      </div>
    `;
    return;
  }

  debtorsListContainer.innerHTML = list.map(d => {
    const displayName = d.displayName || 'ผู้ใช้ LINE';
    const fullName = d.fullName && d.fullName !== d.displayName ? d.fullName : '';
    const initial = (displayName.charAt(0) || 'U').toUpperCase();

    return `
      <div class="debtor-card">
        <div class="debtor-top">
          <div class="debtor-avatar-name">
            <div class="debtor-avatar-circle">${initial}</div>
            <div>
              <div class="debtor-name">${displayName}</div>
              ${fullName ? `<div class="debtor-line-name">👤 ชื่อจริง: ${fullName}</div>` : ''}
              <div class="debtor-line-name" style="font-family: monospace; color: #94A3B8;">LINE ID: ${d.userId}</div>
            </div>
          </div>
          <span style="font-size: 10px; padding: 2px 8px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); color: #10B981; font-weight: 600;">
            ${d.status || 'ACTIVE'}
          </span>
        </div>

        <div class="debtor-meta-row">
          <span>📞 เบอร์: <strong>${d.phone || 'ยังไม่ระบุ'}</strong></span>
          <span>📅 วันที่เข้าใช้: <strong>${d.registeredAt || '-'}</strong></span>
        </div>

        <div class="debtor-actions">
          <button class="btn-debtor-action btn-debtor-contract" onclick="openContractForUser('${d.userId}', '${(d.fullName || d.displayName || '').replace(/'/g, "\\'")}', '${d.phone || ''}')">
            ➕ เปิดสัญญาใหม่
          </button>
          <button class="btn-debtor-action btn-debtor-copy" onclick="copyText('${d.userId}', 'คัดลอก LINE ID เรียบร้อยแล้ว')">
            📋 คัดลอก ID
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.openContractForUser = function(userId, name, phone) {
  switchView('view-admin-contracts');
  const newUserIdInput = document.getElementById('newUserId');
  const newDebtorNameInput = document.getElementById('newDebtorName');
  const newPhoneInput = document.getElementById('newPhone');
  const newTotalAmountInput = document.getElementById('newTotalAmount');

  if (newUserIdInput) newUserIdInput.value = userId;
  if (newDebtorNameInput) newDebtorNameInput.value = name;
  if (newPhoneInput) newPhoneInput.value = phone;

  showToast('นำข้อมูลลูกหนี้ใส่ในฟอร์มแล้ว', '📝');
  if (newTotalAmountInput) {
    setTimeout(() => newTotalAmountInput.focus(), 250);
  }
};

window.copyText = function(text, successMsg = 'คัดลอกแล้ว') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg, '📋');
  }).catch(() => {
    showToast('ข้อความ: ' + text, '📋');
  });
};

if (debtorSearchInput) {
  debtorSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderDebtors(allDebtors);
      return;
    }
    const filtered = allDebtors.filter(d => 
      (d.displayName && d.displayName.toLowerCase().includes(q)) ||
      (d.fullName && d.fullName.toLowerCase().includes(q)) ||
      (d.userId && d.userId.toLowerCase().includes(q)) ||
      (d.phone && d.phone.includes(q))
    );
    renderDebtors(filtered);
  });
}

// ==============================================================================
// 7. จัดการผู้ดูแลระบบ (Admin Managers Management)
// ==============================================================================

async function loadAdmins() {
  if (!adminsListContainer) return;
  adminsListContainer.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-muted);">กำลังโหลดรายชื่อผู้ดูแลระบบ...</div>';

  try {
    const res = await adminFetch('/api/admin/admins');
    const data = await res.json();

    if (data.success && Array.isArray(data.admins)) {
      allAdminsList = data.admins;
      if (adminsCountBadge) adminsCountBadge.textContent = `${allAdminsList.length} คน`;
      renderAdmins(allAdminsList);
    } else {
      adminsListContainer.innerHTML = '<div style="text-align: center; padding: 30px; color: #EF4444;">ไม่สามารถโหลดข้อมูลแอดมินได้</div>';
    }
  } catch (err) {
    console.error('Error loading admins:', err);
    adminsListContainer.innerHTML = '<div style="text-align: center; padding: 30px; color: #EF4444;">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
  }
}

function renderAdmins(admins) {
  if (!adminsListContainer) return;

  if (!admins || admins.length === 0) {
    adminsListContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); border: 1px dashed var(--surface-border);">
        <div style="font-size: 32px; margin-bottom: 8px;">🛡️</div>
        <div style="font-size: 14px; font-weight: 600; color: #FFFFFF; margin-bottom: 4px;">ยังไม่มีรายชื่อผู้ดูแลระบบในชีต admin</div>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
          คุณสามารถกดปุ่ม "เพิ่มแอดมิน" เพื่อเพิ่มสิทธิ์ให้บัญชี LINE ของคุณหรือทีมงานได้ทันที
        </p>
        <button class="btn-primary-admin" onclick="openAddAdminModal()" style="display: inline-block; width: auto; padding: 8px 18px; font-size: 13px;">
          ➕ เพิ่มผู้ดูแลระบบคนแรก
        </button>
      </div>
    `;
    return;
  }

  adminsListContainer.innerHTML = admins.map(admin => {
    const isSuper = admin.isSuperAdmin || admin.role === 'SUPER_ADMIN';
    const isActive = admin.status === 'ACTIVE';
    const roleBadge = isSuper
      ? '<span class="badge-role-super">👑 Super Admin</span>'
      : '<span class="badge-role-admin">🛡️ Admin</span>';
    const statusBadge = isActive
      ? '<span class="badge-status-active">🟢 ใช้งานอยู่</span>'
      : '<span class="badge-status-inactive">⚪ ระงับสิทธิ์</span>';

    const safeName = (admin.displayName || 'ผู้ดูแลระบบ').replace(/'/g, "\\'");
    const isCurrentUser = currentAdminUser && currentAdminUser.userId === admin.userId;

    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="admin-avatar">
              ${isSuper ? '👑' : '🛡️'}
            </div>
            <div>
              <div style="font-size: 14px; font-weight: 600; color: #FFFFFF; display: flex; align-items: center; gap: 6px;">
                <span>${admin.displayName || 'ไม่ระบุชื่อ'}</span>
                ${isCurrentUser ? '<span style="font-size: 10px; background: rgba(255,255,255,0.1); padding: 1px 6px; border-radius: 4px; color: #38BDF8;">คุณ</span>' : ''}
              </div>
              <div style="font-size: 11px; font-family: monospace; color: #94A3B8; margin-top: 2px;">
                ${admin.userId}
              </div>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            ${roleBadge}
            ${statusBadge}
          </div>
        </div>

        ${(admin.phone || admin.note) ? `
          <div style="font-size: 11.5px; color: var(--text-muted); background: rgba(0,0,0,0.15); padding: 6px 10px; border-radius: 6px; margin: 8px 0; display: flex; flex-wrap: wrap; gap: 12px;">
            ${admin.phone ? `<div>📞 ${admin.phone}</div>` : ''}
            ${admin.note ? `<div>📝 ${admin.note}</div>` : ''}
          </div>
        ` : ''}

        <div class="admin-card-actions">
          <button class="btn-card-action btn-action-edit" onclick="openEditAdminModal('${admin.userId}')">
            ✏️ แก้ไข
          </button>
          <button class="btn-card-action btn-action-delete" onclick="confirmDeleteAdmin('${admin.userId}', '${safeName}')">
            🗑️ ลบสิทธิ์
          </button>
          <button class="btn-card-action" style="background: rgba(255,255,255,0.06); color: #94A3B8;" onclick="copyText('${admin.userId}', 'คัดลอก LINE ID แอดมินแล้ว')">
            📋 คัดลอก ID
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.openAddAdminModal = function() {
  if (!modalAdminForm) return;
  if (adminManagerForm) adminManagerForm.reset();
  if (adminFormMode) adminFormMode.value = 'create';
  if (modalAdminTitle) modalAdminTitle.textContent = '➕ เพิ่มผู้ดูแลระบบใหม่';
  if (adminInputUserId) {
    adminInputUserId.readOnly = false;
    adminInputUserId.style.opacity = '1';
  }
  if (adminInputStatus) adminInputStatus.value = 'ACTIVE';
  if (adminInputRole) adminInputRole.value = 'ADMIN';

  // หากปัจจุบันล็อกอินอยู่ และยังไม่มีในชีต อำนวยความสะดวกกรอกอัตโนมัติ
  if (currentAdminUser && (!allAdminsList.some(a => a.userId === currentAdminUser.userId))) {
    if (adminInputUserId) adminInputUserId.value = currentAdminUser.userId;
    if (adminInputDisplayName) adminInputDisplayName.value = currentAdminUser.displayName || '';
    if (adminInputRole) adminInputRole.value = 'SUPER_ADMIN';
  }

  modalAdminForm.classList.remove('hidden');
};

window.openEditAdminModal = function(userId) {
  const admin = allAdminsList.find(a => a.userId === userId);
  if (!admin || !modalAdminForm) return;

  if (adminFormMode) adminFormMode.value = 'edit';
  if (modalAdminTitle) modalAdminTitle.textContent = '✏️ แก้ไขข้อมูลผู้ดูแลระบบ';
  if (adminInputUserId) {
    adminInputUserId.value = admin.userId;
    adminInputUserId.readOnly = true;
    adminInputUserId.style.opacity = '0.7';
  }
  if (adminInputDisplayName) adminInputDisplayName.value = admin.displayName || '';
  if (adminInputRole) adminInputRole.value = admin.role || 'ADMIN';
  if (adminInputPhone) adminInputPhone.value = admin.phone || '';
  if (adminInputNote) adminInputNote.value = admin.note || '';
  if (adminInputStatus) adminInputStatus.value = admin.status || 'ACTIVE';

  modalAdminForm.classList.remove('hidden');
};

function closeAdminModal() {
  if (modalAdminForm) modalAdminForm.classList.add('hidden');
}

if (btnCloseAdminModal) btnCloseAdminModal.addEventListener('click', closeAdminModal);
if (btnCancelAdminModal) btnCancelAdminModal.addEventListener('click', closeAdminModal);
if (btnOpenAddAdminModal) btnOpenAddAdminModal.addEventListener('click', window.openAddAdminModal);

if (btnSelectFromDebtors) {
  btnSelectFromDebtors.addEventListener('click', () => {
    if (allDebtors.length === 0) {
      showToast('ไม่มีรายชื่อลูกหนี้ในระบบ', 'ℹ️');
      return;
    }
    const promptText = allDebtors.slice(0, 10).map((d, i) => `${i + 1}. ${d.displayName || d.fullName} (${d.userId.slice(0, 8)}...)`).join('\n');
    const idx = prompt(`เลือกลำดับลูกหนี้ที่จะเพิ่มเป็นแอดมิน:\n${promptText}`);
    if (idx) {
      const selected = allDebtors[parseInt(idx) - 1];
      if (selected) {
        if (adminInputUserId) adminInputUserId.value = selected.userId;
        if (adminInputDisplayName) adminInputDisplayName.value = selected.displayName || selected.fullName || '';
        if (adminInputPhone) adminInputPhone.value = selected.phone || '';
      }
    }
  });
}

if (adminManagerForm) {
  adminManagerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSaveAdminSubmit');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'กำลังบันทึกลงชีต...';
    }

    try {
      const payload = {
        userId: adminInputUserId.value.trim(),
        displayName: adminInputDisplayName.value.trim(),
        role: adminInputRole.value,
        phone: adminInputPhone.value.trim(),
        note: adminInputNote.value.trim(),
        status: adminInputStatus.value
      };

      const res = await adminFetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'บันทึกข้อมูลเรียบร้อยแล้ว', '✅');
        closeAdminModal();
        await loadAdmins();
      } else {
        showToast(data.message || 'บันทึกไม่สำเร็จ', '⚠️');
      }
    } catch (err) {
      console.error('Error saving admin:', err);
      showToast('เกิดข้อผิดพลาดในการบันทึก', '⛔');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'บันทึกข้อมูล';
      }
    }
  });
}

window.confirmDeleteAdmin = async function(userId, name) {
  if (currentAdminUser && currentAdminUser.userId === userId) {
    alert('⚠️ ไม่สามารถลบบัญชีของคุณเองที่กำลังใช้งานอยู่ได้');
    return;
  }

  if (!confirm(`คุณต้องการลบสิทธิ์แอดมินของ "${name}" (${userId}) ใช่หรือไม่?\nข้อมูลจะถูกลบออกจากชีต admin ทันที`)) {
    return;
  }

  try {
    const res = await adminFetch(`/api/admin/admins/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
    const data = await res.json();

    if (data.success) {
      showToast('ลบแอดมินออกจากระบบแล้ว', '🗑️');
      await loadAdmins();
    } else {
      showToast(data.message || 'ไม่สามารถลบได้', '⚠️');
    }
  } catch (err) {
    console.error('Error deleting admin:', err);
    showToast('เกิดข้อผิดพลาดในการลบ', '⛔');
  }
};

if (adminSearchInput) {
  adminSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderAdmins(allAdminsList);
      return;
    }
    const filtered = allAdminsList.filter(a => 
      (a.displayName && a.displayName.toLowerCase().includes(q)) ||
      (a.userId && a.userId.toLowerCase().includes(q)) ||
      (a.phone && a.phone.includes(q)) ||
      (a.note && a.note.toLowerCase().includes(q)) ||
      (a.role && a.role.toLowerCase().includes(q))
    );
    renderAdmins(filtered);
  });
}

// เริ่มต้นระบบ
window.addEventListener('DOMContentLoaded', () => {
  // ตั้งค่าวันครบกำหนดเริ่มต้นเป็น 30 วันข้างหน้าในฟอร์มสร้างสัญญา
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const newDueDate = document.getElementById('newDueDate');
  if (newDueDate) newDueDate.value = d.toISOString().split('T')[0];

  // ตรวจสอบสิทธิ์ Admin ผ่าน LINE
  initAdminAuth();
});
