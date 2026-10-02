/**
 * Client Portal: Payment History Sub-View (#/history)
 * Handles Transaction List, Status Badges, e-Receipt Links, and Slip Previews
 */

import { store, eventBus } from '../core/clientState.js';

export function initHistoryView() {
  eventBus.on('data:updated', (data) => {
    renderHistory(data);
  });

  renderHistory(store.clientData);
}

export function renderHistory(data) {
  const historyListContainer = document.getElementById('historyListContainer');
  const historyCountBadge = document.getElementById('historyCountBadge');

  const payments = data?.payments || [];
  if (historyCountBadge) {
    historyCountBadge.textContent = `${payments.length} รายการ`;
  }

  if (!historyListContainer) return;

  if (payments.length === 0) {
    historyListContainer.innerHTML = `
      <div class="state-box">
        <div style="font-size: 32px; opacity: 0.8;">📭</div>
        <div style="color: var(--text-dim); margin-top: 6px;">ยังไม่มีประวัติการส่งสลิปชำระเงิน</div>
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
          ${status === 'VERIFIED' ? `
            <a href="/receipt/${p.paymentId}" target="_blank" style="font-size: 11px; background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; padding: 4px 8px; border-radius: 6px; text-decoration: none; margin-top: 5px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">
              📄 ใบเสร็จ (e-Receipt)
            </a>
          ` : ''}
          ${p.slipViewUrl ? `
            <a href="${p.slipViewUrl}" target="_blank" style="font-size: 11px; color: var(--primary); text-decoration: none; margin-top: 4px; display: inline-flex; align-items: center; gap: 3px;">
              🔍 ดูสลิป
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}
