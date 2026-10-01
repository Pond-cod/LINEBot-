// Client Portal JavaScript Controller (Unified)
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

let currentSlipBase64 = null;

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

  document.querySelector('.views-viewport').scrollTop = 0;
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

  if (btnRemovePreview) {
    btnRemovePreview.addEventListener('click', (e) => {
      e.stopPropagation();
      resetSlipUpload();
    });
  }
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('กรุณาเลือกไฟล์รูปภาพเท่านั้นครับ');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    compressImage(event.target.result, 1280, 0.85, (compressedBase64) => {
      currentSlipBase64 = compressedBase64;
      slipPreviewImg.src = compressedBase64;
      dropzoneArea.style.display = 'none';
      previewContainer.classList.add('show');
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
    ctx.drawImage(img, 0, 0, width, height);

    const compressed = canvas.toDataURL('image/jpeg', quality);
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

/**
 * 5. เริ่มต้น LIFF และดึงข้อมูล
 */
async function initApp() {
  try {
    await liff.init({ liffId: LIFF_ID });

    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      currentUser = profile;
    } else {
      currentUser.userId = 'U_DEMO_CLIENT';
      currentUser.displayName = 'คุณลูกค้า (Demo)';
    }
  } catch (err) {
    console.warn('LIFF init fallback:', err);
    currentUser.userId = 'U_DEMO_CLIENT';
    currentUser.displayName = 'คุณลูกค้า (Demo)';
  }

  if (userNameEl) userNameEl.textContent = currentUser.displayName;
  if (currentUser.pictureUrl && userAvatarEl) {
    userAvatarEl.src = currentUser.pictureUrl;
  }

  await loadClientData();
}

/**
 * 6. ดึงข้อมูลจาก Backend API
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
 * 7. เรนเดอร์แดชบอร์ด
 */
function renderDashboard() {
  const debt = clientData.activeDebt;

  if (debt) {
    if (heroDebtId) heroDebtId.textContent = `สัญญาเลขที่: ${debt.debtId}`;
    if (heroRemaining) heroRemaining.textContent = `฿${Number(debt.remainingBalance).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    if (metricDueDate) metricDueDate.textContent = debt.dueDate || '-';
    if (metricInstallment) metricInstallment.textContent = `฿${Number(debt.installmentAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

    const total = debt.totalAmount || 0;
    const remaining = debt.remainingBalance || 0;
    const paid = Math.max(0, total - remaining);
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressPercent) progressPercent.textContent = `${pct}% (จ่ายแล้ว ฿${paid.toLocaleString()})`;

    if (clientStatusBadge) {
      clientStatusBadge.textContent = debt.debtStatus === 'ACTIVE' ? 'สถานะปกติ' : debt.debtStatus;
      clientStatusBadge.style.color = '#15803D';
      clientStatusBadge.style.backgroundColor = '#DCFCE7';
    }

    if (slipAmountInput) slipAmountInput.value = debt.installmentAmount || '';
  } else {
    if (heroDebtId) heroDebtId.textContent = 'ยังไม่มีสัญญาหนี้ที่เปิดใช้งาน';
    if (heroRemaining) heroRemaining.textContent = '฿0.00';
    if (metricDueDate) metricDueDate.textContent = '-';
    if (metricInstallment) metricInstallment.textContent = '฿0.00';
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (clientStatusBadge) clientStatusBadge.textContent = 'ไม่มีสัญญา';
  }
}

/**
 * 8. เรนเดอร์ประวัติการชำระเงิน
 */
function renderHistory() {
  const payments = clientData.payments || [];
  if (historyCountBadge) historyCountBadge.textContent = `${payments.length} รายการ`;

  if (!historyListContainer) return;

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
 * 9. เรนเดอร์หน้าโปรไฟล์
 */
function renderProfile() {
  const debtor = clientData.debtor;
  if (profileUserId) profileUserId.textContent = currentUser.userId;
  if (profileFullName) profileFullName.textContent = debtor?.fullName || currentUser.displayName || '-';
  if (profilePhone) profilePhone.textContent = debtor?.phone || '-';
  if (profileIdCard) profileIdCard.textContent = debtor?.idCardNumber || '-';
  if (profileRegisteredAt) profileRegisteredAt.textContent = debtor?.registeredAt || '-';
}

/**
 * 10. ส่งสลิปชำระเงิน
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

// เริ่มต้นระบบ
window.addEventListener('DOMContentLoaded', initApp);
