/**
 * Assign Reminder Profile Modal Module
 * Allows fine-grained override of reminder profiles at either Contract-Level or Debtor-Level.
 */

import { adminFetch, showToast } from '../core/api.js';
import { store, eventBus } from '../core/state.js';

let isInitialized = false;

export function initAssignReminderModal() {
  if (isInitialized) return;

  const formAssignReminder = document.getElementById('formAssignReminder');
  if (formAssignReminder) {
    formAssignReminder.addEventListener('submit', async (e) => {
      e.preventDefault();
      const targetType = document.getElementById('assignTargetType')?.value;
      const targetId = document.getElementById('assignTargetId')?.value;
      const reminderProfileId = document.getElementById('assignProfileSelect')?.value || '';
      const reminderEnabled = Boolean(document.getElementById('assignEnabledCheck')?.checked);

      showToast('กำลังบันทึกการตั้งค่า...', '⏳');

      try {
        const url = targetType === 'debtor'
          ? `/api/admin/debtors/${targetId}/reminder`
          : `/api/admin/contracts/${targetId}/reminder`;

        const res = await adminFetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reminderProfileId, reminderEnabled })
        });
        const data = await res.json();
        if (data.success) {
          showToast('บันทึกการตั้งค่าแจ้งเตือนเรียบร้อยแล้ว!', '✅');
          window.closeAssignReminderModal();
          if (targetType === 'debtor') {
            eventBus.emit('debtors:needsRefresh');
          } else {
            eventBus.emit('contracts:needsRefresh');
          }
        } else {
          showToast(data.message || 'บันทึกไม่สำเร็จ', '❌');
        }
      } catch (err) {
        showToast('เกิดข้อผิดพลาด: ' + err.message, '❌');
      }
    });
  }

  isInitialized = true;
}

window.openAssignReminderModal = function(targetType, targetId, currentProfileId, isEnabled, displayName) {
  initAssignReminderModal();

  const elType = document.getElementById('assignTargetType');
  const elId = document.getElementById('assignTargetId');
  const elName = document.getElementById('assignTargetName');
  const elTitle = document.getElementById('modalAssignTitle');
  const elSelect = document.getElementById('assignProfileSelect');
  const elCheck = document.getElementById('assignEnabledCheck');
  const modal = document.getElementById('modalAssignReminder');

  if (elType) elType.value = targetType;
  if (elId) elId.value = targetId;
  if (elName) elName.textContent = `${targetType === 'debtor' ? '👤 ลูกหนี้:' : '📑 สัญญา:'} ${displayName}`;
  if (elTitle) elTitle.textContent = `🔔 ตั้งค่าแจ้งเตือน (${targetType === 'debtor' ? 'ระดับลูกหนี้' : 'ระดับสัญญา'})`;

  if (elSelect) {
    elSelect.innerHTML = '<option value="">⚙️ รูปแบบเริ่มต้น (Default Profile)</option>' +
      (store.reminderProfiles || []).map(p => `<option value="${p.profileId}">${p.name}${p.isDefault ? ' [เริ่มต้น]' : ''} (${p.frequencyType})</option>`).join('');
    elSelect.value = currentProfileId || '';
  }

  if (elCheck) elCheck.checked = isEnabled !== false;
  if (modal) modal.classList.add('open');
};

window.closeAssignReminderModal = function() {
  const modal = document.getElementById('modalAssignReminder');
  if (modal) modal.classList.remove('open');
};
