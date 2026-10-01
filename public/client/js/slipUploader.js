/**
 * โมดูลจัดการการเลือกไฟล์รูปสลิป พรีวิว และบีบอัดรูปภาพก่อนอัปโหลด
 */
(function() {
  let u_currentSlipBase64 = null;

  const u_dropzoneArea = document.getElementById('dropzoneArea');
  const u_slipFileInput = document.getElementById('slipFileInput');
  const u_previewContainer = document.getElementById('previewContainer');
  const u_slipPreviewImg = document.getElementById('slipPreviewImg');
  const u_btnRemovePreview = document.getElementById('btnRemovePreview');
  const u_btnSubmitSlip = document.getElementById('btnSubmitSlip');

  if (!u_dropzoneArea || !u_slipFileInput) return;

  u_dropzoneArea.addEventListener('click', () => {
    u_slipFileInput.click();
  });

  u_dropzoneArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    u_dropzoneArea.classList.add('dragover');
  });

  u_dropzoneArea.addEventListener('dragleave', () => {
    u_dropzoneArea.classList.remove('dragover');
  });

  u_dropzoneArea.addEventListener('drop', (e) => {
    e.preventDefault();
    u_dropzoneArea.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  u_slipFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  if (u_btnRemovePreview) {
    u_btnRemovePreview.addEventListener('click', (e) => {
      e.stopPropagation();
      resetSlipUpload();
    });
  }

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้นครับ');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      compressImage(event.target.result, 1280, 0.85, (compressedBase64) => {
        u_currentSlipBase64 = compressedBase64;
        u_slipPreviewImg.src = compressedBase64;
        u_dropzoneArea.style.display = 'none';
        u_previewContainer.classList.add('show');
        if (u_btnSubmitSlip) u_btnSubmitSlip.disabled = false;
      });
    };
    reader.readAsDataURL(file);
  }

  function compressImage(srcBase64, maxWidth, quality, callback) {
    const img = new Image();
    img.src = srcBase64;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL('image/jpeg', quality);
      callback(compressed);
    };
  }

  function resetSlipUpload() {
    u_currentSlipBase64 = null;
    u_slipFileInput.value = '';
    u_slipPreviewImg.src = '';
    u_previewContainer.classList.remove('show');
    u_dropzoneArea.style.display = 'block';
    if (u_btnSubmitSlip) u_btnSubmitSlip.disabled = true;
  }

  window.getSlipBase64 = () => u_currentSlipBase64;
  window.resetSlipUpload = resetSlipUpload;
})();
