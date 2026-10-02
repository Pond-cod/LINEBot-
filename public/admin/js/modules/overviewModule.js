/**
 * Overview & Analytics Module
 * Displays financial summary cards, active contracts count, pending slips badge, and automated cron triggers.
 */

import { adminFetch, formatMoney, showToast } from '../core/api.js';
import { store, eventBus } from '../core/state.js';

let statRemaining = null;
let statPendingSlips = null;
let statDueToday = null;
let statTotalContracts = null;
let statTotalDebtors = null;
let sidebarContractsBadge = null;
let sidebarSlipsBadge = null;

let isInitialized = false;

function initDomElements() {
  statRemaining = document.getElementById('statRemaining');
  statPendingSlips = document.getElementById('statPendingSlips');
  statDueToday = document.getElementById('statDueToday');
  statTotalContracts = document.getElementById('statTotalContracts');
  statTotalDebtors = document.getElementById('statTotalDebtors');
  sidebarContractsBadge = document.getElementById('sidebarContractsBadge');
  sidebarSlipsBadge = document.getElementById('sidebarSlipsBadge');

  const btnTriggerCronNow = document.getElementById('btnTriggerCronNow');
  const btnTopTriggerCron = document.getElementById('btnTopTriggerCron');

  if (btnTriggerCronNow) btnTriggerCronNow.addEventListener('click', triggerCronExecution);
  if (btnTopTriggerCron) btnTopTriggerCron.addEventListener('click', triggerCronExecution);

  eventBus.on('stats:needsRefresh', () => loadStats());
}

export async function mount() {
  if (!isInitialized) {
    initDomElements();
    isInitialized = true;
  }

  await loadStats();
}

export async function loadStats() {
  try {
    const res = await adminFetch('/api/admin/stats');
    const data = await res.json();

    if (data.success && data.stats) {
      const s = data.stats;
      store.stats = s;

      const totalContractsNum = s.activeCount ?? s.totalContracts ?? s.activeDebtsCount ?? 0;
      const totalDebtorsNum = s.totalDebtors ?? s.debtorsCount ?? 0;

      if (statRemaining) statRemaining.textContent = formatMoney(s.totalRemaining);
      if (statPendingSlips) statPendingSlips.textContent = `${s.pendingSlipsCount || 0} ใบ`;
      if (statDueToday) statDueToday.textContent = `${s.dueTodayCount || 0} ราย`;
      if (statTotalContracts) statTotalContracts.textContent = `${totalContractsNum} สัญญา`;
      if (statTotalDebtors) statTotalDebtors.textContent = `${totalDebtorsNum} คน`;

      if (sidebarContractsBadge) sidebarContractsBadge.textContent = totalContractsNum;
      if (sidebarSlipsBadge) {
        sidebarSlipsBadge.textContent = `${s.pendingSlipsCount || 0} ใบ`;
        sidebarSlipsBadge.style.display = (s.pendingSlipsCount > 0) ? 'inline-block' : 'none';
      }
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

export async function triggerCronExecution() {
  if (!confirm('ต้องการสั่งรันการตรวจสอบและยิงแจ้งเตือนวันนี้ทันทีใช่หรือไม่?')) return;
  showToast('กำลังสั่งรันระบบแจ้งเตือน...', '⏳');

  try {
    const res = await adminFetch('/api/reminder/trigger-now', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      const sum = data.summary || {};
      alert(`✅ สั่งยิงแจ้งเตือนเสร็จสมบูรณ์!\n\n📋 พบหนี้ที่เข้าเกณฑ์: ${sum.totalCandidates || 0} ราย\n✅ ส่งสำเร็จ: ${sum.sent || 0} ราย\n⏭️ ข้าม (ส่งไปแล้ววันนี้): ${sum.skipped || 0} ราย\n❌ ส่งไม่สำเร็จ: ${sum.failed || 0} ราย`);
      loadStats();
      eventBus.emit('reminderLogs:needsRefresh');
    } else {
      showToast(data.message || 'เกิดข้อผิดพลาดในการยิงแจ้งเตือน', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
}
