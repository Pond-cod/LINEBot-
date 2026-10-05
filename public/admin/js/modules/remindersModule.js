/**
 * Automated Reminder Engine Module (Settings, Logs, and Profiles)
 * Handles reminder scheduler settings, legal hours guard, monthly day chips, template customization, test push, and logs.
 */

import { adminFetch, showToast } from '../core/api.js';
import { store, eventBus } from '../core/state.js';

let selectedMonthlyDays = [];
let isInitialized = false;

function initDomElements() {
  const btnSaveReminderSettings = document.getElementById('btnSaveReminderSettings');
  const btnSaveReminderSettingsTop = document.getElementById('btnSaveReminderSettingsTop');
  const btnTestPushToAdmin = document.getElementById('btnTestPushToAdmin');
  const btnRefreshLogs = document.getElementById('btnRefreshLogs');
  const btnTestTriggerReminderNow = document.getElementById('btnTestTriggerReminderNow');

  if (btnSaveReminderSettings) btnSaveReminderSettings.addEventListener('click', saveReminderSettings);
  if (btnSaveReminderSettingsTop) btnSaveReminderSettingsTop.addEventListener('click', saveReminderSettings);
  if (btnTestPushToAdmin) btnTestPushToAdmin.addEventListener('click', sendTestPush);
  if (btnRefreshLogs) btnRefreshLogs.addEventListener('click', loadReminderLogs);

  if (btnTestTriggerReminderNow) {
    btnTestTriggerReminderNow.addEventListener('click', async () => {
      if (!confirm('ต้องการสแกนและส่งข้อความแจ้งเตือนทันที (Bypass เวลาส่ง) ใช่หรือไม่?')) return;
      showToast('กำลังตรวจสอบและส่งแจ้งเตือน...', '⏳');
      try {
        const res = await adminFetch('/api/reminder/trigger-now', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceRun: true, triggerType: 'ทดสอบส่งทันที (Admin Manual Trigger)' })
        });
        const data = await res.json();
        if (data.success && data.summary) {
          const s = data.summary;
          showToast(`ส่งสำเร็จ ${s.sent} สัญญา, ข้าม ${s.skipped}, ผิดพลาด ${s.failed}`, '✅');
          loadReminderLogs();
        } else {
          showToast(data.message || 'ส่งไม่สำเร็จ', '⚠️');
        }
      } catch (e) {
        showToast('เกิดข้อผิดพลาด: ' + e.message, '❌');
      }
    });
  }

  const cfgScheduleMode = document.getElementById('cfgScheduleMode');
  if (cfgScheduleMode) {
    cfgScheduleMode.addEventListener('change', () => {
      const isMonthlyOrCombined = cfgScheduleMode.value === 'MONTHLY' || cfgScheduleMode.value === 'COMBINED';
      const box = document.getElementById('monthlyScheduleBox');
      if (box) box.style.display = isMonthlyOrCombined ? 'block' : 'none';
    });
  }

  const cfgSecondaryEnabled = document.getElementById('cfgSecondaryEnabled');
  if (cfgSecondaryEnabled) {
    cfgSecondaryEnabled.addEventListener('change', () => {
      const box = document.getElementById('cfgSecondaryTimeGroup');
      if (box) box.style.display = cfgSecondaryEnabled.checked ? 'block' : 'none';
    });
  }

  eventBus.on('reminderLogs:needsRefresh', () => loadReminderLogs());
}

export async function mount() {
  if (!isInitialized) {
    initDomElements();
    initMonthlyDaysChips();
    initProfileModalListeners();
    isInitialized = true;
  }

  await Promise.all([
    loadReminderSettings(),
    loadReminderLogs(),
    loadReminderProfiles()
  ]);
}

