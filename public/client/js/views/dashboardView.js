/**
 * Client Portal: Dashboard Sub-View (#/dashboard)
 * Handles Apple Wallet-style Virtual Credit Card, Multi-Contract Portfolio Summary,
 * Contract Switcher Chips, All Debts Directory Cards, and Direct Per-Contract Payment
 */

import { store, eventBus, sortDebtsByDueDate } from '../core/clientState.js';
import { clientRouter } from '../core/clientRouter.js';
import { showToast } from '../core/clientApi.js';

export function initDashboardView() {
  const btnGoToPay = document.getElementById('btnGoToPay');
  if (btnGoToPay) {
    btnGoToPay.addEventListener('click', () => {
      const selectedDebt = store.getSelectedDebt();
      if (selectedDebt && selectedDebt.installmentAmount) {
        const slipAmountInput = document.getElementById('slipAmountInput');
        if (slipAmountInput) {
          slipAmountInput.value = selectedDebt.installmentAmount;
        }
      }
      clientRouter.navigateTo('#/pay');
    });
  }

  const btnToggleAllOverview = document.getElementById('btnToggleAllOverview');
  if (btnToggleAllOverview) {
    btnToggleAllOverview.addEventListener('click', () => {
      store.setSelectedDebtId('ALL');
      const balanceHeroCard = document.getElementById('balanceHeroCard');
      if (balanceHeroCard) {
        balanceHeroCard.scrollIntoView({ behavior: 'smooth' });
      }
      showToast('แสดงภาพรวมหนี้ทั้งหมดทุกสัญญา', '📊');
    });
  }

  // Contract Detail Modal Close Bindings
  const btnCloseContractModal = document.getElementById('btnCloseContractModal');
  const btnModalDismiss = document.getElementById('btnModalDismiss');
  const contractDetailModal = document.getElementById('contractDetailModal');

  if (btnCloseContractModal) {
    btnCloseContractModal.addEventListener('click', closeContractDetailModal);
  }
  if (btnModalDismiss) {
    btnModalDismiss.addEventListener('click', closeContractDetailModal);
  }
  if (contractDetailModal) {
    contractDetailModal.addEventListener('click', (e) => {
      if (e.target === contractDetailModal) {
        closeContractDetailModal();
      }
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeContractDetailModal();
    }
  });

  const btnSyncEmptyState = document.getElementById('btnSyncEmptyState');
  if (btnSyncEmptyState) {
    btnSyncEmptyState.addEventListener('click', () => {
      eventBus.emit('sync:requested');
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
  const heroLabel = document.getElementById('heroLabel');
  const heroRemaining = document.getElementById('heroRemaining');
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const progressTitle = document.getElementById('progressTitle');
  const metricDueDateTitle = document.getElementById('metricDueDateTitle');
  const metricDueDate = document.getElementById('metricDueDate');
  const metricInstallmentTitle = document.getElementById('metricInstallmentTitle');
  const metricInstallment = document.getElementById('metricInstallment');
  const actionBannerTitle = document.getElementById('actionBannerTitle');
  const actionBannerSubtitle = document.getElementById('actionBannerSubtitle');
  const btnGoToPay = document.getElementById('btnGoToPay');
  const clientStatusBadge = document.getElementById('clientStatusBadge');
  const slipAmountInput = document.getElementById('slipAmountInput');

  // Portfolio Multi-Contract Elements
  const portfolioSummaryBar = document.getElementById('portfolioSummaryBar');
  const portfolioTotalAmount = document.getElementById('portfolioTotalAmount');
  const portfolioBadge = document.getElementById('portfolioBadge');
  const contractSelectorContainer = document.getElementById('contractSelectorContainer');
  const contractChipsList = document.getElementById('contractChipsList');

  // Breakdown Section Elements
  const debtsBreakdownSection = document.getElementById('debtsBreakdownSection');
  const debtsListCount = document.getElementById('debtsListCount');
  const debtsCardsList = document.getElementById('debtsCardsList');

  // เฉพาะสัญญาที่ยังมียอดค้างชำระ (ตัดสัญญาที่ชำระครบแล้วออก)
  const rawDebts = data?.debts || [];
  const unpaidDebts = rawDebts.filter(d => {
    const remain = Number(d.remainingBalance) || 0;
    const status = String(d.debtStatus || '').toUpperCase();
    return status !== 'PAID' && status !== 'COMPLETED' && remain > 0;
  });
  const debts = sortDebtsByDueDate(unpaidDebts);
  const selectedDebt = store.getSelectedDebt();
  const isViewingAll = store.isViewingAllDebts();
  const isLoggedIn = store.currentUser && store.currentUser.userId && !store.currentUser.userId.startsWith('U_');

  // 1. Render Portfolio Multi-Contract Summary & Top Switcher Chips
  if (debts.length > 1) {
    const totalRemainingAll = data?.totalRemainingAll !== undefined 
      ? Number(data.totalRemainingAll) 
      : debts.reduce((sum, d) => sum + (Number(d.remainingBalance) || 0), 0);

    if (portfolioSummaryBar) {
      portfolioSummaryBar.style.display = 'flex';
    }
    if (portfolioTotalAmount) {
      portfolioTotalAmount.textContent = `฿${totalRemainingAll.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    }
    if (portfolioBadge) {
      portfolioBadge.textContent = `${debts.length} สัญญา`;
    }

    if (contractSelectorContainer) {
      contractSelectorContainer.style.display = 'block';
    }

    if (contractChipsList) {
      // 1.1 First chip: View all debts overview
      const chipAll = `
        <button type="button" class="contract-chip chip-all ${isViewingAll ? 'active' : ''}" data-debt-id="ALL">
          <span class="contract-chip-id">📊 หนี้รวมทั้งหมด</span>
          <span class="contract-chip-val">฿${totalRemainingAll.toLocaleString('th-TH')}</span>
        </button>
      `;

      // 1.2 Subsequent chips: Individual contracts
      const chipsDebts = debts.map(d => {
        const isCurrent = !isViewingAll && selectedDebt && d.debtId === selectedDebt.debtId;
        const remain = Number(d.remainingBalance) || 0;
        return `
          <button type="button" class="contract-chip ${isCurrent ? 'active' : ''}" data-debt-id="${d.debtId}">
            <span class="contract-chip-id">📑 ${d.debtId}</span>
            <span class="contract-chip-val">฿${remain.toLocaleString('th-TH')}</span>
          </button>
        `;
      }).join('');

      contractChipsList.innerHTML = chipAll + chipsDebts;

      // Bind click handlers to chips
      contractChipsList.querySelectorAll('.contract-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const debtId = btn.getAttribute('data-debt-id');
          store.setSelectedDebtId(debtId);
          if (debtId === 'ALL') {
            showToast('สลับดูหนี้รวมทั้งหมด', '📊');
          } else {
            showToast(`เลือกดูสัญญา: ${debtId}`, '📑');
          }
        });
      });
    }
  } else {
    if (portfolioSummaryBar) portfolioSummaryBar.style.display = 'none';
    if (contractSelectorContainer) contractSelectorContainer.style.display = 'none';
  }

  // 2. Render Virtual Credit Card & Metrics Grid
  if (debts.length > 0) {
    if (isViewingAll && debts.length > 1) {
      // MODE A: PORTFOLIO ALL DEBTS OVERVIEW
      const totalRemainingAll = debts.reduce((sum, d) => sum + (Number(d.remainingBalance) || 0), 0);
      const totalLoanAll = debts.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
      const totalInstallmentAll = debts.reduce((sum, d) => sum + (Number(d.installmentAmount) || 0), 0);
      const totalPaidAll = Math.max(0, totalLoanAll - totalRemainingAll);
      const pctAll = totalLoanAll > 0 ? Math.round((totalPaidAll / totalLoanAll) * 100) : 0;

      // ค้นหาวันครบกำหนดชำระที่เร็วที่สุด (เฉพาะสัญญาที่ยังต้องผ่อน)
      const activeDebtsForDue = debts.filter(d => (d.debtStatus === 'ACTIVE' || d.debtStatus === 'OVERDUE') && (Number(d.remainingBalance) || 0) > 0);
      const sortedDueDates = activeDebtsForDue
        .map(d => d.dueDate)
        .filter(Boolean)
        .sort();
      const earliestDue = sortedDueDates[0] || (debts[0]?.dueDate || '-');

      if (heroDebtId) heroDebtId.textContent = `📊 รวม ${debts.length} สัญญาที่เปิดอยู่`;
      if (heroLabel) heroLabel.textContent = 'ยอดหนี้รวมคงเหลือทุกสัญญา';
      if (heroRemaining) {
        heroRemaining.textContent = `฿${totalRemainingAll.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
      }

      if (progressBar) progressBar.style.width = `${pctAll}%`;
      if (progressTitle) progressTitle.textContent = 'ความคืบหน้ารวมทุกสัญญา';
      if (progressPercent) {
        progressPercent.textContent = `${pctAll}% (จ่ายแล้ว ฿${totalPaidAll.toLocaleString('th-TH')} จาก ฿${totalLoanAll.toLocaleString('th-TH')})`;
      }

      if (metricDueDateTitle) metricDueDateTitle.textContent = 'วันครบกำหนด (เร็วสุด)';
      if (metricDueDate) metricDueDate.textContent = earliestDue;
      if (metricInstallmentTitle) metricInstallmentTitle.textContent = 'ค่างวดรวมงวดนี้';
      if (metricInstallment) {
        metricInstallment.textContent = `฿${totalInstallmentAll.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
      }

      if (actionBannerTitle) actionBannerTitle.textContent = 'พร้อมชำระค่างวดงวดนี้?';
      if (actionBannerSubtitle) actionBannerSubtitle.textContent = 'เลือกชำระแต่ละสัญญาด้านล่าง หรือแตะเพื่อไปหน้าชำระเงิน';
      if (btnGoToPay) btnGoToPay.textContent = 'ชำระเงินเลย';

      if (clientStatusBadge && isLoggedIn) {
        clientStatusBadge.textContent = '🟢 บัญชี LINE';
        clientStatusBadge.className = 'header-badge logged-in';
      }
    } else if (selectedDebt) {
      // MODE B: INDIVIDUAL CONTRACT DETAILS
      const remain = Number(selectedDebt.remainingBalance) || 0;
      const total = Number(selectedDebt.totalAmount) || 0;
      const install = Number(selectedDebt.installmentAmount) || 0;
      const paid = Math.max(0, total - remain);
      const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

      if (heroDebtId) heroDebtId.textContent = `สัญญาเลขที่: ${selectedDebt.debtId}`;
      if (heroLabel) heroLabel.textContent = 'ยอดหนี้คงเหลือปัจจุบัน';
      if (heroRemaining) {
        heroRemaining.textContent = `฿${remain.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
      }

      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressTitle) progressTitle.textContent = 'ความคืบหน้าการชำระ';
      if (progressPercent) {
        progressPercent.textContent = `${pct}% (จ่ายแล้ว ฿${paid.toLocaleString('th-TH')} จาก ฿${total.toLocaleString('th-TH')})`;
      }

      if (metricDueDateTitle) metricDueDateTitle.textContent = 'วันครบกำหนดชำระ';
      if (metricDueDate) metricDueDate.textContent = selectedDebt.dueDate || '-';
      if (metricInstallmentTitle) metricInstallmentTitle.textContent = 'ค่างวดต่องวด';
      if (metricInstallment) {
        metricInstallment.textContent = `฿${install.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
      }

      if (actionBannerTitle) actionBannerTitle.textContent = `พร้อมชำระสัญญา ${selectedDebt.debtId}?`;
      if (actionBannerSubtitle) actionBannerSubtitle.textContent = `ค่างวดประจำงวด ฿${install.toLocaleString('th-TH')} (โอนเงินและแนบสลิปได้ทันที)`;
      if (btnGoToPay) btnGoToPay.textContent = `💳 ชำระสัญญานี้`;

      if (clientStatusBadge && isLoggedIn) {
        clientStatusBadge.textContent = selectedDebt.debtStatus === 'ACTIVE' ? '🟢 สัญญาปกติ' : (selectedDebt.debtStatus || 'ปกติ');
        clientStatusBadge.className = 'header-badge logged-in';
      }

      if (slipAmountInput && !slipAmountInput.value) {
        slipAmountInput.value = selectedDebt.installmentAmount || '';
      }
    }
  } else {
    // Empty state
    if (heroDebtId) {
      heroDebtId.textContent = isLoggedIn ? 'ยังไม่มีสัญญาหนี้ที่เปิดอยู่' : 'โหมดทดสอบ (กรุณาล็อกอิน)';
    }
    if (heroLabel) heroLabel.textContent = 'ยอดหนี้คงเหลือปัจจุบัน';
    if (heroRemaining) heroRemaining.textContent = '฿0.00';
    if (metricDueDateTitle) metricDueDateTitle.textContent = 'วันครบกำหนดชำระ';
    if (metricDueDate) metricDueDate.textContent = isLoggedIn ? 'ไม่มีหนี้ค้าง' : '-';
    if (metricInstallmentTitle) metricInstallmentTitle.textContent = 'ค่างวดต่องวด';
    if (metricInstallment) metricInstallment.textContent = '฿0.00';
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (actionBannerTitle) actionBannerTitle.textContent = 'พร้อมชำระเงินงวดนี้?';
    if (actionBannerSubtitle) actionBannerSubtitle.textContent = 'โอนเงินและแนบสลิปผ่านระบบได้ทันที';
    if (btnGoToPay) btnGoToPay.textContent = 'ชำระเงินเลย';
  }

  // 3. Render All Debts Cards Directory Section (เลือกชำระแต่ละสัญญา)
  const emptySyncBox = document.getElementById('emptySyncBox');
  if (debts.length > 0) {
    if (emptySyncBox) emptySyncBox.style.display = 'none';
    if (debtsBreakdownSection) debtsBreakdownSection.style.display = 'block';
    if (debtsListCount) debtsListCount.textContent = debts.length;

    if (debtsCardsList) {
      debtsCardsList.innerHTML = debts.map(d => {
        const isCurrent = !isViewingAll && selectedDebt && d.debtId === selectedDebt.debtId;
        const remain = Number(d.remainingBalance) || 0;
        const total = Number(d.totalAmount) || 0;
        const install = Number(d.installmentAmount) || 0;
        const paid = Math.max(0, total - remain);
        const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
        const statusLabel = d.debtStatus === 'ACTIVE' ? 'กำลังผ่อน' : (d.debtStatus === 'OVERDUE' ? 'เกินกำหนด' : (d.debtStatus || 'ปกติ'));

        return `
          <div class="debt-contract-card ${isCurrent ? 'selected' : ''}" id="debt-card-${d.debtId}">
            <div class="debt-card-header">
              <div class="debt-card-id-wrap">
                <span class="debt-card-icon">📑</span>
                <span class="debt-card-id">${d.debtId}</span>
              </div>
              <span class="debt-status-pill status-${(d.debtStatus || 'ACTIVE').toLowerCase()}">${statusLabel}</span>
            </div>

            <div class="debt-card-grid">
              <div class="debt-card-stat">
                <div class="debt-card-stat-label">ยอดหนี้คงเหลือ</div>
                <div class="debt-card-stat-val remaining">฿${remain.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
              </div>
              <div class="debt-card-stat">
                <div class="debt-card-stat-label">ค่างวดต่องวด</div>
                <div class="debt-card-stat-val installment">฿${install.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            <div class="debt-card-meta-row">
              <div class="debt-card-meta-item">
                <span class="meta-icon">📅</span>
                <span>กำหนดชำระ: <strong>${d.dueDate || '-'}</strong></span>
              </div>
              <div class="debt-card-meta-item">
                <span class="meta-icon">💰</span>
                <span>วงเงินกู้: ฿${total.toLocaleString('th-TH')}</span>
              </div>
            </div>

            <div class="debt-card-progress-wrap">
              <div class="debt-card-progress-labels">
                <span>ชำระแล้ว ฿${paid.toLocaleString('th-TH')} (${pct}%)</span>
                <span>คงเหลือ ฿${remain.toLocaleString('th-TH')}</span>
              </div>
              <div class="progress-bar-bg mini">
                <div class="progress-bar-fill" style="width: ${pct}%;"></div>
              </div>
            </div>

            <div class="debt-card-actions">
              <button type="button" class="btn-card-view-contract" data-debt-id="${d.debtId}">
                🔍 ดูรายละเอียด
              </button>
              <button type="button" class="btn-card-pay-contract" data-debt-id="${d.debtId}" data-installment="${install}">
                💳 ชำระสัญญานี้ (฿${install.toLocaleString('th-TH')})
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Bind handlers to "ดูรายละเอียด" (เปิด Contract Detail Modal)
      debtsCardsList.querySelectorAll('.btn-card-view-contract').forEach(btn => {
        btn.addEventListener('click', () => {
          const debtId = btn.getAttribute('data-debt-id');
          openContractDetailModal(debtId);
        });
      });

      // Bind handlers to "ชำระสัญญานี้" (Direct-to-Pay)
      debtsCardsList.querySelectorAll('.btn-card-pay-contract').forEach(btn => {
        btn.addEventListener('click', () => {
          const debtId = btn.getAttribute('data-debt-id');
          const installment = btn.getAttribute('data-installment');
          selectAndGoToPay(debtId, installment);
        });
      });
    }
  } else {
    if (emptySyncBox) emptySyncBox.style.display = 'flex';
    if (debtsBreakdownSection) debtsBreakdownSection.style.display = 'none';
  }
}

/**
 * สลับไปยังหน้าชำระเงิน (#/pay) พร้อมเลือกสัญญาและกรอกยอดค่างวดให้อัตโนมัติ
 */
export function selectAndGoToPay(debtId, installmentAmount) {
  if (debtId) {
    store.setSelectedDebtId(debtId);
  }
  const slipAmountInput = document.getElementById('slipAmountInput');
  if (slipAmountInput && installmentAmount) {
    slipAmountInput.value = installmentAmount;
  }
  closeContractDetailModal();
  showToast(`เลือกชำระสัญญา ${debtId || ''}`, '💳');
  clientRouter.navigateTo('#/pay');
}

/**
 * เปิดหน้าต่าง Modal ดูรายละเอียดสัญญาเชิงลึก
 */
export function openContractDetailModal(debtId) {
  const modal = document.getElementById('contractDetailModal');
  if (!modal) return;

  const debts = store.clientData?.debts || [];
  const debt = debts.find(d => d.debtId === debtId);
  if (!debt) {
    showToast(`ไม่พบข้อมูลสัญญา ${debtId}`, '⚠️');
    return;
  }

  const remain = Number(debt.remainingBalance) || 0;
  const total = Number(debt.totalAmount) || 0;
  const install = Number(debt.installmentAmount) || 0;
  const paid = Math.max(0, total - remain);
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const isOverdue = debt.debtStatus === 'OVERDUE';
  const statusLabel = isOverdue ? 'เกินกำหนดชำระ' : (debt.debtStatus === 'ACTIVE' ? 'กำลังผ่อนชำระ' : (debt.debtStatus || 'ปกติ'));

  // Fill Header
  const modalContractId = document.getElementById('modalContractId');
  const modalContractStatus = document.getElementById('modalContractStatus');
  if (modalContractId) modalContractId.textContent = debt.debtId;
  if (modalContractStatus) {
    modalContractStatus.textContent = statusLabel;
    modalContractStatus.className = `modal-status-badge ${isOverdue ? 'overdue' : ''}`;
  }

  // Fill Stats Grid
  const modalRemaining = document.getElementById('modalRemaining');
  const modalInstallment = document.getElementById('modalInstallment');
  const modalTotalAmount = document.getElementById('modalTotalAmount');
  const modalTotalPaid = document.getElementById('modalTotalPaid');
  if (modalRemaining) modalRemaining.textContent = `฿${remain.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  if (modalInstallment) modalInstallment.textContent = `฿${install.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  if (modalTotalAmount) modalTotalAmount.textContent = `฿${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  if (modalTotalPaid) modalTotalPaid.textContent = `฿${paid.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

  // Fill Progress Bar
  const modalProgressBarFill = document.getElementById('modalProgressBarFill');
  const modalProgressPercent = document.getElementById('modalProgressPercent');
  if (modalProgressBarFill) modalProgressBarFill.style.width = `${pct}%`;
  if (modalProgressPercent) modalProgressPercent.textContent = `${pct}% (ชำระแล้ว ฿${paid.toLocaleString('th-TH')})`;

  // Fill Terms & Dates
  const modalDueDate = document.getElementById('modalDueDate');
  const modalCycleDays = document.getElementById('modalCycleDays');
  const modalCreatedAt = document.getElementById('modalCreatedAt');
  if (modalDueDate) modalDueDate.textContent = debt.dueDate || '-';
  if (modalCycleDays) modalCycleDays.textContent = `ทุก ${debt.cycleDays || 30} วัน`;
  if (modalCreatedAt) modalCreatedAt.textContent = debt.createdAt || '-';

  // Fill Payment History of this contract
  const modalPaymentsList = document.getElementById('modalPaymentsList');
  if (modalPaymentsList) {
    const allPayments = store.clientData?.payments || [];
    const contractPayments = allPayments.filter(p => p.debtId === debt.debtId);

    if (contractPayments.length > 0) {
      modalPaymentsList.innerHTML = contractPayments.map(p => {
        const isVerified = p.verificationStatus === 'VERIFIED' || p.verificationStatus === 'APPROVED';
        const statusText = isVerified ? '✓ อนุมัติแล้ว' : '⏳ รอตรวจสอบ';
        const statusClass = isVerified ? 'verified' : 'pending';
        const amountNum = Number(p.amount) || 0;
        return `
          <div class="modal-payment-item">
            <div class="modal-payment-left">
              <span class="modal-payment-amount">+฿${amountNum.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              <span class="modal-payment-date">📅 ${p.uploadedAt || '-'}</span>
            </div>
            <span class="modal-payment-status ${statusClass}">${statusText}</span>
          </div>
        `;
      }).join('');
    } else {
      modalPaymentsList.innerHTML = '<div class="empty-payments-hint">ยังไม่มีประวัติการชำระเงินสำหรับสัญญานี้</div>';
    }
  }

  // Setup Pay Now Button
  const btnModalPayNow = document.getElementById('btnModalPayNow');
  if (btnModalPayNow) {
    btnModalPayNow.textContent = `💳 ชำระสัญญานี้ทันที (฿${install.toLocaleString('th-TH')})`;
    btnModalPayNow.onclick = () => {
      selectAndGoToPay(debt.debtId, install);
    };
  }

  // Show Modal
  modal.style.display = 'flex';
}

/**
 * ปิดหน้าต่าง Modal ดูรายละเอียดสัญญา
 */
export function closeContractDetailModal() {
  const modal = document.getElementById('contractDetailModal');
  if (modal) {
    modal.style.display = 'none';
  }
}
