// Admin Portal JavaScript Controller

// Elements
const navItems = document.querySelectorAll('.nav-item');
const subViews = document.querySelectorAll('.sub-view');

// Stats Elements
const statRemaining = document.getElementById('statRemaining');
const statPendingSlips = document.getElementById('statPendingSlips');
const statDueToday = document.getElementById('statDueToday');
const statTotalContracts = document.getElementById('statTotalContracts');
const btnTriggerCronNow = document.getElementById('btnTriggerCronNow');

// Contracts Elements
const createContractForm = document.getElementById('createContractForm');
const contractsListContainer = document.getElementById('contractsListContainer');
const contractsCount = document.getElementById('contractsCount');

// Slips Elements
const slipsContainer = document.getElementById('slipsContainer');
const pendingSlipsBadge = document.getElementById('pendingSlipsBadge');

// Reminders Elements
const manualDebtIdInput = document.getElementById('manualDebtIdInput');
const btnManualPushSingle = document.getElementById('btnManualPushSingle');

// Toast
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

/**
 * 1. ควบคุมการสลับ Sub-views
 */
function switchView(targetViewId) {
  subViews.forEach(view => {
    if (view.id === targetViewId) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  navItems.forEach(item => {
    if (item.getAttribute('data-target') === targetViewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  document.querySelector('.views-viewport').scrollTop = 0;

  // โหลดข้อมูลตามหน้า
  if (targetViewId === 'view-admin-overview') loadStats();
  if (targetViewId === 'view-admin-contracts') loadContracts();
  if (targetViewId === 'view-admin-slips') loadSlips();
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const target = item.getAttribute('data-target');
    switchView(target);
  });
});

function showToast(msg, icon = 'ℹ️') {
  toastMessage.textContent = msg;
  toastIcon.textContent = icon;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

/**
 * 2. โหลดสถิติภาพรวม (Overview)
 */
async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const json = await res.json();

    if (json.success && json.stats) {
      const s = json.stats;
      statRemaining.textContent = `฿${Number(s.totalRemaining).toLocaleString()}`;
      statPendingSlips.textContent = `${s.pendingSlipsCount} ใบ`;
      statDueToday.textContent = `${s.dueTodayCount} ราย`;
      statTotalContracts.textContent = `${s.totalContracts}`;
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

/**
 * 3. โหลดและแสดงรายการสัญญา (Contracts)
 */
async function loadContracts() {
  try {
    contractsListContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">กำลังโหลด...</div>';
    const res = await fetch('/api/admin/contracts');
    const json = await res.json();

    if (json.success && json.contracts) {
      const contracts = json.contracts;
      contractsCount.textContent = `${contracts.length} รายการ`;

      if (contracts.length === 0) {
        contractsListContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">ยังไม่มีสัญญาในระบบ</div>';
        return;
      }

      contractsListContainer.innerHTML = contracts.map(c => {
        let statusClass = 'active';
        if (c.debtStatus === 'OVERDUE') statusClass = 'overdue';
        if (c.debtStatus === 'PAID') statusClass = 'paid';

        return `
          <div class="contract-card">
            <div class="contract-top">
              <span class="contract-id">${c.debtId}</span>
              <span class="contract-status ${statusClass}">${c.debtStatus}</span>
            </div>
            <div class="contract-body">
              <div>ผู้กู้: <strong>${c.debtorName}</strong> (${c.debtorPhone || '-'})</div>
              <div>ยอดคงเหลือ: <strong style="color: var(--primary);">฿${Number(c.remainingBalance).toLocaleString()}</strong> / ยอดรวม ฿${Number(c.totalAmount).toLocaleString()}</div>
              <div>ค่างวด: ฿${Number(c.installmentAmount).toLocaleString()} | กำหนดชำระ: <strong style="color: #EF4444;">${c.dueDate || '-'}</strong></div>
            </div>
            <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
              <button onclick="sendSingleReminder('${c.debtId}')" style="background: none; border: 1px solid var(--surface-border); color: var(--text-muted); font-size: 11px; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                🔔 ส่งแจ้งเตือน
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error loading contracts:', err);
    contractsListContainer.innerHTML = '<div style="text-align: center; color: #EF4444; padding: 20px;">เกิดข้อผิดพลาดในการโหลดสัญญา</div>';
  }
}

/**
 * 4. สร้างสัญญาใหม่
 */
createContractForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    userId: document.getElementById('newUserId').value.trim(),
    debtorName: document.getElementById('newDebtorName').value.trim(),
    phone: document.getElementById('newPhone').value.trim(),
    totalAmount: document.getElementById('newTotalAmount').value,
    installmentAmount: document.getElementById('newInstallmentAmount').value,
    dueDate: document.getElementById('newDueDate').value,
    cycleDays: document.getElementById('newCycleDays').value
  };

  try {
    const res = await fetch('/api/admin/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (json.success) {
      showToast('สร้างสัญญาใหม่สำเร็จ!', '✅');
      createContractForm.reset();
      loadContracts();
      loadStats();
    } else {
      showToast(json.message || 'สร้างสัญญาไม่สำเร็จ', '❌');
    }
  } catch (err) {
    console.error('Error creating contract:', err);
    showToast('เกิดข้อผิดพลาดในการสร้างสัญญา', '❌');
  }
});

/**
 * 5. โหลดและจัดการสลิป (Slips Approval Hub)
 */
async function loadSlips() {
  try {
    slipsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">กำลังโหลดรายการสลิป...</div>';
    const res = await fetch('/api/admin/slips');
    const json = await res.json();

    if (json.success && json.slips) {
      const slips = json.slips;
      const pendingSlips = slips.filter(s => s.verificationStatus === 'PENDING');
      pendingSlipsBadge.textContent = `รอตรวจ ${pendingSlips.length} ใบ`;

      if (slips.length === 0) {
        slipsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">ยังไม่มีสลิปส่งเข้ามาในระบบ</div>';
        return;
      }

      slipsContainer.innerHTML = slips.map(s => {
        const isPending = s.verificationStatus === 'PENDING';
        return `
          <div class="slip-card">
            <div class="slip-header">
              <div>
                <div class="slip-debtor-name">${s.debtorName}</div>
                <div class="slip-meta">สัญญา: ${s.debtId || '-'} | ส่งเมื่อ: ${s.uploadedAt || '-'}</div>
              </div>
              <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: ${isPending ? 'rgba(245, 158, 11, 0.2)' : s.verificationStatus === 'VERIFIED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${isPending ? '#F59E0B' : s.verificationStatus === 'VERIFIED' ? '#10B981' : '#EF4444'};">
                ${s.verificationStatus === 'VERIFIED' ? 'อนุมัติแล้ว' : s.verificationStatus === 'REJECTED' ? 'ปฏิเสธ' : 'รอตรวจสอบ'}
              </span>
            </div>

            ${s.slipViewUrl ? `
              <div class="slip-preview-box" onclick="window.open('${s.slipViewUrl}', '_blank')">
                <img src="${s.slipViewUrl}" alt="Slip" class="slip-preview-img" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'150\' viewBox=\'0 0 300 150\' fill=\'%231E293B\'><text x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%2394A3B8\' font-family=\'sans-serif\' font-size=\'14\'>คลิกเพื่อเปิดดูสลิปใน Google Drive</text></svg>';">
              </div>
            ` : ''}

            <div style="font-size: 13px; margin: 8px 0; color: #FFFFFF;">
              ยอดระบุ: <strong>฿${Number(s.amount || 0).toLocaleString()}</strong>
            </div>

            ${isPending ? `
              <div class="slip-actions">
                <button class="btn-approve" onclick="approveSlip('${s.paymentId}', ${s.amount || 0})">
                  ✅ อนุมัติ & หักยอด
                </button>
                <button class="btn-reject" onclick="rejectSlip('${s.paymentId}')">
                  ❌ ปฏิเสธ
                </button>
              </div>
            ` : `
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">หมายเหตุ: ${s.adminNote || '-'}</div>
            `}
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error loading slips:', err);
    slipsContainer.innerHTML = '<div style="text-align: center; color: #EF4444; padding: 40px;">เกิดข้อผิดพลาดในการโหลดสลิป</div>';
  }
}

/**
 * 6. อนุมัติสลิป
 */
window.approveSlip = async function(paymentId, currentAmount) {
  const confirmed = prompt(`ยืนยันยอดเงินที่จะตัดออกจากยอดหนี้ (บาท):`, currentAmount || '');
  if (confirmed === null) return;

  const amount = Number(confirmed);
  if (isNaN(amount) || amount <= 0) {
    alert('กรุณากรอกยอดเงินที่ถูกต้องครับ');
    return;
  }

  try {
    const res = await fetch('/api/admin/slips/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, confirmedAmount: amount })
    });
    const json = await res.json();
    if (json.success) {
      showToast('อนุมัติสลิปและปรับลดยอดหนี้แล้ว!', '✅');
      loadSlips();
      loadStats();
    } else {
      showToast(json.message || 'อนุมัติไม่สำเร็จ', '❌');
    }
  } catch (err) {
    console.error('Error approving slip:', err);
    showToast('เกิดข้อผิดพลาด', '❌');
  }
};

/**
 * 7. ปฏิเสธสลิป
 */
window.rejectSlip = async function(paymentId) {
  const reason = prompt('ระบุเหตุผลที่ปฏิเสธสลิป:', 'สลิปไม่ถูกต้องหรือยอดเงินไม่ตรง');
  if (reason === null) return;

  try {
    const res = await fetch('/api/admin/slips/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, reason })
    });
    const json = await res.json();
    if (json.success) {
      showToast('ปฏิเสธสลิปเรียบร้อยแล้ว', 'ℹ️');
      loadSlips();
      loadStats();
    } else {
      showToast(json.message || 'ปฏิเสธไม่สำเร็จ', '❌');
    }
  } catch (err) {
    console.error('Error rejecting slip:', err);
    showToast('เกิดข้อผิดพลาด', '❌');
  }
};

/**
 * 8. ยิงแจ้งเตือน 08:00 น. ทันที
 */
btnTriggerCronNow.addEventListener('click', async () => {
  btnTriggerCronNow.disabled = true;
  btnTriggerCronNow.textContent = '⏳ กำลังประมวลผลและยิงข้อความ...';

  try {
    const res = await fetch('/api/reminder/trigger-now', { method: 'POST' });
    const json = await res.json();

    if (json.success) {
      const s = json.summary;
      showToast(`ยิงเตือนสำเร็จ ${s.sent} ราย (ข้าม ${s.skipped} ราย)`, '🚀');
    } else {
      showToast('เกิดข้อผิดพลาดในการยิงแจ้งเตือน', '❌');
    }
  } catch (err) {
    showToast('ไม่สามารถเชื่อมต่อระบบแจ้งเตือนได้', '❌');
  } finally {
    btnTriggerCronNow.disabled = false;
    btnTriggerCronNow.textContent = '🚀 สั่งยิงแจ้งเตือนวันนี้ทันที (Manual Trigger)';
  }
});

/**
 * 9. ยิงแจ้งเตือนรายคน
 */
window.sendSingleReminder = async function(debtId) {
  if (!confirm(`ต้องการส่ง LINE แจ้งเตือนยอดหนี้สัญญา ${debtId} ใช่หรือไม่?`)) return;

  try {
    const res = await fetch(`/api/admin/remind/${encodeURIComponent(debtId)}`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message || 'ส่งแจ้งเตือนเรียบร้อยแล้ว', '✅');
    } else {
      showToast(json.message || 'ส่งแจ้งเตือนไม่สำเร็จ', '❌');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด', '❌');
  }
};

btnManualPushSingle.addEventListener('click', () => {
  const debtId = manualDebtIdInput.value.trim();
  if (!debtId) {
    showToast('กรุณาระบุรหัสสัญญา', '⚠️');
    return;
  }
  window.sendSingleReminder(debtId);
});

// เริ่มต้นระบบ
window.addEventListener('DOMContentLoaded', () => {
  // ตั้งค่าวันครบกำหนดเริ่มต้นเป็น 30 วันข้างหน้าในฟอร์มสร้างสัญญา
  const d = new Date();
  d.setDate(d.getDate() + 30);
  document.getElementById('newDueDate').value = d.toISOString().split('T')[0];

  loadStats();
});
