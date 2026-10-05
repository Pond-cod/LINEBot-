/**
 * New Contract Creator Module (Wizard & Live Real-Time Calculator)
 * Handles debtor selection, installment calculator, live preview, and contract submission with LINE push.
 */

import { adminFetch, formatMoney, showToast } from '../core/api.js';
import { store, eventBus } from '../core/state.js';
import { router } from '../core/router.js';

let createContractWizardForm = null;
let wizardDebtorSelect = null;
let wizardUserId = null;
let wizardDebtorName = null;
let wizardPhone = null;
let wizardIdCard = null;
let wizardTotalAmount = null;
let wizardInstallmentCount = null;
let wizardInstallmentAmount = null;
let wizardCycleDays = null;
let wizardDueDate = null;
let wizardReminderProfile = null;
let wizardReminderEnabled = null;
let wizardSendPushCheck = null;
let btnSubmitWizardContract = null;
let btnResetWizardForm = null;

let prevTotalAmount = null;
let prevDebtorName = null;
let prevInstallment = null;
let prevDueDate = null;
let prevCycle = null;
let prevReminderProfile = null;
let prevSendPush = null;

let isSubmitting = false;
let isInitialized = false;

function initDomElements() {
  createContractWizardForm = document.getElementById('createContractWizardForm');
  wizardDebtorSelect = document.getElementById('wizardDebtorSelect');
  wizardUserId = document.getElementById('wizardUserId');
  wizardDebtorName = document.getElementById('wizardDebtorName');
  wizardPhone = document.getElementById('wizardPhone');
  wizardIdCard = document.getElementById('wizardIdCard');
  wizardTotalAmount = document.getElementById('wizardTotalAmount');
  wizardInstallmentCount = document.getElementById('wizardInstallmentCount');
  wizardInstallmentAmount = document.getElementById('wizardInstallmentAmount');
  wizardCycleDays = document.getElementById('wizardCycleDays');
  wizardDueDate = document.getElementById('wizardDueDate');
  wizardReminderProfile = document.getElementById('wizardReminderProfile');
  wizardReminderEnabled = document.getElementById('wizardReminderEnabled');
  wizardSendPushCheck = document.getElementById('wizardSendPushCheck');
  btnSubmitWizardContract = document.getElementById('btnSubmitWizardContract');
  btnResetWizardForm = document.getElementById('btnResetWizardForm');

  prevTotalAmount = document.getElementById('prevTotalAmount');
  prevDebtorName = document.getElementById('prevDebtorName');
  prevInstallment = document.getElementById('prevInstallment');
  prevDueDate = document.getElementById('prevDueDate');
  prevCycle = document.getElementById('prevCycle');
  prevReminderProfile = document.getElementById('prevReminderProfile');
  prevSendPush = document.getElementById('prevSendPush');

  // Debtor Select Change
  if (wizardDebtorSelect) {
    wizardDebtorSelect.addEventListener('change', () => {
      const selectedId = wizardDebtorSelect.value;
      if (!selectedId) return;
      const found = store.debtors.find(d => d.userId === selectedId);
      if (found) {
        if (wizardUserId) wizardUserId.value = found.userId;
        if (wizardDebtorName) wizardDebtorName.value = found.fullName || found.displayName || '';
        if (wizardPhone) wizardPhone.value = found.phone || '';
        if (wizardIdCard) wizardIdCard.value = found.idCardNumber || '';
        updatePreview();
      }
    });
  }

  // Calculator Listeners
  if (wizardTotalAmount) wizardTotalAmount.addEventListener('input', handleCalculatorFromCount);
  if (wizardInstallmentCount) wizardInstallmentCount.addEventListener('input', handleCalculatorFromCount);
  if (wizardInstallmentAmount) wizardInstallmentAmount.addEventListener('input', handleCalculatorFromInstallment);
  if (wizardDebtorName) wizardDebtorName.addEventListener('input', updatePreview);
  if (wizardDueDate) wizardDueDate.addEventListener('change', updatePreview);
  if (wizardCycleDays) wizardCycleDays.addEventListener('change', updatePreview);
  if (wizardReminderProfile) wizardReminderProfile.addEventListener('change', updatePreview);
  if (wizardSendPushCheck) wizardSendPushCheck.addEventListener('change', updatePreview);

  // Form Reset
  if (btnResetWizardForm) {
    btnResetWizardForm.addEventListener('click', () => {
      if (createContractWizardForm) createContractWizardForm.reset();
      wizardCustomTimesList = [];
      syncWizardTimes();
      renderWizardTimeChips();
      initWizardDefaults();
      showToast('ล้างข้อมูลฟอร์มแล้ว', '🔄');
    });
  }

  // Custom Reminder Times for Wizard
  let wizardCustomTimesList = [];

  function normalizeWizardTime(str) {
    if (!str) return null;
    let clean = String(str).trim().replace('.', ':');
    const parts = clean.split(':');
    if (parts.length >= 2) {
      let h = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    return null;
  }

  function syncWizardTimes() {
    const hidden = document.getElementById('wizardCustomTimes');
    if (hidden) hidden.value = wizardCustomTimesList.join(', ');
  }

  function renderWizardTimeChips() {
    const container = document.getElementById('wizardTimesTags');
    if (!container) return;
    if (wizardCustomTimesList.length === 0) {
      container.innerHTML = `<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">(ยังไม่ได้ระบุเวลาเฉพาะสัญญา - จะใช้เวลาตามโปรไฟล์)</span>`;
      return;
    }
    container.innerHTML = wizardCustomTimesList.map(time => `
      <span class="time-chip">
        🕒 ${time}
        <span class="remove-tag" data-time="${time}" title="ลบ">✕</span>
      </span>
    `).join('');
    container.querySelectorAll('.remove-tag').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const t = btn.getAttribute('data-time');
        wizardCustomTimesList = wizardCustomTimesList.filter(x => x !== t);
        syncWizardTimes();
        renderWizardTimeChips();
      };
    });
  }

  function addWizardTime(raw) {
    const norm = normalizeWizardTime(raw);
    if (!norm) {
      showToast('กรุณาระบุเวลาให้ถูกต้อง (เช่น 15:10)', '⚠️');
      return;
    }
    if (wizardCustomTimesList.includes(norm)) {
      showToast(`เวลา ${norm} มีอยู่ในรายการแล้ว`, 'ℹ️');
      return;
    }
    wizardCustomTimesList.push(norm);
    wizardCustomTimesList.sort();
    syncWizardTimes();
    renderWizardTimeChips();
    showToast(`เพิ่มเวลาแจ้งเตือน ${norm}`, '✅');
  }

  const wTimePicker = document.getElementById('wizardTimePicker');
  const btnAddWTime = document.getElementById('btnAddWizardTime');
  if (btnAddWTime && wTimePicker) {
    btnAddWTime.addEventListener('click', () => {
      if (wTimePicker.value) {
        addWizardTime(wTimePicker.value);
        wTimePicker.value = '';
      } else {
        showToast('กรุณาเลือกเวลาก่อนกดเพิ่ม', '⚠️');
      }
    });
    wTimePicker.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnAddWTime.click();
      }
    });
  }

  document.querySelectorAll('#wizardPresetTimeButtons .btn-time-preset[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-time');
      if (t) addWizardTime(t);
    });
  });

  const btnWNext5Min = document.getElementById('btnWizardPresetNext5Min');
  if (btnWNext5Min) {
    btnWNext5Min.addEventListener('click', () => {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 5);
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      addWizardTime(`${h}:${m}`);
    });
  }

  const btnClearWTimes = document.getElementById('btnClearWizardTimes');
  if (btnClearWTimes) {
    btnClearWTimes.addEventListener('click', () => {
      wizardCustomTimesList = [];
      syncWizardTimes();
      renderWizardTimeChips();
      showToast('ล้างเวลาแล้ว', 'ℹ️');
    });
  }

  // Form Submit
  if (createContractWizardForm) {
    createContractWizardForm.addEventListener('submit', handleContractSubmit);
  }
}

