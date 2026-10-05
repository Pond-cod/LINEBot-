const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const { TIMEZONE } = require('../utils/dateHelper');

/**
 * แปลงตัวเลขเป็นข้อความภาษาไทย (Thai Baht Text)
 */
function thaiBahtText(num) {
  if (isNaN(num)) return '-';
  const number = parseFloat(num).toFixed(2);
  const [intPart, decPart] = number.split('.');

  const digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

  function convertGroup(nStr) {
    let result = '';
    const len = nStr.length;
    for (let i = 0; i < len; i++) {
      const d = parseInt(nStr[i], 10);
      const pos = len - i - 1;
      if (d !== 0) {
        if (pos === 0 && d === 1 && len > 1) {
          result += 'เอ็ด';
        } else if (pos === 1 && d === 2) {
          result += 'ยี่สิบ';
        } else if (pos === 1 && d === 1) {
          result += 'สิบ';
        } else {
          result += digits[d] + positions[pos];
        }
      }
    }
    return result;
  }

  function convertInteger(intStr) {
    if (intStr === '0' || !intStr) return digits[0];
    let result = '';
    let remaining = intStr;
    let millionCount = 0;

    while (remaining.length > 0) {
      const chunkLen = remaining.length % 6 || 6;
      const chunk = remaining.slice(0, chunkLen);
      remaining = remaining.slice(chunkLen);

      const groupTxt = convertGroup(chunk);
      if (groupTxt) {
        result += groupTxt + (remaining.length > 0 ? 'ล้าน' : '');
      }
      millionCount++;
    }
    return result;
  }

  let text = convertInteger(intPart) + 'บาท';
  if (decPart === '00' || !decPart) {
    text += 'ถ้วน';
  } else {
    text += convertGroup(decPart) + 'สตางค์';
  }

  return text;
}

/**
 * สร้างเลขที่ใบเสร็จรับเงินทางการ (e-Receipt No.)
 * รูปแบบ: RC-YYYYMM-XXXX
 */
function generateReceiptNo() {
  const yyyymm = dayjs().tz(TIMEZONE).format('YYYYMM');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `RC-${yyyymm}-${randomSuffix}`;
}

/**
 * Mask เลขบัตรประจำตัวประชาชนเพื่อความปลอดภัยตาม PDPA (เช่น 1-XXXX-XXXXX-99-9)
 */
function maskIdCard(idCard) {
  if (!idCard) return '-';
  const clean = String(idCard).replace(/\D/g, '');
  if (clean.length === 13) {
    return `${clean[0]}-XXXX-XXXXX-${clean.slice(10, 12)}-${clean[12]}`;
  }
  return idCard.slice(0, 3) + '******' + idCard.slice(-3);
}

/**
 * Mask หมายเลขโทรศัพท์เพื่อความปลอดภัยตาม PDPA (เช่น 081-XXX-5678)
 */
