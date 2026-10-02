/**
 * Audit Trail & Activity Logs Module
 * Displays chronological system logs of administrative actions for compliance and security traceability.
 */

import { adminFetch, showToast } from '../core/api.js';

let auditLogsTableBody = null;
let auditLimitSelect = null;
let isInitialized = false;

function initDomElements() {
  auditLogsTableBody = document.getElementById('auditLogsTableBody');
  auditLimitSelect = document.getElementById('auditLimitSelect');

  const btnRefreshAudit = document.getElementById('btnRefreshAudit');
  if (btnRefreshAudit) {
    btnRefreshAudit.addEventListener('click', loadAuditLogs);
  }

  if (auditLimitSelect) {
    auditLimitSelect.addEventListener('change', loadAuditLogs);
  }
}

export async function mount() {
  if (!isInitialized) {
    initDomElements();
    isInitialized = true;
  }

  await loadAuditLogs();
}

export async function loadAuditLogs() {
  if (!auditLogsTableBody) return;
  auditLogsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">กำลังโหลดบันทึกกิจกรรม...</td></tr>';

  const limit = auditLimitSelect ? auditLimitSelect.value : '50';

  try {
    const res = await adminFetch(`/api/admin/audit?limit=${limit}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.logs)) {
      renderAuditLogs(data.logs);
    }
  } catch (err) {
    console.warn('Could not load audit logs:', err.message);
    auditLogsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #EF4444; padding: 20px;">เกิดข้อผิดพลาดในการโหลดบันทึกระบบ</td></tr>';
  }
}

function renderAuditLogs(logs) {
  if (!auditLogsTableBody) return;

  if (logs.length === 0) {
    auditLogsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">ยังไม่มีประวัติการบันทึกกิจกรรมในระบบ</td></tr>';
    return;
  }

  const actionLabels = {
    'CREATE_CONTRACT': '➕ สร้างสัญญา',
    'DELETE_CONTRACT': '🗑️ ลบสัญญา',
    'APPROVE_SLIP': '✅ อนุมัติสลิป',
    'REJECT_SLIP': '❌ ปฏิเสธสลิป',
    'SYNC_DRIVE_SLIPS': '📁 ซิงค์ Drive',
    'TRIGGER_CRON_MANUAL': '🚀 สั่งยิงแจ้งเตือน',
    'SAVE_REMINDER_SETTINGS': '⚙️ แก้ไขการตั้งค่าเตือน',
    'SAVE_ADMIN': '🛡️ ปรับสิทธิ์แอดมิน',
    'DELETE_ADMIN': '🚫 ลบสิทธิ์แอดมิน'
  };

  auditLogsTableBody.innerHTML = logs.map(log => `
    <tr>
      <td style="font-size: 11.5px; color: var(--text-muted); font-family: monospace;">${log.timestamp || '-'}</td>
      <td>
        <div style="font-weight: 600; color: var(--text-main); font-size: 13px;">${log.operatorName || 'แอดมิน'}</div>
        <small style="font-size: 10.5px; color: var(--text-muted); font-family: monospace;">${log.operatorUserId || '-'}</small>
      </td>
      <td><span class="badge-status active" style="font-size: 10.5px;">${actionLabels[log.action] || log.action}</span></td>
      <td><span style="font-family: monospace; font-size: 11.5px; color: var(--primary);">${log.targetId || '-'}</span></td>
      <td style="font-size: 12px; color: var(--text-body); max-width: 300px; word-break: break-word;">${log.details || '-'}</td>
      <td style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${log.ipAddress || '-'}</td>
    </tr>
  `).join('');
}