export async function mount(targetDebtorId) {
  if (!isInitialized) {
    initDomElements();
    isInitialized = true;
  }

  initWizardDefaults();
  await loadWizardDebtors();

  if (targetDebtorId) {
    prefillDebtor(targetDebtorId);
  }
}

export function initWizardDefaults() {
  const today = new Date();
  today.setDate(today.getDate() + 30);
  const defaultDueDate = today.toISOString().split('T')[0];
  if (wizardDueDate) wizardDueDate.value = defaultDueDate;
  updatePreview();
}

export async function loadWizardDebtors() {
  try {
    const res = await adminFetch('/api/admin/debtors');
    const data = await res.json();
    if (data.success && data.debtors) {
      store.setDebtors(data.debtors);
      if (wizardDebtorSelect) {
        wizardDebtorSelect.innerHTML = '<option value="">-- เลือกลูกหนี้จากรายชื่อ (หรือกรอกเองด้านล่าง) --</option>' +
          store.debtors.map(d => `<option value="${d.userId}">${d.fullName || d.displayName} (${d.phone || d.userId.slice(0, 10)}...)</option>`).join('');
      }
    }
  } catch (err) {
    console.warn('Could not load debtors for wizard:', err.message);
  }
}

export function prefillDebtor(userId) {
  const debtor = store.debtors.find(d => d.userId === userId);
  if (debtor) {
    if (wizardDebtorSelect) wizardDebtorSelect.value = debtor.userId;
    if (wizardUserId) wizardUserId.value = debtor.userId;
    if (wizardDebtorName) wizardDebtorName.value = debtor.fullName || debtor.displayName || '';
    if (wizardPhone) wizardPhone.value = debtor.phone || '';
    if (wizardIdCard) wizardIdCard.value = debtor.idCardNumber || '';
    updatePreview();
    showToast(`เลือกข้อมูลคุณ ${debtor.fullName || debtor.displayName} เรียบร้อยแล้ว`, '👤');
  } else if (userId) {
    if (wizardUserId) wizardUserId.value = userId;
    updatePreview();
  }
}

