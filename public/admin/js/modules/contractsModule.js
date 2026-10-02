/**
 * Contracts Module (Debtor-Grouped Contracts Directory)
 * Supports Selection-First workflow, Debtor Card Picker, Selected Debtor Hero Banner, and Deep-Linking.
 */

import { adminFetch, formatMoney, showToast } from '../core/api.js';
import { store, eventBus } from '../core/state.js';
import { router } from '../core/router.js';

let contractsTableBody = null;
let contractSearchInput = null;
let contractFilterStatus = null;
let contractDebtorFilter = null;
let btnClearContractDebtor = null;
let contractsDebtorPickerContainer = null;
let contractsTableContainer = null;
let debtorCardsGrid = null;
let debtorCardSearchInput = null;
let selectedDebtorBanner = null;

let isInitialized = false;

function initDomElements() {
  contractsTableBody = document.getElementById('contractsTableBody');
  contractSearchInput = document.getElementById('contractSearchInput');
  contractFilterStatus = document.getElementById('contractFilterStatus');
  contractDebtorFilter = document.getElementById('contractDebtorFilter');
  btnClearContractDebtor = document.getElementById('btnClearContractDebtor');
  contractsDebtorPickerContainer = document.getElementById('contractsDebtorPickerContainer');
  contractsTableContainer = document.getElementById('contractsTableContainer');
  debtorCardsGrid = document.getElementById('debtorCardsGrid');
  debtorCardSearchInput = document.getElementById('debtorCardSearchInput');
  selectedDebtorBanner = document.getElementById('selectedDebtorBanner');

  if (contractDebtorFilter) {
    contractDebtorFilter.addEventListener('change', () => {
      const selectedId = contractDebtorFilter.value;
      store.setActiveDebtorId(selectedId);
      router.navigate('#/contracts', selectedId ? { debtorId: selectedId } : {});
      renderContractsView();
    });
  }

  if (debtorCardSearchInput) {
    debtorCardSearchInput.addEventListener('input', renderDebtorCardsGrid);
  }

  if (contractSearchInput) {
    contractSearchInput.addEventListener('input', renderContractsTable);
  }

  if (contractFilterStatus) {
    contractFilterStatus.addEventListener('change', renderContractsTable);
  }

  const btnRefreshContracts = document.getElementById('btnRefreshContracts');
  if (btnRefreshContracts) {
    btnRefreshContracts.addEventListener('click', loadContractsData);
  }
}

export async function mount(debtorId) {
  if (!isInitialized) {
    initDomElements();
    isInitialized = true;
  }

  if (debtorId !== undefined) {
    store.setActiveDebtorId(debtorId);
  }

  await loadContractsData();
}

export async function loadContractsData() {
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
      store.setContracts(contractsData.contracts);
    }
    if (debtorsData.success && debtorsData.debtors) {
      store.setDebtors(debtorsData.debtors);
    }

    renderDebtorDropdown();
    renderContractsView();
  } catch (err) {
    console.error('Error loading contracts:', err);
    if (contractsTableBody) {
      contractsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #EF4444; padding: 20px;">เกิดข้อผิดพลาดในการโหลดสัญญา</td></tr>';
    }
  }
}