function maskPhone(phone) {
  if (!phone) return '-';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 3)}-XXX-${clean.slice(6)}`;
  }
  if (clean.length === 9) {
    return `${clean.slice(0, 2)}-XXX-${clean.slice(5)}`;
  }
  return phone;
}

/**
 * สร้าง HTML สำหรับใบเสร็จรับเงินอิเล็กทรอนิกส์ (e-Receipt)
 */
function generateReceiptHtml({ payment = {}, debt = {}, debtor = {}, settings = {} }) {
  const receiptNo = payment.receiptNo || generateReceiptNo();
  const paidAmount = Number(payment.amount) || 0;
  const formattedAmount = paidAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const bahtText = thaiBahtText(paidAmount);

  const orgName = settings.companyName || settings.organizationName || 'ระบบบริหารจัดการสินเชื่อและการชำระเงินดิจิทัล';
  const orgAddress = settings.companyAddress || 'อาคารพาณิชย์ เลขที่ 123/45 ถนนสุขุมวิท กรุงเทพมหานคร 10110';
  const orgTaxId = settings.companyTaxId || '0-1055-67890-12-3';
  const orgPhone = settings.contactPhone || '02-123-4567';

  const paymentDate = payment.uploadedAt ? dayjs(payment.uploadedAt).tz(TIMEZONE).format('DD/MM/YYYY HH:mm น.') : dayjs().tz(TIMEZONE).format('DD/MM/YYYY HH:mm น.');
  const approvedDate = payment.approvedAt ? dayjs(payment.approvedAt).tz(TIMEZONE).format('DD/MM/YYYY HH:mm น.') : dayjs().tz(TIMEZONE).format('DD/MM/YYYY HH:mm น.');

  const debtorName = debtor?.fullName || debtor?.displayName || 'ลูกค้าผู้มีอุปการคุณ';
  const debtorPhone = debtor?.phone || '-';
  const debtorIdCard = maskIdCard(debtor?.idCardNumber);
  const contractNo = debt?.debtId || payment.debtId || '-';

  const remainingBalance = debt?.remainingBalance !== undefined ? Number(debt.remainingBalance).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
  const totalAmount = debt?.totalAmount !== undefined ? Number(debt.totalAmount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ใบเสร็จรับเงินอิเล็กทรอนิกส์ (e-Receipt) - ${receiptNo}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Outfit:wght@500;600;700;800&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #F1F5F9;
      font-family: 'Sarabun', 'Prompt', sans-serif;
      color: #1E293B;
      padding: 24px 16px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* Print action bar at top */
    .action-bar {
      max-width: 800px;
      margin: 0 auto 18px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      font-family: 'Prompt', sans-serif;
      border: none;
    }

    .btn-print {
      background: #047857;
      color: #FFFFFF;
      box-shadow: 0 4px 12px rgba(4, 120, 87, 0.25);
    }
    .btn-print:hover {
      background: #065F46;
      transform: translateY(-1px);
    }

    .btn-back {
      background: #FFFFFF;
      color: #475569;
      border: 1px solid #CBD5E1;
    }
    .btn-back:hover {
      background: #F8FAFC;
    }

    /* The Main Receipt Paper Container */
    .receipt-page {
      max-width: 800px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 14px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      border: 1px solid #E2E8F0;
      padding: 40px 48px;
      position: relative;
      overflow: hidden;
    }

    /* Top Decorative Stripe */
    .receipt-page::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: linear-gradient(90deg, #047857 0%, #10B981 50%, #0284C7 100%);
    }

    /* Header Section */
    .receipt-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #F1F5F9;
      padding-bottom: 24px;
      margin-bottom: 24px;
    }

    .org-info {
      max-width: 440px;
    }

    .org-name {
      font-family: 'Prompt', sans-serif;
      font-size: 20px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 6px;
    }

    .org-detail {
      font-size: 13px;
      color: #64748B;
      line-height: 1.5;
    }

    .receipt-title-box {
      text-align: right;
    }

    .receipt-main-title {
      font-family: 'Prompt', sans-serif;
      font-size: 22px;
      font-weight: 800;
      color: #047857;
      letter-spacing: -0.3px;
    }

    .receipt-sub-title {
      font-size: 12px;
      color: #64748B;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }

    .receipt-meta-box {
      margin-top: 12px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 10px 14px;
      display: inline-block;
      text-align: left;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .meta-row:last-child {
      margin-bottom: 0;
    }

    .meta-label {
      color: #64748B;
      font-weight: 500;
    }

    .meta-val {
      font-weight: 700;
      color: #0F172A;
      font-family: 'Outfit', 'Prompt', monospace;
    }

    /* Customer Info Block */
    .bill-to-section {
      background: #F8FAFC;
      border-radius: 10px;
      border-left: 4px solid #047857;
      padding: 14px 18px;
      margin-bottom: 28px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .info-group h4 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #047857;
      font-weight: 700;
      margin-bottom: 4px;
      font-family: 'Prompt', sans-serif;
    }

    .info-group p {
      font-size: 14px;
      font-weight: 600;
      color: #1E293B;
    }

    .info-group span {
      font-size: 12.5px;
      color: #64748B;
      font-weight: 400;
    }

    /* Line Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }

    .items-table th {
      background: #0F172A;
      color: #FFFFFF;
      font-family: 'Prompt', sans-serif;
      font-size: 13px;
      font-weight: 600;
      padding: 10px 14px;
      text-align: left;
    }

    .items-table th:last-child {
      text-align: right;
    }

    .items-table td {
      padding: 14px;
      border-bottom: 1px solid #E2E8F0;
      font-size: 14px;
      color: #334155;
    }

    .items-table td:last-child {
      text-align: right;
      font-weight: 700;
      font-family: 'Outfit', sans-serif;
      color: #0F172A;
      font-size: 15px;
    }

    /* Summary & Baht Text Block */
    .summary-grid {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
      align-items: start;
    }

    .baht-box {
      background: #ECFDF5;
      border: 1px solid #A7F3D0;
      border-radius: 8px;
      padding: 14px 16px;
    }

    .baht-label {
      font-size: 12px;
      color: #065F46;
      font-weight: 600;
      margin-bottom: 4px;
      font-family: 'Prompt', sans-serif;
    }

    .baht-val {
      font-size: 15px;
      color: #047857;
      font-weight: 700;
    }

    .calc-box {
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 12px 16px;
      background: #FFFFFF;
    }

    .calc-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 8px;
      color: #475569;
    }

    .calc-row.total {
      border-top: 1.5px solid #CBD5E1;
      padding-top: 8px;
      margin-top: 6px;
      margin-bottom: 0;
      font-size: 16px;
      font-weight: 800;
      color: #047857;
      font-family: 'Prompt', sans-serif;
    }

    .calc-row.total span:last-child {
      font-family: 'Outfit', sans-serif;
      font-size: 18px;
    }

    /* Stamp & Signatures */
    .footer-stamp-area {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 24px;
      border-top: 2px dashed #CBD5E1;
      margin-top: 10px;
    }

    /* Stamp Style */
    .digital-stamp {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 3px solid #047857;
      border-radius: 12px;
      padding: 10px 22px;
      color: #047857;
      font-family: 'Outfit', 'Prompt', sans-serif;
      text-transform: uppercase;
      font-weight: 900;
      transform: rotate(-3deg);
      background: rgba(4, 120, 87, 0.04);
      box-shadow: 0 2px 10px rgba(4, 120, 87, 0.1);
    }

    .stamp-title {
      font-size: 18px;
      letter-spacing: 2px;
      border-bottom: 1.5px solid #047857;
      padding-bottom: 2px;
      margin-bottom: 4px;
    }

    .stamp-date {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .signature-box {
      text-align: center;
      width: 200px;
    }

    .signature-line {
      border-bottom: 1px solid #94A3B8;
      height: 38px;
      margin-bottom: 6px;
    }

    .signature-name {
      font-size: 12.5px;
      color: #334155;
      font-weight: 600;
    }

    .signature-role {
      font-size: 11px;
      color: #64748B;
    }

    .legal-notice {
      margin-top: 24px;
      font-size: 11px;
      color: #94A3B8;
      text-align: center;
      line-height: 1.4;
    }

    /* Print Specific Style Optimization */
    @media print {
      body {
        background: #FFFFFF;
        padding: 0;
      }
      .action-bar {
        display: none;
      }
      .receipt-page {
        box-shadow: none;
        border: none;
        padding: 20px 24px;
        max-width: 100%;
      }
      @page {
        size: A4 portrait;
        margin: 15mm;
      }
    }

    @media (max-width: 640px) {
      .receipt-page {
        padding: 24px 18px;
      }
      .receipt-header {
        flex-direction: column;
        gap: 16px;
      }
      .receipt-title-box {
        text-align: left;
      }
      .bill-to-section {
        grid-template-columns: 1fr;
      }
      .summary-grid {
        grid-template-columns: 1fr;
      }
      .footer-stamp-area {
        flex-direction: column;
        align-items: center;
        gap: 20px;
      }
    }
  </style>
</head>
<body>

  <!-- Screen-only action buttons -->
  <div class="action-bar">
    <a href="javascript:window.history.back();" class="btn-action btn-back">
      <span>‹ กลับ</span>
    </a>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print();" class="btn-action btn-print">
        <span>🖨️ พิมพ์ / บันทึก PDF</span>
      </button>
    </div>
  </div>

  <!-- Receipt Document -->
  <div class="receipt-page">
    
    <!-- Header -->
    <div class="receipt-header">
      <div class="org-info">
        <h1 class="org-name">${orgName}</h1>
        <div class="org-detail">${orgAddress}</div>
        <div class="org-detail">เลขประจำตัวผู้เสียภาษี: ${orgTaxId} | โทรศัพท์: ${orgPhone}</div>
      </div>

      <div class="receipt-title-box">
        <div class="receipt-main-title">ใบเสร็จรับเงิน</div>
        <div class="receipt-sub-title">Official Electronic Receipt</div>

        <div class="receipt-meta-box">
          <div class="meta-row">
            <span class="meta-label">เลขที่ใบเสร็จ:</span>
            <span class="meta-val">${receiptNo}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">วันที่ออกเอกสาร:</span>
            <span class="meta-val">${approvedDate.split(' ')[0]}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">รหัสสัญญา:</span>
            <span class="meta-val">${contractNo}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bill To Customer Section -->
    <div class="bill-to-section">
      <div class="info-group">
        <h4>ข้อมูลผู้ชำระเงิน (Customer)</h4>
        <p>${debtorName}</p>
        <span>เบอร์โทร: ${debtorPhone}</span>
      </div>
      <div class="info-group">
        <h4>เลขอ้างอิงผู้กู้ / สัญญา</h4>
        <p>เลขบัตร ปชช.: ${debtorIdCard}</p>
        <span>รหัสรายการชำระ: ${payment.paymentId || '-'}</span>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>รายการชำระ (Description)</th>
          <th style="width: 140px; text-align: center;">วันเวลาที่โอน</th>
          <th style="width: 150px;">จำนวนเงิน (บาท)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>
            <strong>ชำระค่างวดสินเชื่อสัญญา ${contractNo}</strong><br>
            <span style="font-size: 12px; color: #64748B;">ตัดยอดหนี้ผ่านระบบโอนเงินเข้าบัญชีเรียบร้อยแล้ว</span>
          </td>
          <td style="text-align: center; font-size: 12.5px; color: #475569;">${paymentDate}</td>
          <td>฿${formattedAmount}</td>
        </tr>
      </tbody>
    </table>

    <!-- Summary Section -->
    <div class="summary-grid">
      <div class="baht-box">
        <div class="baht-label">จำนวนเงินตัวอักษร (Baht Text):</div>
        <div class="baht-val">(${bahtText})</div>
      </div>

      <div class="calc-box">
        <div class="calc-row">
          <span>ยอดหนี้รวมตามสัญญา:</span>
          <span>฿${totalAmount}</span>
        </div>
        <div class="calc-row">
          <span>ยอดหนี้คงเหลือยกไป:</span>
          <span style="color: #2563EB; font-weight: 600;">฿${remainingBalance}</span>
        </div>
        <div class="calc-row total">
          <span>ยอดชำระสุทธิ:</span>
          <span>฿${formattedAmount}</span>
        </div>
      </div>
    </div>

    <!-- Stamps & Authorized Signature -->
    <div class="footer-stamp-area">
      <div class="digital-stamp">
        <div class="stamp-title">PAID / ชำระแล้ว</div>
        <div class="stamp-date">APPROVED: ${approvedDate}</div>
      </div>

      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-name">${payment.approvedBy || 'ผู้มีอำนาจลงนาม / ระบบอัตโนมัติ'}</div>
        <div class="signature-role">เจ้าหน้าที่ผู้รับชำระเงิน</div>
      </div>
    </div>

    <div class="legal-notice">
      เอกสารฉบับนี้จัดทำขึ้นโดยระบบอิเล็กทรอนิกส์ตามพระราชบัญญัติว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544 มีผลผูกพันตามกฎหมาย<br>
      ใบเสร็จรับเงินจะสมบูรณ์เมื่อเงินเข้าบัญชีของผู้ให้กู้เรียบร้อยแล้ว
    </div>

  </div>

</body>
</html>`;
}

module.exports = {
  thaiBahtText,
  generateReceiptNo,
  generateReceiptHtml,
  maskIdCard,
  maskPhone
};
