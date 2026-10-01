(function() {
// Client Portal JavaScript Controller
const LIFF_ID = '2011816015-RfpKwHVZ';

let currentUser = {
  userId: 'U_TEST_GUEST',
  displayName: 'ผู้ใช้งาน',
  pictureUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394A3B8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z'/></svg>"
};

let clientData = {
  debtor: null,
  activeDebt: null,
  payments: []
};

// Elements
const userAvatarEl = document.getElementById('userAvatar');
const userNameEl = document.getElementById('userName');
const clientStatusBadge = document.getElementById('clientStatusBadge');

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

// Pay Elements
const btnCopyAcc = document.getElementById('btnCopyAcc');
const bankAccNo = document.getElementById('bankAccNo');
const slipAmountInput = document.getElementById('slipAmountInput');
const btnSubmitSlip = document.getElementById('btnSubmitSlip');

// History Elements
const historyListContainer = document.getElementById('historyListContainer');
const historyCountBadge = document.getElementById('historyCountBadge');

// Profile Elements
const profileUserId = document.getElementById('profileUserId');
const profileFullName = document.getElementById('profileFullName');
const profilePhone = document.getElementById('profilePhone');
const profileIdCard = document.getElementById('profileIdCard');
const profileRegisteredAt = document.getElementById('profileRegisteredAt');

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

  // เลื่อนกลับขึ้นบนสุดเมื่อสลับหน้า
  document.querySelector('.views-viewport').scrollTop = 0;
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const target = item.getAttribute('data-target');
    switchView(target);
  });
});

btnGoToPay.addEventListener('click', () => {
  switchView('view-pay');
});

/**
 * 2. คัดลอกเลขบัญชี
 */
btnCopyAcc.addEventListener('click', async () => {
  const text = bankAccNo.textContent.trim();
  try {
    await navigator.clipboard.writeText(text);
    showToast('คัดลอกเลขบัญชีแล้ว', '📋');
  } catch (e) {
    showToast('เลขบัญชี: ' + text, '📋');
  }
});

/**
 * 3. แสดง Toast Notification
 */
function showToast(msg, icon = 'ℹ️') {
  toastMessage.textContent = msg;
  toastIcon.textContent = icon;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

/**
 * 4. เริ่มต้น LIFF และดึงข้อมูล
 */
async function initApp() {
  try {
    await liff.init({ liffId: LIFF_ID });

    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      currentUser = profile;
    } else {
      // สำหรับทดสอบภายนอก LINE
      currentUser.userId = 'U_DEMO_CLIENT';
      currentUser.displayName = 'คุณลูกค้า (Demo)';
    }
  } catch (err) {
    console.warn('LIFF init fallback:', err);
    currentUser.userId = 'U_DEMO_CLIENT';
    currentUser.displayName = 'คุณลูกค้า (Demo)';
  }

  // อัปเดตข้อมูลผู้ใช้ใน Header
  userNameEl.textContent = currentUser.displayName;
  if (currentUser.pictureUrl) {
    userAvatarEl.src = currentUser.pictureUrl;
  }

  await loadClientData();
}

/**
 * 5. ดึงข้อมูลจาก Backend API
 */
async function loadClientData() {
  try {
    const res = await fetch(`/api/client/profile/${encodeURIComponent(currentUser.userId)}`);
    const json = await res.json();

    if (json.success && json.data) {
      clientData = json.data;
      renderDashboard();
      renderHistory();
      renderProfile();
    }
  } catch (err) {
    console.error('Failed to load client data:', err);
    showToast('ไม่สามารถดึงข้อมูลได้', '⚠️');
  }
}

/**
 * 6. เรนเดอร์แดชบอร์ด
 */
