/**
 * Team Managers & Access Control Module
 * Manages admin authorization list, roles (SUPER_ADMIN, OPERATOR, AUDITOR), and access restrictions.
 */

import { adminFetch, showToast } from '../core/api.js';
import { store, eventBus } from '../core/state.js';

let adminsTableBody = null;
let adminSearchInput = null;
let modalAdmin = null;
let formAdmin = null;

let isInitialized = false;

function initDomElements() {
  adminsTableBody = document.getElementById('adminsTableBody');
  adminSearchInput = document.getElementById('adminSearchInput');
  modalAdmin = document.getElementById('modalAdmin');
  formAdmin = document.getElementById('formAdmin');

  const btnOpenAddAdminModal = document.getElementById('btnOpenAddAdminModal');
  const btnCloseAdminModal = document.getElementById('btnCloseAdminModal');

  if (btnOpenAddAdminModal && modalAdmin) {
    btnOpenAddAdminModal.addEventListener('click', () => {
      if (formAdmin) formAdmin.reset();
      const elMode = document.getElementById('adminFormMode');
      const elTitle = document.getElementById('modalAdminTitle');
      const elUserId = document.getElementById('adminInputUserId');
      if (elMode) elMode.value = 'CREATE';
      if (elTitle) elTitle.textContent = '➕ เพิ่มผู้ดูแลระบบใหม่';
      if (elUserId) elUserId.readOnly = false;
      modalAdmin.classList.remove('hidden');
    });
  }

  if (btnCloseAdminModal && modalAdmin) {
    btnCloseAdminModal.addEventListener('click', () => {
      modalAdmin.classList.add('hidden');
    });
  }

  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', renderAdminsTable);
  }

  if (formAdmin) {
    formAdmin.addEventListener('submit', handleAdminSubmit);
  }
}

export async function mount() {
  if (!isInitialized) {
    initDomElements();
    isInitialized = true;
  }

  await loadAdmins();
}

export async function loadAdmins() {
  if (!adminsTableBody) return;
  adminsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">กำลังโหลดรายชื่อผู้ดูแลระบบ...</td></tr>';

  try {
    const res = await adminFetch('/api/admin/admins');
    const data = await res.json();

    if (data.success && Array.isArray(data.admins)) {
      store.admins = data.admins;
      renderAdminsTable();
    }
  } catch (err) {
    console.warn('Could not load admins:', err.message);
    adminsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #EF4444; padding: 20px;">เกิดข้อผิดพลาดในการโหลดรายชื่อแอดมิน</td></tr>';
  }
}

export function renderAdminsTable() {
  if (!adminsTableBody) return;

  const query = (adminSearchInput?.value || '').toLowerCase().trim();
  const filtered = (store.admins || []).filter(a => {
    return !query ||
      (a.displayName || '').toLowerCase().includes(query) ||
      (a.userId || '').toLowerCase().includes(query) ||
      (a.role || '').toLowerCase().includes(query) ||
      (a.phone || '').includes(query);
  });

  if (filtered.length === 0) {
    adminsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">ไม่พบรายชื่อแอดมินที่ตรงกับคำค้นหา</td></tr>';
    return;
  }

  const roleLabels = {
    'SUPER_ADMIN': '👑 ผู้ดูแลระบบสูงสุด (Super Admin)',
    'OPERATOR': '💼 เจ้าหน้าที่สินเชื่อ (Operator)',
    'AUDITOR': '🔍 ผู้ตรวจสอบ (Auditor)'
  };

  adminsTableBody.innerHTML = filtered.map(a => `
    <tr>
      <td>
        <div style="font-weight: 700; color: var(--text-main); font-size: 14px;">${a.displayName || 'ผู้ดูแลระบบ'}</div>
        <small style="font-size: 11px; color: var(--text-muted);">${a.note || '-'}</small>
      </td>
      <td><span style="font-family: monospace; color: var(--primary); font-size: 12px;">${a.userId}</span></td>
      <td><span class="badge-status active" style="font-size: 11px;">${roleLabels[a.role] || a.role}</span></td>
      <td>${a.phone || '-'}</td>
      <td><span class="badge-status ${a.status === 'ACTIVE' ? 'active' : 'overdue'}">${a.status || 'ACTIVE'}</span></td>
      <td style="text-align: center; white-space: nowrap;">
        <button class="topbar-btn" style="padding: 4px 10px; font-size: 11.5px; margin-right: 6px;" onclick="openEditAdminModal('${a.userId}')">
          ✏️ แก้ไข
        </button>
        <button class="btn-action-icon delete" onclick="deleteAdmin('${a.userId}')" title="ลบสิทธิ์แอดมิน">
          🗑️
        </button>
      </td>
    </tr>
  `).join('');
}

async function handleAdminSubmit(e) {
  e.preventDefault();
  const payload = {
    userId: document.getElementById('adminInputUserId')?.value?.trim(),
    displayName: document.getElementById('adminInputDisplayName')?.value?.trim(),
    role: document.getElementById('adminInputRole')?.value || 'OPERATOR',
    phone: document.getElementById('adminInputPhone')?.value?.trim() || '',
    status: document.getElementById('adminInputStatus')?.value || 'ACTIVE'
  };

  if (!payload.userId || !payload.displayName) {
    showToast('กรุณาระบุ LINE User ID และชื่อผู้ดูแลระบบ', '⚠️');
    return;
  }

  showToast('กำลังบันทึกข้อมูลแอดมิน...', '⏳');

  try {
    const res = await adminFetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('บันทึกข้อมูลผู้ดูแลระบบสำเร็จ!', '✅');
      if (modalAdmin) modalAdmin.classList.add('hidden');
      loadAdmins();
    } else {
      showToast(data.message || 'บันทึกไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
}

// Global hooks for inline HTML handlers
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

window.openEditAdminModal = function(userId) {
  const admin = (store.admins || []).find(a => a.userId === userId);
  if (!admin || !modalAdmin) return;

  const elMode = document.getElementById('adminFormMode');
  const elTitle = document.getElementById('modalAdminTitle');
  const elUserId = document.getElementById('adminInputUserId');
  const elName = document.getElementById('adminInputDisplayName');
  const elRole = document.getElementById('adminInputRole');
  const elPhone = document.getElementById('adminInputPhone');
  const elStatus = document.getElementById('adminInputStatus');

  if (elMode) elMode.value = 'EDIT';
  if (elTitle) elTitle.textContent = '✏️ แก้ไขข้อมูลผู้ดูแลระบบ';
  if (elUserId) { elUserId.value = admin.userId; elUserId.readOnly = true; }
  if (elName) elName.value = admin.displayName || '';
  if (elRole) elRole.value = admin.role || 'OPERATOR';
  if (elPhone) elPhone.value = admin.phone || '';
  if (elStatus) elStatus.value = admin.status || 'ACTIVE';

  modalAdmin.classList.remove('hidden');
};
