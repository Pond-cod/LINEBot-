/**
 * Slip Verification & Reconciliation Module
 * Handles incoming slip gallery, zoom preview modal, approval with debt deduction, rejection, and Drive sync.
 */

import { adminFetch, formatMoney, showToast } from '../core/api.js';
import { store, eventBus } from '../core/state.js';

let slipsContainer = null;
let slipFilterStatus = null;
let modalSlipDetail = null;
let currentModalSlip = null;

let isInitialized = false;

function initDomElements() {
  slipsContainer = document.getElementById('slipsContainer');
  slipFilterStatus = document.getElementById('slipFilterStatus');
  modalSlipDetail = document.getElementById('modalSlipDetail');

  const btnRefreshSlips = document.getElementById('btnRefreshSlips');
  if (btnRefreshSlips) {
    btnRefreshSlips.addEventListener('click', loadSlips);
  }

  const btnSyncDriveSlips = document.getElementById('btnSyncDriveSlips');
  if (btnSyncDriveSlips) {
    btnSyncDriveSlips.addEventListener('click', syncDriveSlips);
  }

  if (slipFilterStatus) {
    slipFilterStatus.addEventListener('change', renderSlips);
  }

  // Modal Close Listeners
  const btnCloseSlipModal = document.getElementById('btnCloseSlipModal');
  if (btnCloseSlipModal && modalSlipDetail) {
    btnCloseSlipModal.addEventListener('click', () => {
      modalSlipDetail.classList.add('hidden');
    });
  }

  const btnModalApproveSlip = document.getElementById('btnModalApproveSlip');
  if (btnModalApproveSlip) {
    btnModalApproveSlip.addEventListener('click', () => {
      if (currentModalSlip) {
        window.approveSlip(currentModalSlip.paymentId, currentModalSlip.amount);
        if (modalSlipDetail) modalSlipDetail.classList.add('hidden');
      }
    });
  }

  const btnModalRejectSlip = document.getElementById('btnModalRejectSlip');
  if (btnModalRejectSlip) {
    btnModalRejectSlip.addEventListener('click', () => {
      if (currentModalSlip) {
        window.rejectSlip(currentModalSlip.paymentId);
        if (modalSlipDetail) modalSlipDetail.classList.add('hidden');
      }
    });
  }
}

export async function mount(filterStatus) {
  if (!isInitialized) {
    initDomElements();
    isInitialized = true;
  }

  if (filterStatus && slipFilterStatus) {
    slipFilterStatus.value = filterStatus;
  }

  await loadSlips();
}

export async function loadSlips() {
  if (!slipsContainer) return;
  slipsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px; grid-column: 1 / -1;">กำลังโหลดข้อมูลสลิป...</div>';

  try {
    const res = await adminFetch('/api/admin/slips');
    const data = await res.json();

    if (data.success && data.slips) {
      store.setSlips(data.slips);
      updateSlipBadgeCounts();
      renderSlips();
    }
  } catch (err) {
    console.error('Error loading slips:', err);
    slipsContainer.innerHTML = '<div style="text-align: center; color: #EF4444; padding: 40px; grid-column: 1 / -1;">เกิดข้อผิดพลาดในการโหลดสลิป</div>';
  }
}

export function updateSlipBadgeCounts() {
  const pendingCount = (store.slips || []).filter(s => s.verificationStatus === 'PENDING').length;
  const sidebarSlipsBadge = document.getElementById('sidebarSlipsBadge');
  const countBadgePendingSlips = document.getElementById('countBadgePendingSlips');

  if (sidebarSlipsBadge) {
    sidebarSlipsBadge.textContent = `${pendingCount} ใบ`;
    sidebarSlipsBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }
  if (countBadgePendingSlips) {
    countBadgePendingSlips.textContent = `${pendingCount} รอตรวจ`;
    countBadgePendingSlips.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }
}

