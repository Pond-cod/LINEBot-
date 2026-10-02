/**
 * Client Portal: Dashboard Sub-View (#/dashboard)
 * Handles Apple Wallet-style Virtual Credit Card, Progress Bar, and Metrics
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

  const debt = data?.activeDebt;
  const isLoggedIn = typeof liff !== 'undefined' && liff.isLoggedIn();

  if (debt) {
    if (heroDebtId) heroDebtId.textContent = `สัญญาเลขที่: ${debt.debtId}`;
    if (heroRemaining) {
      heroRemaining.textContent = `฿${Number(debt.remainingBalance).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    }
    if (metricDueDate) metricDueDate.textContent = debt.dueDate || '-';
    if (metricInstallment) {
      metricInstallment.textContent = `฿${Number(debt.installmentAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    }

    const total = Number(debt.totalAmount) || 0;
    const remaining = Number(debt.remainingBalance) || 0;
    const paid = Math.max(0, total - remaining);
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressPercent) {
      progressPercent.textContent = `${pct}% (จ่ายแล้ว ฿${paid.toLocaleString('th-TH')})`;
    }

    if (clientStatusBadge && isLoggedIn) {
      clientStatusBadge.textContent = debt.debtStatus === 'ACTIVE' ? '🟢 สัญญาปกติ' : debt.debtStatus;
      clientStatusBadge.className = 'header-badge logged-in';
    }

    if (slipAmountInput && !slipAmountInput.value) {
      slipAmountInput.value = debt.installmentAmount || '';
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
