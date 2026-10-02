/**
 * Client Portal: Pay & Upload Slip Sub-View (#/pay)
 * Handles Contract Selection for Payment, Bank Info Copying,
 * Drag & Drop Image Selection, WebP Compression, and Slip Submission
 */

import { store, eventBus, clearCachedData } from '../core/clientState.js';
import { uploadSlipApi, showToast } from '../core/clientApi.js';
import { compressImage } from '../core/slipCompressor.js';
import { clientRouter } from '../core/clientRouter.js';

export function initPayView() {
  const btnCopyAcc = document.getElementById('btnCopyAcc');
  const bankAccNo = document.getElementById('bankAccNo');
  const dropzoneArea = document.getElementById('dropzoneArea');
  const slipFileInput = document.getElementById('slipFileInput');
  const btnRemovePreview = document.getElementById('btnRemovePreview');
  const btnSubmitSlip = document.getElementById('btnSubmitSlip');
  const selectPayDebt = document.getElementById('selectPayDebt');

  // 1. Copy Bank Account Number
  if (btnCopyAcc && bankAccNo) {
    btnCopyAcc.addEventListener('click', async () => {
      const text = bankAccNo.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
        showToast('คัดลอกเลขบัญชีแล้ว', '📋');
      } catch (e) {
        showToast('เลขบัญชี: ' + text, '📋');
      }
    });
  }

  // 2. Contract Selector Listener
  if (selectPayDebt) {
    selectPayDebt.addEventListener('change', () => {
      const debtId = selectPayDebt.value;
      if (debtId) {
        store.setSelectedDebtId(debtId);
        const debt = store.getSelectedDebt();
        if (debt) {
          const slipAmountInput = document.getElementById('slipAmountInput');
          if (slipAmountInput) {
            slipAmountInput.value = debt.installmentAmount || '';
          }
          updateInstallmentBadge(debt);
        }
      }
    });
  }

  // 3. Dropzone & File Input Listeners
  if (dropzoneArea && slipFileInput) {
    dropzoneArea.addEventListener('click', () => {
      slipFileInput.click();
    });

    dropzoneArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneArea.classList.add('dragover');
    });

    dropzoneArea.addEventListener('dragleave', () => {
      dropzoneArea.classList.remove('dragover');
    });

    dropzoneArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneArea.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });

    slipFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelection(e.target.files[0]);
      }
    });
  }

  // 4. Remove Image Preview
  if (btnRemovePreview) {
    btnRemovePreview.addEventListener('click', (e) => {
      e.stopPropagation();
      resetSlipUploadState();
    });
  }

  // 5. Submit Slip
  if (btnSubmitSlip) {
    btnSubmitSlip.addEventListener('click', submitSlip);
  }

  // Listen for data updates to re-populate the contract selector
  eventBus.on('data:updated', () => renderPayViewDebtSelect());
  eventBus.on('debt:selected', () => syncPayViewDebtSelect());

  renderPayViewDebtSelect();
}

function renderPayViewDebtSelect() {
  const selectPayDebt = document.getElementById('selectPayDebt');
  if (!selectPayDebt) return;

  const debts = store.clientData?.debts || [];
  const selectedDebt = store.getSelectedDebt();

  if (debts.length === 0) {
    selectPayDebt.innerHTML = '<option value="">-- ยังไม่มีสัญญาหนี้ที่เปิดอยู่ --</option>';
    selectPayDebt.disabled = true;
    updateInstallmentBadge(null);
    return;
  }

  selectPayDebt.disabled = false;
  selectPayDebt.innerHTML = debts.map(d => {
    const isCurrent = selectedDebt && d.debtId === selectedDebt.debtId;
    const remain = Number(d.remainingBalance) || 0;
    const install = Number(d.installmentAmount) || 0;
    return `
      <option value="${d.debtId}" ${isCurrent ? 'selected' : ''}>
        📑 ${d.debtId} (ยอดค้าง: ฿${remain.toLocaleString('th-TH')} | งวดละ: ฿${install.toLocaleString('th-TH')})
      </option>
    `;
  }).join('');

  if (selectedDebt) {
    updateInstallmentBadge(selectedDebt);
    const slipAmountInput = document.getElementById('slipAmountInput');
    if (slipAmountInput && !slipAmountInput.value) {
      slipAmountInput.value = selectedDebt.installmentAmount || '';
    }
  }
}

