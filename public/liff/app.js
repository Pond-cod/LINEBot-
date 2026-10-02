// Configuration
const LIFF_ID = '2011816015-RfpKwHVZ';

let currentProfile = null;

// Elements
const userAvatarEl = document.getElementById('userAvatar');
const userNameEl = document.getElementById('userName');
const userIdInput = document.getElementById('userId');
const displayNameInput = document.getElementById('displayName');
const debtForm = document.getElementById('debtForm');
const submitBtn = document.getElementById('submitBtn');
const successModal = document.getElementById('successModal');
const closeLiffBtn = document.getElementById('closeLiffBtn');

// Tabs
const tabRegister = document.getElementById('btnTabRegister');
const tabInfo = document.getElementById('btnTabInfo');
const paneRegister = document.getElementById('tab-register');
const paneInfo = document.getElementById('tab-info');
const debtDetailsEl = document.getElementById('debtDetails');

/**
 * 1. เริ่มต้นการทำงานของ LIFF SDK
 */
async function initializeLiff() {
  try {
    await liff.init({ liffId: LIFF_ID });

    if (!liff.isLoggedIn()) {
      if (window.location.protocol === 'http:' && !liff.isInClient()) {
        console.warn('Cannot auto-login with LINE on HTTP localhost. Using demo offline mode.');
        userNameEl.textContent = '😾POND-IT😸 (โหมดทดสอบ Local)';
        userIdInput.value = 'U16565ee5abb9acecbbaf08d123f06cd2';
        displayNameInput.value = '😾POND-IT😸';
        const today = new Date();
        today.setDate(today.getDate() + 30);
        document.getElementById('dueDate').value = today.toISOString().split('T')[0];
        return;
      }
      liff.login();
      return;
    }

    // ดึงโปรไฟล์ LINE ของผู้ใช้
    currentProfile = await liff.getProfile();
    
    // อัปเดตข้อมูลบนหน้าจอ
    userNameEl.textContent = currentProfile.displayName || 'ผู้ใช้งาน LINE';
    if (currentProfile.pictureUrl) {
      userAvatarEl.src = currentProfile.pictureUrl;
    }
    userIdInput.value = currentProfile.userId;
    displayNameInput.value = currentProfile.displayName || '';

    // ตั้งค่าวันครบกำหนดเป็น 30 วันข้างหน้าเป็นค่าเริ่มต้น
    const today = new Date();
    today.setDate(today.getDate() + 30);
    const defaultDateStr = today.toISOString().split('T')[0];
    document.getElementById('dueDate').value = defaultDateStr;

    console.log('✅ LIFF Initialized successfully for userId:', currentProfile.userId);
  } catch (error) {
    console.error('❌ Error initializing LIFF:', error);
    userNameEl.textContent = 'โหมดทดสอบ (Offline)';
    userIdInput.value = 'U_TEST_USER_' + Math.floor(Math.random() * 10000);
  }
}

/**
 * 2. จัดการการเปลี่ยนแท็บ
 */
tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabInfo.classList.remove('active');
  paneRegister.classList.add('active');
  paneInfo.classList.remove('active');
});

tabInfo.addEventListener('click', async () => {
  tabInfo.classList.add('active');
  tabRegister.classList.remove('active');
  paneInfo.classList.add('active');
  paneRegister.classList.remove('active');

  await loadDebtInfo();
});

/**
 * 3. โหลดข้อมูลหนี้ปัจจุบันจาก API
 */
async function loadDebtInfo() {
  const userId = userIdInput.value;
  if (!userId) {
    debtDetailsEl.innerHTML = '<div class="placeholder-text">ไม่พบ LINE User ID</div>';
    return;
  }

  debtDetailsEl.innerHTML = '<div class="placeholder-text">⏳ กำลังดึงข้อมูลจากระบบ...</div>';

  try {
    const res = await fetch(`/api/liff/debt/${encodeURIComponent(userId)}`);
    const data = await res.json();

    if (data.success && data.activeDebt) {
      const d = data.activeDebt;
      const debtor = data.debtor;
      debtDetailsEl.innerHTML = `
        <div style="margin-bottom: 12px;">
          <strong style="font-size: 15px;">สัญญาเลขที่: ${d.debtId}</strong>
          <div style="font-size: 12px; color: #64748B;">ผู้กู้: ${debtor?.fullName || debtor?.displayName || '-'}</div>
          <span class="status-badge ${d.debtStatus === 'ACTIVE' ? 'active' : ''}">${d.debtStatus}</span>
        </div>

        <div class="debt-stat-grid">
          <div class="stat-box">
            <div class="stat-label">ยอดหนี้รวม</div>
            <div class="stat-value">฿${Number(d.totalAmount).toLocaleString()}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">ยอดคงเหลือ</div>
            <div class="stat-value highlight">฿${Number(d.remainingBalance).toLocaleString()}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">ค่างวดต่องวด</div>
            <div class="stat-value">฿${Number(d.installmentAmount).toLocaleString()}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">วันครบกำหนด</div>
            <div class="stat-value danger" style="font-size: 13px;">${d.dueDate || '-'}</div>
          </div>
        </div>

        <div style="margin-top: 18px; text-align: center; font-size: 12px; color: #64748B;">
          💡 คุณสามารถส่งรูปภาพสลิปโอนเงินเข้ามาในห้องแชท LINE เพื่อบันทึกการชำระได้ทันที
        </div>
      `;
    } else {
      debtDetailsEl.innerHTML = `
        <div class="placeholder-text">
          ยังไม่พบข้อมูลสัญญาหนี้ที่กำลังเปิดใช้งานของคุณ<br>
          สามารถกดแท็บ <strong>"บันทึกข้อมูลสัญญา"</strong> เพื่อสร้างสัญญาใหม่ได้ครับ
        </div>
      `;
    }
  } catch (error) {
    console.error('Error fetching debt info:', error);
    debtDetailsEl.innerHTML = '<div class="placeholder-text">⚠️ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้</div>';
  }
}

/**
 * 4. ส่งฟอร์มบันทึกข้อมูล
 */
debtForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').textContent = 'กำลังบันทึก...';

  const formData = {
    userId: userIdInput.value,
    displayName: displayNameInput.value,
    fullName: document.getElementById('fullName').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    idCardNumber: document.getElementById('idCardNumber').value.trim(),
    totalAmount: document.getElementById('totalAmount').value,
    installmentAmount: document.getElementById('installmentAmount').value,
    dueDate: document.getElementById('dueDate').value,
    cycleDays: document.getElementById('cycleDays').value
  };

  try {
    const response = await fetch('/api/liff/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    if (result.success) {
      successModal.classList.remove('hidden');
    } else {
      alert(`⚠️ ${result.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'}`);
    }
  } catch (error) {
    console.error('Submit error:', error);
    alert('⚠️ ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').textContent = 'บันทึกข้อมูลสัญญา';
  }
});

/**
 * 5. ปิดหน้าต่าง LIFF
 */
closeLiffBtn.addEventListener('click', () => {
  if (liff.isInClient()) {
    liff.closeWindow();
  } else {
    successModal.classList.add('hidden');
    debtForm.reset();
  }
});

// เริ่มต้นระบบเมื่อโหลดหน้าเสร็จ
window.addEventListener('DOMContentLoaded', initializeLiff);