export function initMonthlyDaysChips() {
  const monthlyDaysGrid = document.getElementById('monthlyDaysGrid');
  if (!monthlyDaysGrid) return;
  monthlyDaysGrid.innerHTML = '';

  for (let i = 1; i <= 31; i++) {
    const chip = document.createElement('div');
    chip.className = 'day-chip' + (selectedMonthlyDays.includes(i) ? ' selected' : '');
    chip.textContent = i;
    chip.addEventListener('click', () => {
      if (selectedMonthlyDays.includes(i)) {
        selectedMonthlyDays = selectedMonthlyDays.filter(d => d !== i);
        chip.classList.remove('selected');
      } else {
        selectedMonthlyDays.push(i);
        selectedMonthlyDays.sort((a, b) => a - b);
        chip.classList.add('selected');
      }
    });
    monthlyDaysGrid.appendChild(chip);
  }
}

export async function loadReminderSettings() {
  try {
    const res = await adminFetch('/api/admin/reminder/settings');
    const data = await res.json();

    if (data.success && data.settings) {
      store.setReminderSettings(data.settings);
      applySettingsToForm(data.settings);
    }
  } catch (err) {
    console.warn('Error loading reminder settings:', err.message);
  }
}

function applySettingsToForm(s) {
  const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = Boolean(val); };
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };

  setCheck('cfgEnabled', s.enabled);
  setVal('cfgScheduleMode', s.scheduleMode || 'COMBINED');

  const monthlyBox = document.getElementById('monthlyScheduleBox');
  if (monthlyBox) {
    monthlyBox.style.display = (s.scheduleMode === 'MONTHLY' || s.scheduleMode === 'COMBINED') ? 'block' : 'none';
  }

  setCheck('cfgMonthlyEnabled', s.monthlySchedule?.enabled);
  setCheck('cfgMonthlyLastDay', s.monthlySchedule?.lastDayOfMonth);

  selectedMonthlyDays = Array.isArray(s.monthlySchedule?.daysOfMonth) ? [...s.monthlySchedule.daysOfMonth] : [1, 25];
  initMonthlyDaysChips();

  setVal('cfgPrimaryTime', s.primaryTime || '08:00');
  setCheck('cfgSecondaryEnabled', s.secondaryTimeEnabled);
  setVal('cfgSecondaryTime', s.secondaryTime || '18:00');

  const secGroup = document.getElementById('cfgSecondaryTimeGroup');
  if (secGroup) secGroup.style.display = s.secondaryTimeEnabled ? 'block' : 'none';

  setCheck('cfgRemindBeforeEnabled', s.rules?.remindBeforeEnabled);
  setVal('cfgRemindBeforeDays', s.rules?.remindBeforeDays || 1);
  setCheck('cfgRemindDueTodayEnabled', s.rules?.remindDueTodayEnabled);
  setCheck('cfgRemindOverdueEnabled', s.rules?.remindOverdueEnabled);
  setVal('cfgOverdueFrequency', s.rules?.overdueFrequency || 'DAILY');

  setVal('cfgTone', s.template?.tone || 'POLITE');
  setVal('cfgBankName', s.template?.bankName || '');
  setVal('cfgAccountNumber', s.template?.accountNumber || '');
  setVal('cfgAccountName', s.template?.accountName || '');
  setVal('cfgPromptPay', s.template?.promptPayNumber || '');
  setVal('cfgCustomHeader', s.template?.customHeader || '');
  setVal('cfgCustomFooter', s.template?.customFooter || '');
  setCheck('cfgNotifyAdmin', s.notifyAdminOnRun);
}