function syncPayViewDebtSelect() {
  const selectPayDebt = document.getElementById('selectPayDebt');
  const selectedDebt = store.getSelectedDebt();
  if (selectPayDebt && selectedDebt) {
    selectPayDebt.value = selectedDebt.debtId;
    updateInstallmentBadge(selectedDebt);
    const slipAmountInput = document.getElementById('slipAmountInput');
    if (slipAmountInput) {
      slipAmountInput.value = selectedDebt.installmentAmount || '';
    }
  }
}

function updateInstallmentBadge(debt) {
  const badge = document.getElementById('badgeSelectedDebtInstallment');
  if (!badge) return;
  if (debt && debt.installmentAmount) {
    badge.textContent = `ค่างวด: ฿${Number(debt.installmentAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  } else {
    badge.textContent = '';
  }
}

async function handleFileSelection(file) {
  if (!file.type.startsWith('image/')) {
    showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้นครับ', '⚠️');
    return;
  }

  const dropzoneArea = document.getElementById('dropzoneArea');
  const previewContainer = document.getElementById('previewContainer');
  const slipPreviewImg = document.getElementById('slipPreviewImg');
  const btnSubmitSlip = document.getElementById('btnSubmitSlip');

  showToast('กำลังบีบอัดรูปภาพ...', '⚡');

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const compressedWebP = await compressImage(event.target.result, 1280, 0.85);
      store.setSlipBase64(compressedWebP);

      if (slipPreviewImg) slipPreviewImg.src = compressedWebP;
      if (dropzoneArea) dropzoneArea.style.display = 'none';
      if (previewContainer) previewContainer.classList.add('show');
      if (btnSubmitSlip) btnSubmitSlip.disabled = false;
      showToast('พร้อมส่งสลิปชำระเงิน', '📸');
    } catch (err) {
      console.error('Image compression failed:', err);
      showToast('ไม่สามารถประมวลผลรูปภาพได้', '❌');
    }
  };
  reader.readAsDataURL(file);
}

export function resetSlipUploadState() {
  store.setSlipBase64(null);

  const slipFileInput = document.getElementById('slipFileInput');
  const slipPreviewImg = document.getElementById('slipPreviewImg');
  const previewContainer = document.getElementById('previewContainer');
  const dropzoneArea = document.getElementById('dropzoneArea');
  const btnSubmitSlip = document.getElementById('btnSubmitSlip');

  if (slipFileInput) slipFileInput.value = '';
  if (slipPreviewImg) slipPreviewImg.src = '';
  if (previewContainer) previewContainer.classList.remove('show');
  if (dropzoneArea) dropzoneArea.style.display = 'block';
  if (btnSubmitSlip) btnSubmitSlip.disabled = true;
}

async function submitSlip() {
  const btnSubmitSlip = document.getElementById('btnSubmitSlip');
  const slipAmountInput = document.getElementById('slipAmountInput');
  const selectPayDebt = document.getElementById('selectPayDebt');

  if (!store.currentSlipBase64) {
    showToast('กรุณาเลือกไฟล์สลิปก่อนครับ', '⚠️');
    return;
  }

  const selectedDebt = store.getSelectedDebt();
  const targetDebtId = selectPayDebt?.value || selectedDebt?.debtId || '';

  if (!targetDebtId) {
    showToast('กรุณาเลือกสัญญาที่ต้องการชำระเงิน', '⚠️');
    return;
  }

  if (btnSubmitSlip) {
    btnSubmitSlip.disabled = true;
    btnSubmitSlip.innerHTML = '<span>⏳ กำลังอัปโหลด...</span>';
  }

  const payload = {
    userId: store.currentUser.userId,
    debtId: targetDebtId,
    amount: slipAmountInput ? slipAmountInput.value : 0,
    imageBase64: store.currentSlipBase64
  };

  try {
    const json = await uploadSlipApi(payload);

    if (json.success) {
      showToast('ส่งสลิปชำระเงินเรียบร้อยแล้ว!', '✅');
      clearCachedData(store.currentUser.userId);
      resetSlipUploadState();
      
      // Notify orchestrator to reload data and switch to history view
      eventBus.emit('slip:submitted');
      clientRouter.navigateTo('#/history');
    } else {
      showToast(json.message || 'ส่งสลิปไม่สำเร็จ', '❌');
    }
  } catch (err) {
    console.error('Error submitting slip:', err);
    showToast('เกิดข้อผิดพลาดในการส่งสลิป', '❌');
  } finally {
    if (btnSubmitSlip) {
      btnSubmitSlip.disabled = false;
      btnSubmitSlip.innerHTML = '<span>🚀 ส่งสลิปชำระเงิน</span>';
    }
  }
}
