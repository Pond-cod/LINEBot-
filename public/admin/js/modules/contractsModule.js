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

  // Cycle Days Custom Toggle in Edit Modal
  const editContractCycleDays = document.getElementById('editContractCycleDays');
  const editContractCycleCustom = document.getElementById('editContractCycleCustom');
  if (editContractCycleDays && editContractCycleCustom) {
    editContractCycleDays.addEventListener('change', () => {
      if (editContractCycleDays.value === 'custom') {
        editContractCycleCustom.style.display = 'block';
        editContractCycleCustom.focus();
      } else {
        editContractCycleCustom.style.display = 'none';
      }
    });
  }

  // Form Edit Contract Submit
  const formEditContract = document.getElementById('formEditContract');
  if (formEditContract) {
    formEditContract.addEventListener('submit', async (e) => {
      e.preventDefault();
      const debtId = document.getElementById('editContractDebtId')?.value;
      if (!debtId) return;

      const userId = document.getElementById('editContractUserId')?.value || '';
      const totalAmount = Number(document.getElementById('editContractTotalAmount')?.value) || 0;
      const remainingBalance = Number(document.getElementById('editContractRemainingBalance')?.value) || 0;
      const installmentAmount = Number(document.getElementById('editContractInstallmentAmount')?.value) || 0;
      const dueDate = document.getElementById('editContractDueDate')?.value || '';
      
      let cycleDays = 30;
      const cycleSelectVal = editContractCycleDays?.value;
      if (cycleSelectVal === 'custom') {
        cycleDays = Number(editContractCycleCustom?.value) || 30;
      } else {
        cycleDays = Number(cycleSelectVal) || 30;
      }

      const debtStatus = document.getElementById('editContractStatus')?.value || 'ACTIVE';
      const reminderProfileId = document.getElementById('editContractReminderProfile')?.value || '';
      const reminderEnabled = Boolean(document.getElementById('editContractReminderEnabled')?.checked);
      const customReminderTimes = document.getElementById('editContractCustomTimes')?.value?.trim() || '';

      const btnSave = document.getElementById('btnSaveEditContract');
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = '⏳ กำลังบันทึก...';
      }

      try {
        const res = await adminFetch(`/api/admin/contracts/${encodeURIComponent(debtId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            totalAmount,
            remainingBalance,
            installmentAmount,
            dueDate,
            cycleDays,
            debtStatus,
            reminderProfileId,
            reminderEnabled,
            customReminderTimes
          })
        });

        const data = await res.json();
        if (data.success) {
          showToast(`แก้ไขสัญญา ${debtId} สำเร็จ!`, '✅');
          window.closeEditContractModal();

          // อัปเดตข้อมูลสัญญาในเครื่องทันที
          const cIndex = store.contracts.findIndex(c => c.debtId === debtId);
          if (cIndex > -1) {
            const current = store.contracts[cIndex];
            const debtor = (store.debtors || []).find(d => d.userId === userId);
            store.contracts[cIndex] = {
              ...current,
              userId,
              debtorName: debtor ? (debtor.fullName || debtor.displayName) : current.debtorName,
              totalAmount,
              remainingBalance,
              installmentAmount,
              dueDate,
              cycleDays,
              debtStatus,
              reminderProfileId,
              reminderEnabled,
              customReminderTimes
            };
          }

          renderContractsTable();
          updateSelectedDebtorHero();
          eventBus.emit('stats:needsRefresh');
        } else {
          showToast(data.message || 'ไม่สามารถแก้ไขสัญญาได้', '❌');
        }
      } catch (err) {
        showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
      } finally {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.textContent = '💾 บันทึกการแก้ไข';
        }
      }
    });
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
          <button class="btn-action-icon edit" onclick="openEditContractModal('${c.debtId}')" title="แก้ไขรายละเอียดสัญญา">
            ✏️
          </button>
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
window.openEditContractModal = function(debtId) {
  const contract = (store.contracts || []).find(c => c.debtId === debtId);
  if (!contract) {
    showToast('ไม่พบข้อมูลสัญญา ' + debtId, '⚠️');
    return;
  }

  const modal = document.getElementById('modalEditContract');
  const elDebtId = document.getElementById('editContractDebtId');
  const elSub = document.getElementById('modalEditContractSub');
  const elUserId = document.getElementById('editContractUserId');
  const elTotal = document.getElementById('editContractTotalAmount');
  const elRemaining = document.getElementById('editContractRemainingBalance');
  const elInstallment = document.getElementById('editContractInstallmentAmount');
  const elDueDate = document.getElementById('editContractDueDate');
  const elCycle = document.getElementById('editContractCycleDays');
  const elCycleCustom = document.getElementById('editContractCycleCustom');
  const elStatus = document.getElementById('editContractStatus');
  const elProfile = document.getElementById('editContractReminderProfile');
  const elEnabled = document.getElementById('editContractReminderEnabled');
  const btnDelete = document.getElementById('btnDeleteFromEditModal');

  if (elDebtId) elDebtId.value = contract.debtId;
  if (elSub) elSub.textContent = `รหัส: ${contract.debtId} | เจ้าของเดิม: ${contract.debtorName || contract.userId}`;

  // Populate debtors dropdown
  if (elUserId) {
    const debtorsList = store.debtors || [];
    elUserId.innerHTML = debtorsList.map(d => {
      const isSelected = d.userId === contract.userId ? 'selected' : '';
      return `<option value="${d.userId}" ${isSelected}>👤 ${d.fullName || d.displayName} (${d.userId})</option>`;
    }).join('');
    if (!debtorsList.some(d => d.userId === contract.userId)) {
      elUserId.insertAdjacentHTML('afterbegin', `<option value="${contract.userId}" selected>👤 ${contract.debtorName || contract.userId} (ปัจจุบัน)</option>`);
    }
  }

  if (elTotal) elTotal.value = contract.totalAmount || 0;
  if (elRemaining) elRemaining.value = contract.remainingBalance !== undefined ? contract.remainingBalance : (contract.totalAmount || 0);
  if (elInstallment) elInstallment.value = contract.installmentAmount || 0;
  if (elDueDate) elDueDate.value = contract.dueDate || '';

  // Cycle days
  const cycle = Number(contract.cycleDays) || 30;
  if (elCycle) {
    if ([1, 7, 15, 30].includes(cycle)) {
      elCycle.value = String(cycle);
      if (elCycleCustom) elCycleCustom.style.display = 'none';
    } else {
      elCycle.value = 'custom';
      if (elCycleCustom) {
        elCycleCustom.value = cycle;
        elCycleCustom.style.display = 'block';
      }
    }
  }

  if (elStatus) elStatus.value = contract.debtStatus || 'ACTIVE';

  // Reminder profiles
  if (elProfile) {
    elProfile.innerHTML = '<option value="">⚙️ ใช้รูปแบบเริ่มต้น (Default Profile)</option>' +
      (store.reminderProfiles || []).map(p => {
        const isSel = p.profileId === contract.reminderProfileId ? 'selected' : '';
        return `<option value="${p.profileId}" ${isSel}>${p.name}${p.isDefault ? ' [เริ่มต้น]' : ''} (${p.frequencyType})</option>`;
      }).join('');
  }

  if (elEnabled) elEnabled.checked = contract.reminderEnabled !== false;

  const elCustomTimes = document.getElementById('editContractCustomTimes');
  if (elCustomTimes) elCustomTimes.value = contract.customReminderTimes || '';

  // Delete button inside modal
  if (btnDelete) {
    btnDelete.onclick = () => {
      window.closeEditContractModal();
      window.deleteContract(contract.debtId);
    };
  }

  if (modal) {
    modal.classList.add('open');
    modal.classList.remove('hidden');
  }
};

window.editContract = window.openEditContractModal;

window.closeEditContractModal = function() {
  const modal = document.getElementById('modalEditContract');
  if (modal) {
    modal.classList.remove('open');
    modal.classList.add('hidden');
  }
};

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
  const contract = (store.contracts || []).find(c => c.debtId === debtId);
  const remainText = contract ? ` (ยอดคงเหลือ ฿${Number(contract.remainingBalance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })})` : '';
  
  if (!confirm(`⚠️ ยืนยันการลบสัญญา ${debtId}${remainText} ใช่หรือไม่?\n\nการลบนี้จะนำข้อมูลสัญญาออกจากระบบและ Google Sheet ทันที`)) return;

  store.setContracts(store.contracts.filter(c => c.debtId !== debtId));
  renderContractsTable();
  updateSelectedDebtorHero();

  try {
    const res = await adminFetch(`/api/admin/contracts/${debtId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`ลบสัญญา ${debtId} สำเร็จ`, '✅');
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
