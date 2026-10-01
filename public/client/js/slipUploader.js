/**
 * โมดูลจัดการการเลือกไฟล์รูปสลิป พรีวิว และบีบอัดรูปภาพก่อนอัปโหลด
 */
(function() {
  let currentSlipBase64 = null;

  const dropzoneArea = document.getElementById('dropzoneArea');
  const slipFileInput = document.getElementById('slipFileInput');
  const previewContainer = document.getElementById('previewContainer');
  const slipPreviewImg = document.getElementById('slipPreviewImg');
  const btnRemovePreview = document.getElementById('btnRemovePreview');
  const btnSubmitSlip = document.getElementById('btnSubmitSlip');

  if (!dropzoneArea || !slipFileInput) return;

  // คลิกที่ Dropzone เพื่อเลือกไฟล์
  dropzoneArea.addEventListener('click', () => {
    slipFileInput.click();
  });

  // Drag & drop events
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
      handleFile(e.dataTransfer.files[0]);
    }
  });

  slipFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  if (btnRemovePreview) {
    btnRemovePreview.addEventListener('click', (e) => {
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
        currentSlipBase64 = compressedBase64;
        slipPreviewImg.src = compressedBase64;
        dropzoneArea.style.display = 'none';
        previewContainer.classList.add('show');
        if (btnSubmitSlip) btnSubmitSlip.disabled = false;
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
    currentSlipBase64 = null;
    slipFileInput.value = '';
    slipPreviewImg.src = '';
    previewContainer.classList.remove('show');
    dropzoneArea.style.display = 'block';
    if (btnSubmitSlip) btnSubmitSlip.disabled = true;
  }

  window.getSlipBase64 = () => currentSlipBase64;
  window.resetSlipUpload = resetSlipUpload;
})();
