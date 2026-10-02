/**
 * Client Portal: Dashboard Sub-View (#/dashboard)
 * Handles Apple Wallet-style Virtual Credit Card, Multi-Contract Portfolio Summary,
 * Contract Switcher Chips, Progress Bar, and Metrics
 */

import { store, eventBus } from '../core/clientState.js';
import { clientRouter } from '../core/clientRouter.js';

export function initDashboardView() {
  const btnGoToPay = document.getElementById('btnGoToPay');
  if (btnGoToPay) {
    btnGoToPay.addEventListener('click', () => {
      clientRouter.navigateTo('#/pay');
    });
  }

  // Subscribe to data updates from eventBus
  eventBus.on('data:updated', (data) => {
    renderDashboard(data);
  });

  // Re-render when user profile/login state changes
  eventBus.on('user:updated', () => {
    renderDashboard(store.clientData);
  });

  // Re-render when a different debt contract is selected
  eventBus.on('debt:selected', () => {
    renderDashboard(store.clientData);
  });

  // Initial render from current store
  renderDashboard(store.clientData);
}

export function renderDashboard(data) {
  const heroDebtId = document.getElementById('heroDebtId');
  const heroRemaining = document.getElementById('heroRemaining');
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const metricDueDate = document.getElementById('metricDueDate');
  const metricInstallment = document.getElementById('metricInstallment');
  const clientStatusBadge = document.getElementById('clientStatusBadge');
  const slipAmountInput = document.getElementById('slipAmountInput');

  // Portfolio Multi-Contract Elements
  const portfolioSummaryBar = document.getElementById('portfolioSummaryBar');
  const portfolioTotalAmount = document.getElementById('portfolioTotalAmount');
  const portfolioBadge = document.getElementById('portfolioBadge');
  const contractSelectorContainer = document.getElementById('contractSelectorContainer');
  const contractChipsList = document.getElementById('contractChipsList');

  const debts = data?.debts || [];
  const selectedDebt = store.getSelectedDebt();
  const isLoggedIn = store.currentUser && store.currentUser.userId && !store.currentUser.userId.startsWith('U_');

  // 1. Render Portfolio Multi-Contract Summary & Chips
  if (debts.length > 1) {
    const totalAll = data?.totalRemainingAll !== undefined ? Number(data.totalRemainingAll) : debts.reduce((sum, d) => sum + (Number(d.remainingBalance) || 0), 0);

    if (portfolioSummaryBar) {
      portfolioSummaryBar.style.display = 'flex';
    }
    if (portfolioTotalAmount) {
      portfolioTotalAmount.textContent = `฿${totalAll.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    }
    if (portfolioBadge) {
      portfolioBadge.textContent = `${debts.length} สัญญา`;
    }

    if (contractSelectorContainer) {
      contractSelectorContainer.style.display = 'block';
    }

    if (contractChipsList) {
      contractChipsList.innerHTML = debts.map(d => {
        const isCurrent = selectedDebt && d.debtId === selectedDebt.debtId;
        const remain = Number(d.remainingBalance) || 0;
        return `
          <button type="button" class="contract-chip ${isCurrent ? 'active' : ''}" data-debt-id="${d.debtId}">
            <span class="contract-chip-id">📑 ${d.debtId}</span>
            <span class="contract-chip-val">฿${remain.toLocaleString('th-TH')}</span>
          </button>
        `;
      }).join('');

      // Bind click handlers to chips
      contractChipsList.querySelectorAll('.contract-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const debtId = btn.getAttribute('data-debt-id');
          store.setSelectedDebtId(debtId);
        });
      });
    }
  } else {
    if (portfolioSummaryBar) portfolioSummaryBar.style.display = 'none';
    if (contractSelectorContainer) contractSelectorContainer.style.display = 'none';
  }

  // 2. Render Virtual Credit Card for Selected Contract
  if (selectedDebt) {
    if (heroDebtId) heroDebtId.textContent = `สัญญาเลขที่: ${selectedDebt.debtId}`;
    if (heroRemaining) {
      heroRemaining.textContent = `฿${Number(selectedDebt.remainingBalance).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    }
    if (metricDueDate) metricDueDate.textContent = selectedDebt.dueDate || '-';
    if (metricInstallment) {
      metricInstallment.textContent = `฿${Number(selectedDebt.installmentAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    }

    const total = Number(selectedDebt.totalAmount) || 0;
    const remaining = Number(selectedDebt.remainingBalance) || 0;
    const paid = Math.max(0, total - remaining);
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressPercent) {
      progressPercent.textContent = `${pct}% (จ่ายแล้ว ฿${paid.toLocaleString('th-TH')})`;
    }

    if (clientStatusBadge && isLoggedIn) {
      clientStatusBadge.textContent = selectedDebt.debtStatus === 'ACTIVE' ? '🟢 สัญญาปกติ' : (selectedDebt.debtStatus || 'ปกติ');
      clientStatusBadge.className = 'header-badge logged-in';
    }

    if (slipAmountInput && !slipAmountInput.value) {
      slipAmountInput.value = selectedDebt.installmentAmount || '';
    }
  } else {
    if (heroDebtId) {
      heroDebtId.textContent = isLoggedIn ? 'ยังไม่มีสัญญาหนี้ที่เปิดอยู่' : 'โหมดทดสอบ (กรุณาล็อกอิน)';
    }
    if (heroRemaining) heroRemaining.textContent = '฿0.00';
    if (metricDueDate) metricDueDate.textContent = isLoggedIn ? 'ไม่มีหนี้ค้าง' : '-';
    if (metricInstallment) metricInstallment.textContent = '฿0.00';
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
  }
}
