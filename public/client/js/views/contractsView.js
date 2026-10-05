/**
 * Client Portal: All Contracts Sub-View (#/contracts)
 * Displays complete directory of debt contracts matching the Admin Portal specs:
 * - 3-Stat Summary Header (Total Contracts, Total Principal ฿19,900, Total Remaining ฿18,000)
 * - Realtime Search & Status Filter
 * - Full-detail Contract Cards with Progress Bars, Due Dates, and Direct-to-Pay Action
 */

import { store, eventBus, sortDebtsByDueDate } from '../core/clientState.js';
import { clientRouter } from '../core/clientRouter.js';
import { showToast } from '../core/clientApi.js';
import { openContractDetailModal, selectAndGoToPay } from './dashboardView.js';

let currentSearchQuery = '';
let currentStatusFilter = 'ALL';

export function initContractsView() {
  const contractsSearchInput = document.getElementById('contractsSearchInput');
  const contractsStatusFilter = document.getElementById('contractsStatusFilter');
  const btnRefreshContracts = document.getElementById('btnRefreshContracts');
  const btnSyncContractsRetry = document.getElementById('btnSyncContractsRetry');

  if (contractsSearchInput) {
    contractsSearchInput.addEventListener('input', (e) => {
      currentSearchQuery = (e.target.value || '').trim().toLowerCase();
      filterAndRenderContracts();
    });
  }

  if (contractsStatusFilter) {
    contractsStatusFilter.addEventListener('change', (e) => {
      currentStatusFilter = e.target.value || 'ALL';
      filterAndRenderContracts();
    });
  }

  if (btnRefreshContracts) {
    btnRefreshContracts.addEventListener('click', () => {
      btnRefreshContracts.classList.add('spinning');
      eventBus.emit('sync:requested');
      setTimeout(() => {
        if (btnRefreshContracts) btnRefreshContracts.classList.remove('spinning');
      }, 1000);
    });
  }

  if (btnSyncContractsRetry) {
    btnSyncContractsRetry.addEventListener('click', () => {
      btnSyncContractsRetry.textContent = '⏳ กำลังซิงค์ข้อมูล...';
      eventBus.emit('sync:requested');
      setTimeout(() => {
        if (btnSyncContractsRetry) btnSyncContractsRetry.innerHTML = '🔄 ซิงค์ข้อมูลสัญญาใหม่';
      }, 1500);
    });
  }

  // Subscribe to updates from eventBus
  eventBus.on('data:updated', (data) => {
    renderContractsView(data);
  });

  eventBus.on('user:updated', () => {
    renderContractsView(store.clientData);
  });

  // Re-render immediately when user navigates into contracts view tab
  eventBus.on('route:changed', ({ viewId }) => {
    if (viewId === 'view-contracts') {
      renderContractsView(store.clientData);
    }
  });

  // Initial render
  renderContractsView(store.clientData);
}

export function renderContractsView(data) {
  const debts = data?.debts || [];
  
  // 1. Calculate Summary Stats
  const totalPrincipalAll = data?.totalPrincipalAll !== undefined
    ? Number(data.totalPrincipalAll)
    : debts.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);

  const totalRemainingAll = data?.totalRemainingAll !== undefined
    ? Number(data.totalRemainingAll)
    : debts.reduce((sum, d) => sum + (Number(d.remainingBalance) || 0), 0);

  const activeCount = debts.filter(d => d.debtStatus === 'ACTIVE' || d.debtStatus === 'OVERDUE').length;

  // 2. Update Header Stat Cards
  const contractsStatTotalCount = document.getElementById('contractsStatTotalCount');
  const contractsStatTotalPrincipal = document.getElementById('contractsStatTotalPrincipal');
  const contractsStatTotalRemaining = document.getElementById('contractsStatTotalRemaining');

  if (contractsStatTotalCount) {
    contractsStatTotalCount.textContent = `${debts.length} สัญญา (${activeCount} ผ่อนอยู่)`;
  }
  if (contractsStatTotalPrincipal) {
    contractsStatTotalPrincipal.textContent = `฿${totalPrincipalAll.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  }
  if (contractsStatTotalRemaining) {
    contractsStatTotalRemaining.textContent = `฿${totalRemainingAll.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  }

  // 3. Render filtered contracts
  filterAndRenderContracts();
}

