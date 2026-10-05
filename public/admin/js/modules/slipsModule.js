/**
 * Slip Verification & Reconciliation Module
 * Handles incoming slip gallery, zoom preview modal, approval with debt deduction, rejection, and Drive sync.
 */

import { adminFetch, formatMoney, showToast } from '../core/api.js';
import { store, eventBus } from '../core/state.js';

let slipsContainer = null;
let currentFilter = 'PENDING'; // ค่าเริ่มต้น: รอตรวจสอบ (PENDING | ALL | VERIFIED | REJECTED)
let searchKeyword = '';
let modalSlipDetail = null;
let currentModalSlip = null;

let isInitialized = false;

function initDomElements() {
  slipsContainer = document.getElementById('slipsContainer');
  modalSlipDetail = document.getElementById('modalSlipDetail');

  const btnRefreshSlips = document.getElementById('btnRefreshSlips');
  if (btnRefreshSlips) {
    btnRefreshSlips.addEventListener('click', () => loadSlips());
  }

  const btnSyncDriveSlips = document.getElementById('btnSyncDriveSlips');
  if (btnSyncDriveSlips) {
    btnSyncDriveSlips.addEventListener('click', () => syncDriveSlips());
  }

  // Event Delegation สำหรับปุ่ม Filter Tabs (⏳ รอตรวจสอบ, 📑 ทั้งหมด, ✅ อนุมัติแล้ว, ❌ ปฏิเสธ)
  const filterTabsContainer = document.getElementById('slipFilterTabs');
  if (filterTabsContainer) {
    filterTabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-slip-filter]');
      if (!btn) return;
      const filter = btn.getAttribute('data-slip-filter');
      setFilter(filter);
    });
  }

  // ช่องค้นหาสลิปแบบ Real-time
  const slipSearchInput = document.getElementById('slipSearchInput');
  if (slipSearchInput) {
    slipSearchInput.addEventListener('input', (e) => {
      searchKeyword = (e.target.value || '').trim().toLowerCase();
      renderSlips();
    });
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

/**
 * อัปเดตคลาส active บนปุ่ม Tabs ทั้ง 4 ปุ่ม
 */
function updateFilterTabsUI() {
  const buttons = document.querySelectorAll('#slipFilterTabs [data-slip-filter]');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-slip-filter') === currentFilter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * สลับหมวดหมู่ตัวกรองสลิป
 */
export function setFilter(filter) {
  currentFilter = filter || 'ALL';
  updateFilterTabsUI();
  renderSlips();
}

// Hook ไว้ให้เรียกจาก HTML inline onclick ได้
window.switchSlipFilter = function(filter) {
  setFilter(filter);
};

export async function mount(filterStatus) {
  if (!isInitialized) {
    initDomElements();
    isInitialized = true;
  }

  if (filterStatus) {
    currentFilter = filterStatus;
  }

  updateFilterTabsUI();
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
    } else {
      slipsContainer.innerHTML = `<div style="text-align: center; color: #EF4444; padding: 40px; grid-column: 1 / -1;">${data.message || 'ไม่สามารถโหลดข้อมูลสลิปได้'}</div>`;
    }
  } catch (err) {
    console.error('Error loading slips:', err);
    slipsContainer.innerHTML = '<div style="text-align: center; color: #EF4444; padding: 40px; grid-column: 1 / -1;">เกิดข้อผิดพลาดในการโหลดสลิป</div>';
  }
}

/**
 * คำนวณและอัปเดตตัวเลข Badge บน Tabs ทั้งหมดแบบ Dynamic
 */
export function updateSlipBadgeCounts() {
  const slips = store.slips || [];
  const pendingCount = slips.filter(s => s.verificationStatus === 'PENDING').length;
  const verifiedCount = slips.filter(s => s.verificationStatus === 'VERIFIED').length;
  const rejectedCount = slips.filter(s => s.verificationStatus === 'REJECTED').length;
  const allCount = slips.length;

  const badgePendingCount = document.getElementById('badgePendingCount');
  if (badgePendingCount) badgePendingCount.textContent = pendingCount;

  const badgeAllCount = document.getElementById('badgeAllCount');
  if (badgeAllCount) badgeAllCount.textContent = allCount;

  const badgeVerifiedCount = document.getElementById('badgeVerifiedCount');
  if (badgeVerifiedCount) badgeVerifiedCount.textContent = verifiedCount;

  const badgeRejectedCount = document.getElementById('badgeRejectedCount');
  if (badgeRejectedCount) badgeRejectedCount.textContent = rejectedCount;

  const sidebarSlipsBadge = document.getElementById('sidebarSlipsBadge');
  if (sidebarSlipsBadge) {
    sidebarSlipsBadge.textContent = `${pendingCount} ใบ`;
    sidebarSlipsBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }

  const countBadgePendingSlips = document.getElementById('countBadgePendingSlips');
  if (countBadgePendingSlips) {
    countBadgePendingSlips.textContent = `${pendingCount} รอตรวจ`;
    countBadgePendingSlips.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }

  const statPendingSlips = document.getElementById('statPendingSlips');
  if (statPendingSlips) {
    statPendingSlips.textContent = `${pendingCount} ใบ`;
  }
}