function renderDashboard() {
  const debt = clientData.activeDebt;

  if (debt) {
    heroDebtId.textContent = `สัญญาเลขที่: ${debt.debtId}`;
    heroRemaining.textContent = `฿${Number(debt.remainingBalance).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    metricDueDate.textContent = debt.dueDate || '-';
    metricInstallment.textContent = `฿${Number(debt.installmentAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

    // คำนวณเปอร์เซ็นต์ที่ชำระไปแล้ว
    const total = debt.totalAmount || 0;
    const remaining = debt.remainingBalance || 0;
    const paid = Math.max(0, total - remaining);
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

    progressBar.style.width = `${pct}%`;
    progressPercent.textContent = `${pct}% (จ่ายแล้ว ฿${paid.toLocaleString()})`;

    // สถานะ
    clientStatusBadge.textContent = debt.debtStatus === 'ACTIVE' ? 'สถานะปกติ' : debt.debtStatus;
    clientStatusBadge.style.color = '#15803D';
    clientStatusBadge.style.backgroundColor = '#DCFCE7';

    // เซ็ตค่างวดเริ่มต้นในช่องชำระเงิน
    slipAmountInput.value = debt.installmentAmount || '';
  } else {
    heroDebtId.textContent = 'ยังไม่มีสัญญาหนี้ที่เปิดใช้งาน';
    heroRemaining.textContent = '฿0.00';
    metricDueDate.textContent = '-';
    metricInstallment.textContent = '฿0.00';
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    clientStatusBadge.textContent = 'ไม่มีสัญญา';
  }
}

/**
 * 7. เรนเดอร์ประวัติการชำระเงิน
 */
function renderHistory() {
  const payments = clientData.payments || [];
  historyCountBadge.textContent = `${payments.length} รายการ`;

  if (payments.length === 0) {
    historyListContainer.innerHTML = `
      <div class="state-box">
        <div style="font-size: 36px; margin-bottom: 8px;">📭</div>
        <div>ยังไม่มีประวัติการส่งสลิปชำระเงิน</div>
      </div>
    `;
    return;
  }

  historyListContainer.innerHTML = payments.map(p => {
    let statusClass = 'pending';
    let statusText = 'รอตรวจสอบ';
    if (p.verificationStatus === 'VERIFIED') {
      statusClass = 'verified';
      statusText = 'อนุมัติแล้ว';
    } else if (p.verificationStatus === 'REJECTED') {
      statusClass = 'rejected';
      statusText = 'ไม่ผ่าน';
    }

    return `
      <div class="history-card">
        <div class="history-left">
          <h4>฿${Number(p.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</h4>
          <div class="history-date">📅 ${p.uploadedAt || '-'}</div>
          <div class="history-id">รหัส: ${p.paymentId}</div>
        </div>
        <div class="history-right">
          <span class="status-pill ${statusClass}">${statusText}</span>
          ${p.slipViewUrl ? `<div><a href="${p.slipViewUrl}" target="_blank" class="btn-view-slip">🔍 ดูสลิป</a></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 8. เรนเดอร์หน้าโปรไฟล์
 */
function renderProfile() {
  const debtor = clientData.debtor;
  profileUserId.textContent = currentUser.userId;
  profileFullName.textContent = debtor?.fullName || currentUser.displayName || '-';
  profilePhone.textContent = debtor?.phone || '-';
  profileIdCard.textContent = debtor?.idCardNumber || '-';
  profileRegisteredAt.textContent = debtor?.registeredAt || '-';
}

/**
 * 9. ส่งสลิปชำระเงิน
 */
btnSubmitSlip.addEventListener('click', async () => {
  const base64 = window.getSlipBase64();
  if (!base64) {
    showToast('กรุณาเลือกไฟล์สลิปก่อนครับ', '⚠️');
    return;
  }

  btnSubmitSlip.disabled = true;
  btnSubmitSlip.innerHTML = '<span>⏳ กำลังอัปโหลด...</span>';

  const payload = {
    userId: currentUser.userId,
    debtId: clientData.activeDebt?.debtId || '',
    amount: slipAmountInput.value || 0,
    imageBase64: base64
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
      window.resetSlipUpload();
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

// เริ่มต้นระบบ
window.addEventListener('DOMContentLoaded', initApp);
})();