export function filterAndRenderContracts() {
  const allContractsCardsList = document.getElementById('allContractsCardsList');
  const contractsEmptyState = document.getElementById('contractsEmptyState');
  const contractsCountBadge = document.getElementById('contractsCountBadge');
  if (!allContractsCardsList) return;

  const debts = store.clientData?.debts || [];

  // Filter
  const filtered = debts.filter(d => {
    // Search by debtId or debtorName
    const id = (d.debtId || '').toLowerCase();
    const name = (d.debtorName || '').toLowerCase();
    const matchesSearch = !currentSearchQuery || id.includes(currentSearchQuery) || name.includes(currentSearchQuery);

    // Filter by status
    const status = (d.debtStatus || 'ACTIVE').toUpperCase();
    let matchesStatus = true;
    if (currentStatusFilter === 'ACTIVE') {
      matchesStatus = status === 'ACTIVE';
    } else if (currentStatusFilter === 'OVERDUE') {
      matchesStatus = status === 'OVERDUE';
    } else if (currentStatusFilter === 'PAID') {
      matchesStatus = status === 'PAID' || status === 'COMPLETED';
    }

    return matchesSearch && matchesStatus;
  });

  if (contractsCountBadge) {
    contractsCountBadge.textContent = `${filtered.length} จาก ${debts.length} รายการ`;
  }

  if (filtered.length === 0) {
    allContractsCardsList.innerHTML = '';
    if (contractsEmptyState) {
      contractsEmptyState.style.display = 'flex';
      const emptyText = document.getElementById('contractsEmptyStateText');
      if (emptyText) {
        emptyText.textContent = debts.length === 0 
          ? 'ยังไม่พบสัญญาหนี้ที่ผูกกับบัญชีนี้' 
          : 'ไม่พบสัญญาหนี้ที่ตรงกับเงื่อนไขการค้นหา';
      }
    }
    return;
  }

  if (contractsEmptyState) {
    contractsEmptyState.style.display = 'none';
  }

  const sortedFiltered = sortDebtsByDueDate(filtered);

  allContractsCardsList.innerHTML = sortedFiltered.map(d => {
    const remain = Number(d.remainingBalance) || 0;
    const total = Number(d.totalAmount) || 0;
    const install = Number(d.installmentAmount) || 0;
    const paid = Math.max(0, total - remain);
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
    const isOverdue = d.debtStatus === 'OVERDUE';
    const statusLabel = isOverdue ? 'เกินกำหนดชำระ' : (d.debtStatus === 'ACTIVE' ? 'กำลังผ่อน' : (d.debtStatus || 'ปกติ'));
    const statusClass = (d.debtStatus || 'ACTIVE').toLowerCase();

    return `
      <div class="debt-contract-card-full" id="contract-card-${d.debtId}">
        <div class="contract-card-topbar">
          <div class="contract-id-pill">
            <span class="card-icon">📑</span>
            <span class="card-id-text">${d.debtId}</span>
          </div>
          <span class="debt-status-pill status-${statusClass}">${statusLabel}</span>
        </div>

        <div class="contract-main-grid">
          <div class="contract-stat-box highlight">
            <span class="stat-box-label">ยอดคงเหลือสุทธิ</span>
            <span class="stat-box-val remaining">฿${remain.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="contract-stat-box">
            <span class="stat-box-label">ค่างวดต่องวด</span>
            <span class="stat-box-val installment">฿${install.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="contract-stat-box">
            <span class="stat-box-label">วงเงินกู้รวม</span>
            <span class="stat-box-val total">฿${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="contract-stat-box">
            <span class="stat-box-label">กำหนดชำระงวดนี้</span>
            <span class="stat-box-val due ${isOverdue ? 'alert-text' : ''}">${d.dueDate || '-'} (รอบ ${d.cycleDays || 30} วัน)</span>
          </div>
        </div>

        <div class="contract-progress-wrapper">
          <div class="progress-info-row">
            <span>ชำระแล้ว ฿${paid.toLocaleString('th-TH')} (${pct}%)</span>
            <span>คงเหลือ ฿${remain.toLocaleString('th-TH')}</span>
          </div>
          <div class="progress-bar-bg mini">
            <div class="progress-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>

        <div class="contract-action-bar">
          <button type="button" class="btn-contract-action view" data-debt-id="${d.debtId}">
            🔍 ดูรายละเอียดสัญญา
          </button>
          <button type="button" class="btn-contract-action pay" data-debt-id="${d.debtId}" data-installment="${install}">
            💳 ชำระสัญญานี้ (฿${install.toLocaleString('th-TH')})
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Bind View Detail modal buttons
  allContractsCardsList.querySelectorAll('.btn-contract-action.view').forEach(btn => {
    btn.addEventListener('click', () => {
      const debtId = btn.getAttribute('data-debt-id');
      openContractDetailModal(debtId);
    });
  });

  // Bind Pay contract buttons
  allContractsCardsList.querySelectorAll('.btn-contract-action.pay').forEach(btn => {
    btn.addEventListener('click', () => {
      const debtId = btn.getAttribute('data-debt-id');
      const installment = btn.getAttribute('data-installment');
      selectAndGoToPay(debtId, installment);
    });
  });
}
