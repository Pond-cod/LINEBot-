/**
 * Debtors Directory Module
 * Manages debtor registry, PDPA status, direct navigation to debtor contracts, and reminder overrides.
 */

import { adminFetch, showToast } from '../core/api.js';
import { store, eventBus } from '../core/state.js';
import { router } from '../core/router.js';

let debtorsTableBody = null;
let debtorSearchInput = null;

let isInitialized = false;

function initDomElements() {
  debtorsTableBody = document.getElementById('debtorsTableBody');
  debtorSearchInput = document.getElementById('debtorSearchInput');

  if (debtorSearchInput) {
    debtorSearchInput.addEventListener('input', renderDebtorsTable);
  }
}

export async function mount() {
  if (!isInitialized) {
    initDomElements();
    isInitialized = true;
  }

  await loadDebtors();
}

export async function loadDebtors() {
  if (!debtorsTableBody) return;
  debtorsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">กำลังโหลดรายชื่อลูกหนี้...</td></tr>';

  try {
    const res = await adminFetch('/api/admin/debtors');
    const data = await res.json();

    if (data.success && data.debtors) {
      store.setDebtors(data.debtors);
      renderDebtorsTable();
    }
  } catch (err) {
    console.error('Error loading debtors:', err);
    debtorsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #EF4444; padding: 20px;">เกิดข้อผิดพลาดในการโหลดลูกหนี้</td></tr>';
  }
}

export function renderDebtorsTable() {
  if (!debtorsTableBody) return;

  const query = (debtorSearchInput?.value || '').toLowerCase().trim();
  const filtered = (store.debtors || []).filter(d => {
    return !query ||
      (d.fullName || '').toLowerCase().includes(query) ||
      (d.displayName || '').toLowerCase().includes(query) ||
      (d.userId || '').toLowerCase().includes(query) ||
      (d.phone || '').includes(query);
  });

  if (filtered.length === 0) {
    debtorsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">ไม่พบรายชื่อลูกหนี้ที่ตรงกับคำค้นหา</td></tr>';
    return;
  }

  debtorsTableBody.innerHTML = filtered.map(d => {
    const isRemindActive = d.reminderEnabled !== false;
    const profile = (store.reminderProfiles || []).find(p => p.profileId === d.reminderProfileId);
    const profileLabel = isRemindActive ? (profile ? profile.name : (d.reminderProfileId || 'ค่าเริ่มต้น')) : 'ปิดแจ้งเตือน';

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--text-main); font-size: 14px;">${d.fullName || d.displayName || 'คุณลูกค้า'}</div>
          <small style="font-size: 11px; color: var(--text-muted);">${d.displayName || '-'}</small>
        </td>
        <td><span style="font-family: monospace; color: var(--primary); font-size: 12px;">${d.userId}</span></td>
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

// Global hooks for inline HTML handlers
window.toggleDebtorReminder = async function(userId, isEnabled) {
  try {
    const res = await adminFetch(`/api/admin/debtors/${userId}/reminder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderEnabled: isEnabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEnabled ? 'เปิดแจ้งเตือนลูกหนี้แล้ว' : 'ปิดแจ้งเตือนลูกหนี้แล้ว', isEnabled ? '🔔' : '🔕');
      const d = store.debtors.find(x => x.userId === userId);
      if (d) d.reminderEnabled = isEnabled;
    } else {
      showToast(data.message || 'บันทึกสถานะไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
};