function handleCalculatorFromCount() {
  const total = Number(wizardTotalAmount?.value) || 0;
  const count = Number(wizardInstallmentCount?.value) || 0;

  if (total > 0 && count > 0 && wizardInstallmentAmount) {
    wizardInstallmentAmount.value = Math.ceil(total / count);
  }
  updatePreview();
}

function handleCalculatorFromInstallment() {
  const total = Number(wizardTotalAmount?.value) || 0;
  const installment = Number(wizardInstallmentAmount?.value) || 0;

  if (total > 0 && installment > 0 && wizardInstallmentCount) {
    wizardInstallmentCount.value = Math.ceil(total / installment);
  }
  updatePreview();
}

function updatePreview() {
  const total = Number(wizardTotalAmount?.value) || 0;
  const installment = Number(wizardInstallmentAmount?.value) || 0;
  const debtorName = wizardDebtorName?.value || '-';
  const dueDate = wizardDueDate?.value || '-';
  const cycleDays = wizardCycleDays?.value || '30';
  const sendPush = wizardSendPushCheck?.checked;

  if (prevTotalAmount) prevTotalAmount.textContent = formatMoney(total);
  if (prevDebtorName) prevDebtorName.textContent = debtorName;
  if (prevInstallment) prevInstallment.textContent = formatMoney(installment);
  if (prevDueDate) prevDueDate.textContent = dueDate;
  if (prevCycle) prevCycle.textContent = `ทุกๆ ${cycleDays} วัน`;
  if (prevSendPush) {
    prevSendPush.textContent = sendPush ? 'ส่งทันที' : 'ไม่ส่ง';
    prevSendPush.style.color = sendPush ? 'var(--primary)' : 'var(--text-muted)';
  }

  if (prevReminderProfile && wizardReminderProfile) {
    const profText = wizardReminderProfile.options[wizardReminderProfile.selectedIndex]?.text || 'รูปแบบเริ่มต้น';
    prevReminderProfile.textContent = profText;
  }
}

async function handleContractSubmit(e) {
  e.preventDefault();
  if (isSubmitting) return;

  const payload = {
    userId: wizardUserId?.value?.trim(),
    debtorName: wizardDebtorName?.value?.trim(),
    phone: wizardPhone?.value?.trim(),
    idCardNumber: wizardIdCard?.value?.trim(),
    totalAmount: Number(wizardTotalAmount?.value) || 0,
    installmentAmount: Number(wizardInstallmentAmount?.value) || 0,
    cycleDays: Number(wizardCycleDays?.value) || 30,
    dueDate: wizardDueDate?.value,
    reminderProfileId: wizardReminderProfile?.value || '',
    reminderEnabled: wizardReminderEnabled?.checked !== false,
    customReminderTimes: document.getElementById('wizardCustomTimes')?.value?.trim() || '',
    sendPush: Boolean(wizardSendPushCheck?.checked)
  };

  if (!payload.userId || !payload.totalAmount || !payload.installmentAmount || !payload.dueDate) {
    showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', '⚠️');
    return;
  }

  isSubmitting = true;
  if (btnSubmitWizardContract) {
    btnSubmitWizardContract.disabled = true;
    btnSubmitWizardContract.textContent = '⏳ กำลังบันทึกสัญญาและส่งแจ้งเตือน...';
  }

  try {
    const res = await adminFetch('/api/admin/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (json.success) {
      showToast(json.message || 'สร้างสัญญาใหม่สำเร็จ!', '✅');
      if (createContractWizardForm) createContractWizardForm.reset();
      initWizardDefaults();
      eventBus.emit('contracts:needsRefresh');
      eventBus.emit('stats:needsRefresh');

      // นำทางไปหน้ารายการสัญญาของลูกหนี้รายนี้โดยตรง
      setTimeout(() => {
        router.navigate('#/contracts', { debtorId: payload.userId });
      }, 700);
    } else {
      showToast(json.message || 'สร้างสัญญาไม่สำเร็จ', '❌');
    }
  } catch (err) {
    console.error('Error creating contract:', err);
    showToast('เกิดข้อผิดพลาดในการสร้างสัญญา: ' + err.message, '❌');
  } finally {
    isSubmitting = false;
    if (btnSubmitWizardContract) {
      btnSubmitWizardContract.disabled = false;
      btnSubmitWizardContract.textContent = '💾 บันทึกและเปิดสัญญาเงินกู้ใหม่';
    }
  }
}

// Global hook for inline HTML onclick handlers
window.openContractForDebtor = function(userId, name, phone, idCard) {
  router.navigate('#/contracts/new', { debtorId: userId });
  if (wizardUserId) wizardUserId.value = userId || '';
  if (wizardDebtorName) wizardDebtorName.value = name || '';
  if (wizardPhone) wizardPhone.value = phone || '';
  if (wizardIdCard) wizardIdCard.value = idCard || '';
  updatePreview();
};