export function getDebtorGroupMap() {
  const map = new Map();

  (store.debtors || []).forEach(d => {
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

  (store.contracts || []).forEach(c => {
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

export function renderDebtorDropdown() {
  if (!contractDebtorFilter) return;

  const debtorMap = getDebtorGroupMap();
  const debtorList = Array.from(debtorMap.values());

  debtorList.sort((a, b) => {
    if (b.remainingBalance !== a.remainingBalance) {
      return b.remainingBalance - a.remainingBalance;
    }
    return b.contracts.length - a.contracts.length;
  });

  let options = '<option value="">-- กรุณาเลือกลูกหนี้ (เลือกก่อนดูสัญญา) --</option>';
  debtorList.forEach(d => {
    const remainingStr = d.remainingBalance > 0 ? ` (ค้าง ${formatMoney(d.remainingBalance)})` : '';
    options += `<option value="${d.userId}">👤 ${d.fullName} [${d.contracts.length} สัญญา${remainingStr}]</option>`;
  });
  options += '<option value="ALL">🌐 ดูสัญญาหนี้ของลูกหนี้ทุกคน (โหมดรวมทั้งหมด)</option>';

  contractDebtorFilter.innerHTML = options;
  contractDebtorFilter.value = store.activeDebtorId || '';
}

export function renderDebtorCardsGrid() {
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

export function renderContractsView() {
  const activeId = store.activeDebtorId;

  if (!activeId) {
    if (contractsDebtorPickerContainer) contractsDebtorPickerContainer.style.display = 'block';
    if (contractsTableContainer) contractsTableContainer.style.display = 'none';
    if (btnClearContractDebtor) btnClearContractDebtor.style.display = 'none';
    if (contractDebtorFilter) contractDebtorFilter.value = '';
    renderDebtorCardsGrid();
  } else {
    if (contractsDebtorPickerContainer) contractsDebtorPickerContainer.style.display = 'none';
    if (contractsTableContainer) contractsTableContainer.style.display = 'block';
    if (btnClearContractDebtor) btnClearContractDebtor.style.display = 'inline-block';
    if (contractDebtorFilter) contractDebtorFilter.value = activeId;

    updateSelectedDebtorHero();
    renderContractsTable();
  }
}

export function updateSelectedDebtorHero() {
  if (!selectedDebtorBanner) return;

  const activeId = store.activeDebtorId;
  const heroDebtorAvatar = document.getElementById('heroDebtorAvatar');
  const heroDebtorName = document.getElementById('heroDebtorName');
  const heroDebtorUserId = document.getElementById('heroDebtorUserId');
  const heroDebtorPhone = document.getElementById('heroDebtorPhone');
  const heroStatContractsCount = document.getElementById('heroStatContractsCount');
  const heroStatTotalAmount = document.getElementById('heroStatTotalAmount');
  const heroStatRemainingAmount = document.getElementById('heroStatRemainingAmount');
  const btnHeroOpenContract = document.getElementById('btnHeroOpenContract');

  if (activeId === 'ALL') {
    if (heroDebtorAvatar) heroDebtorAvatar.textContent = '🌐';
    if (heroDebtorName) heroDebtorName.textContent = 'ลูกหนี้ทุกคน (โหมดรวมทั้งหมด)';
    const statusBadge = document.getElementById('heroDebtorStatusBadge');
    if (statusBadge) {
      statusBadge.className = 'badge-status active';
      statusBadge.textContent = 'แสดงสัญญาหนี้ทั้งหมด';
    }
    if (heroDebtorUserId) heroDebtorUserId.textContent = 'รวมข้อมูลทุกบัญชีลูกหนี้';
    if (heroDebtorPhone) heroDebtorPhone.textContent = `จำนวนสัญญาในระบบทั้งหมด ${store.contracts.length} ฉบับ`;

    let totalAll = 0, remainingAll = 0;
    store.contracts.forEach(c => {
      totalAll += Number(c.totalAmount) || 0;
      remainingAll += Number(c.remainingBalance) || 0;
    });

    if (heroStatContractsCount) heroStatContractsCount.textContent = `${store.contracts.length} สัญญา`;
    if (heroStatTotalAmount) heroStatTotalAmount.textContent = formatMoney(totalAll);
    if (heroStatRemainingAmount) heroStatRemainingAmount.textContent = formatMoney(remainingAll);
    if (btnHeroOpenContract) {
      btnHeroOpenContract.onclick = () => router.navigate('#/contracts/new');
    }
    return;
  }

  const debtorMap = getDebtorGroupMap();
  const d = debtorMap.get(activeId) || {
    userId: activeId,
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
      router.navigate('#/contracts/new', { debtorId: d.userId });
    };
  }
}

export function renderContractsTable() {
  if (!contractsTableBody) return;

  const query = (contractSearchInput?.value || '').toLowerCase().trim();
  const filterStatus = contractFilterStatus?.value || 'ALL';
  const activeId = store.activeDebtorId;

  let filtered = store.contracts;
  if (activeId && activeId !== 'ALL') {
    filtered = filtered.filter(c => c.userId === activeId);
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
    const profile = (store.reminderProfiles || []).find(p => p.profileId === c.reminderProfileId);
    const profileLabel = isRemindActive ? (profile ? profile.name : (c.reminderProfileId || 'ค่าเริ่มต้น')) : 'ปิดแจ้งเตือน';

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

// Global hooks for inline HTML onclick/onchange handlers
window.selectContractDebtor = function(userId) {
  store.setActiveDebtorId(userId);
  router.navigate('#/contracts', { debtorId: userId });
};

window.clearSelectedContractDebtor = function() {
  store.setActiveDebtorId('');
  router.navigate('#/contracts');
};

window.viewContractsForDebtor = function(userId) {
  store.setActiveDebtorId(userId);
  router.navigate('#/contracts', { debtorId: userId });
};

window.deleteContract = async function(debtId) {
  if (!confirm(`ต้องการลบสัญญา ${debtId} ใช่หรือไม่? ข้อมูลในระบบจะถูกนำออก`)) return;

  store.setContracts(store.contracts.filter(c => c.debtId !== debtId));
  renderContractsTable();

  try {
    const res = await adminFetch(`/api/admin/contracts/${debtId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('ลบสัญญาสำเร็จ', '✅');
      eventBus.emit('stats:needsRefresh');
    } else {
      showToast(data.message || 'ลบสัญญาไม่สำเร็จ', '❌');
      loadContractsData();
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการลบสัญญา: ' + err.message, '❌');
    loadContractsData();
  }
};

window.sendSingleReminder = async function(debtId) {
  if (!confirm(`ต้องการส่งข้อความแจ้งเตือนสัญญา ${debtId} ไปยัง LINE ลูกหนี้ทันทีใช่หรือไม่?`)) return;
  showToast('กำลังยิงข้อความแจ้งเตือน...', '⏳');

  try {
    const res = await adminFetch(`/api/admin/remind/${debtId}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('ส่งแจ้งเตือนสำเร็จ!', '✅');
      eventBus.emit('reminderLogs:needsRefresh');
    } else {
      showToast(data.message || 'เกิดข้อผิดพลาดในการยิงแจ้งเตือน', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
};

window.toggleContractReminder = async function(debtId, isEnabled) {
  try {
    const res = await adminFetch(`/api/admin/contracts/${debtId}/reminder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderEnabled: isEnabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEnabled ? 'เปิดแจ้งเตือนสัญญาแล้ว' : 'ปิดแจ้งเตือนสัญญาแล้ว', isEnabled ? '🔔' : '🔕');
      const c = store.contracts.find(x => x.debtId === debtId);
      if (c) c.reminderEnabled = isEnabled;
    } else {
      showToast(data.message || 'บันทึกสถานะไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
};