/**
 * เรนเดอร์การ์ดสลิปตาม Tab ที่เลือกและคำค้นหา
 */
export function renderSlips() {
  if (!slipsContainer) return;

  const slips = store.slips || [];

  // 1. กรองตามสถานะที่เลือก
  let filtered = slips.filter(s => {
    if (currentFilter === 'ALL') return true;
    return s.verificationStatus === currentFilter;
  });

  // 2. กรองตามคำค้นหา (ถ้ามี)
  if (searchKeyword) {
    filtered = filtered.filter(s => {
      const debtor = String(s.debtorName || '').toLowerCase();
      const debtId = String(s.debtId || '').toLowerCase();
      const payId = String(s.paymentId || '').toLowerCase();
      const phone = String(s.debtorPhone || '').toLowerCase();
      const amount = String(s.amount || '');
      const note = String(s.adminNote || '').toLowerCase();
      return debtor.includes(searchKeyword) ||
             debtId.includes(searchKeyword) ||
             payId.includes(searchKeyword) ||
             phone.includes(searchKeyword) ||
             amount.includes(searchKeyword) ||
             note.includes(searchKeyword);
    });
  }

  // 3. แสดง Empty State ที่ชัดเจนและสวยงาม
  if (filtered.length === 0) {
    if (searchKeyword) {
      slipsContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 50px 20px; grid-column: 1 / -1; background: var(--surface); border: 1px dashed var(--surface-border); border-radius: var(--radius-md);">
          <div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: 700; font-size: 15px; color: var(--text-main); margin-bottom: 4px;">ไม่พบสลิปที่ตรงกับคำค้นหา "${searchKeyword}"</div>
          <div style="font-size: 12px; color: var(--text-sub);">ลองเปลี่ยนคำค้นหาเป็นชื่อลูกหนี้, รหัสสัญญา หรือรหัสสลิป</div>
        </div>
      `;
      return;
    }

    if (currentFilter === 'PENDING') {
      slipsContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 50px 20px; grid-column: 1 / -1; background: var(--surface); border: 1.5px dashed var(--surface-border); border-radius: var(--radius-md);">
          <div style="font-size: 40px; margin-bottom: 10px;">🎉</div>
          <div style="font-weight: 700; font-size: 16px; color: var(--text-main); margin-bottom: 6px;">ไม่มีสลิปรอตรวจสอบในขณะนี้</div>
          <div style="font-size: 13px; color: var(--text-sub); margin-bottom: 16px;">สลิปทั้งหมดได้รับการตรวจสอบและอนุมัติแล้ว หรือยังไม่มีสลิปใหม่ส่งเข้ามา</div>
          ${slips.length > 0 ? `
            <button class="topbar-btn primary" onclick="window.switchSlipFilter('ALL')" style="margin: 0 auto; padding: 8px 18px; font-size: 13px;">
              📑 ดูสลิปทั้งหมดที่มีในระบบ (${slips.length} รายการ)
            </button>
          ` : ''}
        </div>
      `;
      return;
    }

    if (currentFilter === 'VERIFIED') {
      slipsContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 50px 20px; grid-column: 1 / -1; background: var(--surface); border: 1px dashed var(--surface-border); border-radius: var(--radius-md);">
          <div style="font-size: 36px; margin-bottom: 8px;">📁</div>
          <div style="font-weight: 700; font-size: 15px; color: var(--text-main); margin-bottom: 4px;">ยังไม่มีสลิปที่อนุมัติแล้ว</div>
          <div style="font-size: 12px; color: var(--text-sub);">เมื่อมีการอนุมัติสลิป ประวัติจะแสดงที่นี่</div>
        </div>
      `;
      return;
    }

    if (currentFilter === 'REJECTED') {
      slipsContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 50px 20px; grid-column: 1 / -1; background: var(--surface); border: 1px dashed var(--surface-border); border-radius: var(--radius-md);">
          <div style="font-size: 36px; margin-bottom: 8px;">✨</div>
          <div style="font-weight: 700; font-size: 15px; color: var(--text-main); margin-bottom: 4px;">ไม่มีสลิปที่ถูกปฏิเสธ</div>
          <div style="font-size: 12px; color: var(--text-sub);">ไม่มีรายการสลิปที่ไม่อนุมัติ</div>
        </div>
      `;
      return;
    }

    slipsContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 50px 20px; grid-column: 1 / -1; background: var(--surface); border: 1px dashed var(--surface-border); border-radius: var(--radius-md);">
        <div style="font-size: 36px; margin-bottom: 8px;">📭</div>
        <div style="font-weight: 700; font-size: 15px; color: var(--text-main); margin-bottom: 4px;">ไม่พบรายการสลิปในระบบ</div>
        <div style="font-size: 12px; color: var(--text-sub); margin-top: 4px;">เมื่อลูกหนี้ส่งสลิปผ่าน LINE หรือแนบผ่านเว็บ รายการจะปรากฏที่นี่ทันที</div>
      </div>
    `;
    return;
  }

  // 4. เรนเดอร์การ์ดสลิปแต่ละใบ
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
      loadSlips();
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