export function renderSlips() {
  if (!slipsContainer) return;

  const filter = slipFilterStatus ? slipFilterStatus.value : 'ALL';
  const filtered = (store.slips || []).filter(s => {
    if (filter === 'ALL') return true;
    return s.verificationStatus === filter;
  });

  if (filtered.length === 0) {
    slipsContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 50px; grid-column: 1 / -1; background: var(--surface); border: 1px dashed var(--surface-border); border-radius: var(--radius-md);">
        <div style="font-size: 32px; margin-bottom: 8px;">📭</div>
        <div style="font-weight: 600;">ไม่พบสลิปโอนเงินในหมวดหมู่นี้</div>
        <div style="font-size: 12px; color: var(--text-sub); margin-top: 4px;">เมื่อลูกหนี้ส่งสลิปผ่าน LINE หรือแนบผ่านเว็บ รายการจะปรากฏที่นี่ทันที</div>
      </div>
    `;
    return;
  }

  slipsContainer.innerHTML = filtered.map(s => {
    let badgeClass = 'warning';
    let badgeText = '⏳ รอตรวจสอบ';
    if (s.verificationStatus === 'VERIFIED') {
      badgeClass = 'active';
      badgeText = '✅ อนุมัติแล้ว';
    } else if (s.verificationStatus === 'REJECTED') {
      badgeClass = 'overdue';
      badgeText = '❌ ปฏิเสธ';
    }

    const imgUrl = s.slipViewUrl || 'https://placehold.co/400x500/182236/FFFFFF?text=No+Image';
    const amountStr = s.amount ? formatMoney(s.amount) : 'รอระบุยอด';
    const isPending = s.verificationStatus === 'PENDING';

    return `
      <div class="slip-card">
        <div class="slip-img-wrapper" onclick="openSlipModal('${s.paymentId}')">
          <img src="${imgUrl}" alt="Slip" class="slip-img" loading="lazy" onerror="this.src='https://placehold.co/400x500/182236/FFFFFF?text=Preview+Error';">
          <div class="slip-badge-overlay">
            <span class="badge-status ${badgeClass}">${badgeText}</span>
          </div>
        </div>
        <div class="slip-card-body">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div>
              <div style="font-weight: 700; font-size: 14px; color: var(--text-main);">${s.debtorName || 'คุณลูกค้า'}</div>
              <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${s.debtId || s.paymentId}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 15px; font-weight: 800; color: var(--primary);">${amountStr}</div>
            </div>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px;">
            🕒 แนบเมื่อ: ${s.uploadedAt || '-'}
          </div>
          ${isPending ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <button class="topbar-btn primary" style="padding: 8px; font-size: 12px; justify-content: center;" onclick="approveSlip('${s.paymentId}', ${s.amount || 0})">
                ✅ อนุมัติ
              </button>
              <button class="topbar-btn" style="padding: 8px; font-size: 12px; justify-content: center; color: var(--danger); border-color: var(--danger-border);" onclick="rejectSlip('${s.paymentId}')">
                ❌ ปฏิเสธ
              </button>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
              <span style="color: var(--text-muted);">โดย: ${s.approvedBy || 'ระบบ'}</span>
              <button class="topbar-btn" style="padding: 4px 10px; font-size: 11.5px;" onclick="openSlipModal('${s.paymentId}')">
                🔍 ดูรายละเอียด
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

export async function syncDriveSlips() {
  const btn = document.getElementById('btnSyncDriveSlips');
  if (btn) btn.disabled = true;
  showToast('กำลังสแกนโฟลเดอร์ Google Drive...', '⏳');

  try {
    const res = await adminFetch('/api/admin/slips/sync', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'ซิงค์สลิปสำเร็จ!', '✅');
      loadSlips();
    } else {
      showToast(data.message || 'ซิงค์ไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการซิงค์: ' + err.message, '❌');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Global hooks for inline HTML onclick handlers
window.openSlipModal = function(paymentId) {
  const slip = (store.slips || []).find(s => s.paymentId === paymentId);
  if (!slip || !modalSlipDetail) return;

  currentModalSlip = slip;
  const modalSlipImg = document.getElementById('modalSlipImg');
  const modalSlipPaymentId = document.getElementById('modalSlipPaymentId');
  const modalSlipDebtor = document.getElementById('modalSlipDebtor');
  const modalSlipContract = document.getElementById('modalSlipContract');
  const modalSlipAmount = document.getElementById('modalSlipAmount');
  const modalSlipTime = document.getElementById('modalSlipTime');
  const modalSlipStatusBadge = document.getElementById('modalSlipStatusBadge');
  const modalSlipActions = document.getElementById('modalSlipActions');

  if (modalSlipImg) modalSlipImg.src = slip.slipViewUrl || '';
  if (modalSlipPaymentId) modalSlipPaymentId.textContent = slip.paymentId;
  if (modalSlipDebtor) modalSlipDebtor.textContent = `${slip.debtorName || 'คุณลูกค้า'} (${slip.userId || '-'})`;
  if (modalSlipContract) modalSlipContract.textContent = slip.debtId || '-';
  if (modalSlipAmount) modalSlipAmount.textContent = slip.amount ? formatMoney(slip.amount) : 'รอระบุ';
  if (modalSlipTime) modalSlipTime.textContent = slip.uploadedAt || '-';

  if (modalSlipStatusBadge) {
    modalSlipStatusBadge.textContent = slip.verificationStatus;
    modalSlipStatusBadge.className = 'badge-status ' + (slip.verificationStatus === 'VERIFIED' ? 'active' : (slip.verificationStatus === 'REJECTED' ? 'overdue' : 'warning'));
  }

  if (modalSlipActions) {
    modalSlipActions.style.display = (slip.verificationStatus === 'PENDING') ? 'flex' : 'none';
  }

  modalSlipDetail.classList.remove('hidden');
};

window.approveSlip = async function(paymentId, amount) {
  const confirmed = prompt(`กรุณายืนยันยอดเงินที่อนุมัติ (บาท):\n(ระบบจะตัดลดยอดหนี้คงเหลือให้อัตโนมัติ)`, amount || '');
  if (confirmed === null) return;

  const numAmount = parseFloat(confirmed);
  if (isNaN(numAmount) || numAmount <= 0) {
    alert('กรุณาระบุจำนวนเงินที่ถูกต้อง');
    return;
  }

  const slip = (store.slips || []).find(s => s.paymentId === paymentId);
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
      eventBus.emit('stats:needsRefresh');
      eventBus.emit('contracts:needsRefresh');
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

  const slip = (store.slips || []).find(s => s.paymentId === paymentId);
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