export async function saveReminderSettings() {
  const getCheck = (id) => document.getElementById(id)?.checked || false;
  const getVal = (id) => document.getElementById(id)?.value || '';

  const payload = {
    enabled: getCheck('cfgEnabled'),
    scheduleMode: getVal('cfgScheduleMode'),
    primaryTime: getVal('cfgPrimaryTime') || '08:00',
    secondaryTimeEnabled: getCheck('cfgSecondaryEnabled'),
    secondaryTime: getVal('cfgSecondaryTime') || '18:00',
    monthlySchedule: {
      enabled: getCheck('cfgMonthlyEnabled'),
      daysOfMonth: selectedMonthlyDays,
      lastDayOfMonth: getCheck('cfgMonthlyLastDay')
    },
    rules: {
      remindBeforeEnabled: getCheck('cfgRemindBeforeEnabled'),
      remindBeforeDays: parseInt(getVal('cfgRemindBeforeDays'), 10) || 1,
      remindDueTodayEnabled: getCheck('cfgRemindDueTodayEnabled'),
      remindOverdueEnabled: getCheck('cfgRemindOverdueEnabled'),
      overdueFrequency: getVal('cfgOverdueFrequency') || 'DAILY'
    },
    template: {
      tone: getVal('cfgTone') || 'POLITE',
      bankName: getVal('cfgBankName'),
      accountNumber: getVal('cfgAccountNumber'),
      accountName: getVal('cfgAccountName'),
      promptPayNumber: getVal('cfgPromptPay'),
      customHeader: getVal('cfgCustomHeader'),
      customFooter: getVal('cfgCustomFooter')
    },
    notifyAdminOnRun: getCheck('cfgNotifyAdmin')
  };

  showToast('กำลังบันทึกการตั้งค่า...', '⏳');

  try {
    const res = await adminFetch('/api/admin/reminder/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('บันทึกการตั้งค่าเรียบร้อยแล้ว!', '✅');
      store.setReminderSettings(data.settings);
    } else {
      showToast(data.message || 'บันทึกไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
}

export async function sendTestPush() {
  const targetUserId = prompt('ระบุ LINE User ID ที่ต้องการรับข้อความตัวอย่าง (ขึ้นต้นด้วย U...):');
  if (!targetUserId || !targetUserId.startsWith('U')) {
    alert('LINE User ID ไม่ถูกต้อง ต้องขึ้นต้นด้วยตัว U');
    return;
  }

  showToast('กำลังส่งข้อความตัวอย่าง...', '⏳');

  try {
    const res = await adminFetch('/api/admin/reminder/test-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('ส่งข้อความทดสอบสำเร็จแล้ว!', '✅');
    } else {
      showToast(data.message || 'ส่งไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
}

export async function loadReminderLogs() {
  const container = document.getElementById('reminderLogsContainer');
  if (!container) return;

  try {
    const res = await adminFetch('/api/admin/reminder/logs?limit=15');
    const data = await res.json();

    if (data.success && Array.isArray(data.logs)) {
      if (data.logs.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">ยังไม่มีประวัติการแจ้งเตือน</div>';
        return;
      }

      container.innerHTML = data.logs.map(log => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface-raised); border-radius: var(--radius-sm); margin-bottom: 8px; border: 1px solid var(--surface-border);">
          <div>
            <div style="font-weight: 600; font-size: 13px; color: var(--text-main);">${log.reminderType || 'แจ้งเตือน'}</div>
            <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">หนี้: ${log.debtId || '-'} | ผู้ใช้: ${log.userId}</div>
          </div>
          <div style="text-align: right;">
            <span class="badge-status ${log.status === 'SENT' ? 'active' : 'overdue'}" style="font-size: 10px;">${log.status || 'SENT'}</span>
            <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">${log.sentAt || '-'}</div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.warn('Could not load reminder logs:', err.message);
  }
}

export async function loadReminderProfiles() {
  try {
    const res = await adminFetch('/api/admin/reminder/profiles');
    const data = await res.json();
    if (data.success && Array.isArray(data.profiles)) {
      store.setReminderProfiles(data.profiles);
      renderReminderProfilesGrid();
      updateProfileDropdowns();
    }
  } catch (err) {
    console.warn('Error loading reminder profiles:', err.message);
  }
}

export function updateProfileDropdowns() {
  const wizardProf = document.getElementById('wizardReminderProfile');
  const assignProf = document.getElementById('assignProfileSelect');

  const optionsHtml = '<option value="">⚙️ รูปแบบเริ่มต้น (Default Profile)</option>' +
    store.reminderProfiles.map(p => `<option value="${p.profileId}">${p.name}${p.isDefault ? ' [เริ่มต้น]' : ''} (${p.frequencyType})</option>`).join('');

  if (wizardProf) {
    const cur = wizardProf.value;
    wizardProf.innerHTML = optionsHtml;
    if (cur) wizardProf.value = cur;
  }
  if (assignProf) assignProf.innerHTML = optionsHtml;
}

export function renderReminderProfilesGrid() {
  const grid = document.getElementById('reminderProfilesGrid');
  const countBadge = document.getElementById('badgeProfileCount');
  if (countBadge) countBadge.textContent = `${store.reminderProfiles.length} รูปแบบ`;
  if (!grid) return;

  if (store.reminderProfiles.length === 0) {
    grid.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px; grid-column: 1 / -1;">ไม่พบรูปแบบการแจ้งเตือน</div>';
    return;
  }

  const freqLabels = {
    'DAILY': 'เตือนรายวัน',
    'END_OF_MONTH': 'วันสิ้นเดือน',
    'SPECIFIC_DAYS': 'ระบุวันที่ในเดือน',
    'DUE_DATE_RELATIVE': 'อิงวันครบกำหนด'
  };

  grid.innerHTML = store.reminderProfiles.map(p => {
    const isActive = p.status === 'ACTIVE';
    const isDefault = Boolean(p.isDefault);
    const freqName = freqLabels[p.frequencyType] || p.frequencyType;

    const timeSlots = p.scheduleConfig?.timeSlots?.length > 0
      ? p.scheduleConfig.timeSlots
      : [p.primaryTime, p.secondaryTime].filter(Boolean);
    const timeStr = timeSlots.length > 0 ? timeSlots.join(', ') : (p.primaryTime || '08:00');

    const dowMap = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    const dows = p.scheduleConfig?.daysOfWeek;
    const dowStr = Array.isArray(dows) && dows.length < 7
      ? dows.map(d => dowMap[d] || d).join(', ')
      : 'ทุกวัน';

    const preDueSteps = p.rulesConfig?.remindPreDueSteps?.length > 0
      ? p.rulesConfig.remindPreDueSteps.join(', ')
      : (p.rulesConfig?.remindBeforeDays || 1);

    return `
      <div class="panel-card" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between; border-top: 3px solid ${isDefault ? 'var(--primary)' : 'var(--surface-border)'};">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h4 style="margin: 0; font-size: 14.5px; font-weight: 700; color: var(--text-main);">
              ${p.name}
            </h4>
            <div style="display: flex; gap: 4px;">
              ${isDefault ? '<span class="badge-status active" style="font-size: 10px;">ค่าเริ่มต้น</span>' : ''}
              <span class="badge-status ${isActive ? 'active' : 'overdue'}" style="font-size: 10px;">${p.status}</span>
            </div>
          </div>
          <div style="font-size: 11px; color: var(--primary); font-weight: 600; margin-bottom: 6px;">
            📅 ความถี่: ${freqName}
          </div>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.6;">
            🕒 รอบเวลาส่ง: <strong style="color: var(--text-main);">${timeStr}</strong> <span style="font-size: 10px; color: var(--text-muted);">(เวลาไทย)</span><br>
            📆 วันที่ส่ง: <strong>${dowStr}</strong><br>
            ${p.rulesConfig?.remindBeforeEnabled ? `⚡ เตือนล่วงหน้า: <strong>${preDueSteps} วัน</strong><br>` : ''}
            💬 โทนภาษา: <strong>${p.templateConfig?.tone || 'POLITE'}</strong>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--surface-border); padding-top: 10px; margin-top: 6px;">
          <label class="switch-toggle" style="transform: scale(0.8);" title="เปิด/ปิดการใช้งานโปรไฟล์นี้">
            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleReminderProfile('${p.profileId}')">
            <span class="slider-toggle"></span>
          </label>
          <div style="display: flex; gap: 6px;">
            <button class="topbar-btn" style="padding: 4px 10px; font-size: 11px;" onclick="openEditProfileModal('${p.profileId}')">
              ✏️ แก้ไข
            </button>
            ${!isDefault ? `
              <button class="btn-action-icon delete" style="width: 28px; height: 28px; font-size: 11px;" onclick="deleteReminderProfile('${p.profileId}')" title="ลบรูปแบบนี้">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function initProfileModalListeners() {
  const btnOpenCreateProfileModal = document.getElementById('btnOpenCreateProfileModal');
  const modalProfile = document.getElementById('modalReminderProfile');
  const btnCloseProfileModal = document.getElementById('btnCloseProfileModal');
  const formProfile = document.getElementById('formReminderProfile');

  if (btnOpenCreateProfileModal && modalProfile) {
    btnOpenCreateProfileModal.addEventListener('click', () => {
      if (formProfile) formProfile.reset();
      const elTitle = document.getElementById('modalProfileTitle');
      const elMode = document.getElementById('profileFormMode');
      const elId = document.getElementById('profileInputId');
      if (elTitle) elTitle.textContent = 'สร้างรูปแบบการแจ้งเตือนใหม่';
      if (elMode) elMode.value = 'CREATE';
      if (elId) elId.value = '';

      const timeInput = document.getElementById('profTimeSlots');
      if (timeInput) timeInput.value = '08:00';
      const stepsInput = document.getElementById('profPreDueSteps');
      if (stepsInput) stepsInput.value = '3, 1';
      document.querySelectorAll('input[name="profDow"]').forEach(cb => { cb.checked = true; });

      modalProfile.classList.add('open');
      modalProfile.classList.remove('hidden');
    });
  }

  if (btnCloseProfileModal && modalProfile) {
    btnCloseProfileModal.addEventListener('click', () => {
      window.closeProfileModal();
    });
  }

  if (formProfile) {
    formProfile.addEventListener('submit', handleProfileSubmit);
  }
}

async function handleProfileSubmit(e) {
  e.preventDefault();
  const mode = document.getElementById('profileFormMode')?.value || 'CREATE';
  const profileId = document.getElementById('profileInputId')?.value;

  const rawSlots = document.getElementById('profTimeSlots')?.value || '08:00';
  const timeSlots = rawSlots.split(',').map(s => s.trim()).filter(Boolean);

  const checkedDows = Array.from(document.querySelectorAll('input[name="profDow"]:checked')).map(cb => Number(cb.value));

  const rawSteps = document.getElementById('profPreDueSteps')?.value || '1';
  const remindPreDueSteps = rawSteps.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);

  const payload = {
    profileId,
    name: document.getElementById('profName')?.value?.trim(),
    frequencyType: document.getElementById('profFrequencyType')?.value,
    primaryTime: timeSlots[0] || '08:00',
    secondaryTime: timeSlots[1] || '',
    scheduleConfig: {
      timeSlots: timeSlots.length > 0 ? timeSlots : ['08:00'],
      daysOfWeek: checkedDows.length > 0 ? checkedDows : [1, 2, 3, 4, 5, 6, 0]
    },
    isDefault: document.getElementById('profIsDefault')?.checked || false,
    rulesConfig: {
      remindDueTodayEnabled: document.getElementById('profRuleDueToday')?.checked || false,
      remindOverdueEnabled: document.getElementById('profRuleOverdue')?.checked || false,
      overdueFrequency: document.getElementById('profOverdueFrequency')?.value || 'DAILY',
      remindBeforeEnabled: document.getElementById('profRuleBefore')?.checked || false,
      remindBeforeDays: remindPreDueSteps[0] || 1,
      remindPreDueSteps: remindPreDueSteps.length > 0 ? remindPreDueSteps : [1]
    },
    templateConfig: {
      tone: document.getElementById('profTone')?.value || 'POLITE',
      customHeader: document.getElementById('profHeader')?.value?.trim() || '',
      customFooter: document.getElementById('profFooter')?.value?.trim() || ''
    }
  };

  if (!payload.name) {
    showToast('กรุณาระบุชื่อรูปแบบการแจ้งเตือน', '⚠️');
    return;
  }

  showToast('กำลังบันทึกรูปแบบการแจ้งเตือน...', '⏳');

  try {
    const url = mode === 'CREATE' ? '/api/admin/reminder/profiles' : `/api/admin/reminder/profiles/${profileId}`;
    const method = mode === 'CREATE' ? 'POST' : 'PUT';

    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast('บันทึกรูปแบบการแจ้งเตือนสำเร็จ!', '✅');
      window.closeProfileModal();
      loadReminderProfiles();
    } else {
      showToast(data.message || 'บันทึกไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
}

// Global hooks for inline HTML handlers
window.closeProfileModal = function() {
  const modalProfile = document.getElementById('modalReminderProfile');
  if (modalProfile) {
    modalProfile.classList.remove('open');
    modalProfile.classList.add('hidden');
  }
};

window.addProfileTimeSlot = function(slotTime) {
  const input = document.getElementById('profTimeSlots');
  if (!input) return;
  const current = input.value.split(',').map(s => s.trim()).filter(Boolean);
  if (!current.includes(slotTime)) {
    current.push(slotTime);
    input.value = current.join(', ');
  }
};

window.openEditProfileModal = function(profileId) {
  const p = (store.reminderProfiles || []).find(item => item.profileId === profileId);
  if (!p) {
    showToast('ไม่พบข้อมูลโปรไฟล์ ' + profileId, '⚠️');
    return;
  }

  const modalProfile = document.getElementById('modalReminderProfile');
  const elTitle = document.getElementById('modalProfileTitle');
  const elMode = document.getElementById('profileFormMode');
  const elId = document.getElementById('profileInputId');

  if (elTitle) elTitle.textContent = `แก้ไขรูปแบบการแจ้งเตือน (${p.profileId})`;
  if (elMode) elMode.value = 'EDIT';
  if (elId) elId.value = p.profileId;

  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
  const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = Boolean(val); };

  setVal('profName', p.name);
  setVal('profFrequencyType', p.frequencyType || 'DAILY');

  const timeSlots = p.scheduleConfig?.timeSlots?.length > 0
    ? p.scheduleConfig.timeSlots
    : [p.primaryTime, p.secondaryTime].filter(Boolean);
  setVal('profTimeSlots', timeSlots.length > 0 ? timeSlots.join(', ') : '08:00');

  const dows = p.scheduleConfig?.daysOfWeek || [1, 2, 3, 4, 5, 6, 0];
  document.querySelectorAll('input[name="profDow"]').forEach(cb => {
    cb.checked = dows.includes(Number(cb.value));
  });

  setCheck('profRuleDueToday', p.rulesConfig?.remindDueTodayEnabled !== false);
  setCheck('profRuleBefore', p.rulesConfig?.remindBeforeEnabled !== false);
  const steps = p.rulesConfig?.remindPreDueSteps?.length > 0
    ? p.rulesConfig.remindPreDueSteps.join(', ')
    : String(p.rulesConfig?.remindBeforeDays || 1);
  setVal('profPreDueSteps', steps);

  setCheck('profRuleOverdue', p.rulesConfig?.remindOverdueEnabled !== false);
  setVal('profOverdueFrequency', p.rulesConfig?.overdueFrequency || 'DAILY');

  setVal('profTone', p.templateConfig?.tone || 'POLITE');
  setVal('profHeader', p.templateConfig?.customHeader || '');
  setVal('profFooter', p.templateConfig?.customFooter || '');
  setCheck('profIsDefault', p.isDefault);

  if (modalProfile) {
    modalProfile.classList.add('open');
    modalProfile.classList.remove('hidden');
  }
};

window.toggleReminderProfile = async function(profileId) {
  try {
    const res = await adminFetch(`/api/admin/reminder/profiles/${profileId}/toggle`, { method: 'PATCH' });
    const data = await res.json();
    if (data.success) {
      showToast('ปรับสถานะโปรไฟล์สำเร็จ', '✅');
      loadReminderProfiles();
    } else {
      showToast(data.message || 'ปรับสถานะไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
};

window.deleteReminderProfile = async function(profileId) {
  if (!confirm(`ต้องการลบรูปแบบการแจ้งเตือน ${profileId} ใช่หรือไม่?`)) return;

  try {
    const res = await adminFetch(`/api/admin/reminder/profiles/${profileId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('ลบรูปแบบสำเร็จ', '✅');
      loadReminderProfiles();
    } else {
      showToast(data.message || 'ลบไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
  }
};
