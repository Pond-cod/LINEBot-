/**
 * เทมเพลต LINE Flex Messages สวยงาม ทันสมัย รองรับภาษาไทย
 */

const formatMoney = (num) => {
  if (isNaN(num)) return num;
  return Number(num).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * 1. Flex Message: แจ้งเตือนยอดชำระหนี้ (Reminder)
 */
function createReminderFlex({
  debtorName = 'คุณลูกค้า',
  debtId,
  installmentAmount,
  remainingBalance,
  dueDate,
  reminderType = 'DUE_TODAY',
  bankAccount = 'กสิกรไทย (KBANK) 123-4-56789-0',
  accountName = 'ชื่อบัญชีผู้รับโอน'
}) {
  let badgeText = 'แจ้งเตือนครบกำหนดชำระ';
  let badgeColor = '#06C755';
  let headerTitle = 'แจ้งเตือนรอบชำระหนี้';
  let subText = `ถึงกำหนดชำระวันที่ ${dueDate}`;

  if (reminderType === 'DUE_BEFORE_1_DAY') {
    badgeText = 'เตือนล่วงหน้า 1 วัน';
    badgeColor = '#FFA500';
    headerTitle = 'แจ้งเตือนชำระวันพรุ่งนี้';
    subText = `ครบกำหนดชำระในวันพรุ่งนี้ (${dueDate})`;
  } else if (reminderType === 'OVERDUE') {
    badgeText = 'เกินกำหนดชำระ!';
    badgeColor = '#D93025';
    headerTitle = 'แจ้งเตือนเกินกำหนดชำระ';
    subText = `เกินกำหนดชำระตั้งแต่วันที่ ${dueDate} กรุณาดำเนินการ`;
  } else {
    badgeText = 'ครบกำหนดวันนี้!';
    badgeColor = '#06C755';
    headerTitle = 'ครบกำหนดชำระวันนี้';
    subText = `ครบกำหนดชำระภายในวันนี้ (${dueDate})`;
  }

  return {
    type: 'flex',
    altText: `🔔 [แจ้งเตือน] ${headerTitle} จำนวน ฿${formatMoney(installmentAmount)}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1E293B',
        paddingAll: '20px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: badgeText,
                color: '#FFFFFF',
                size: 'xs',
                weight: 'bold'
              }
            ],
            backgroundColor: badgeColor,
            cornerRadius: 'xxl',
            paddingStart: '10px',
            paddingEnd: '10px',
            paddingTop: '3px',
            paddingBottom: '3px',
            width: '140px',
            justifyContent: 'center',
            alignItems: 'center'
          },
          {
            type: 'text',
            text: headerTitle,
            weight: 'bold',
            size: 'xl',
            color: '#FFFFFF',
            margin: 'md'
          },
          {
            type: 'text',
            text: subText,
            size: 'xs',
            color: '#94A3B8',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ผู้ชำระ:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: debtorName, color: '#1E293B', size: 'sm', weight: 'bold', align: 'end', flex: 4 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'รหัสสัญญา:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: debtId || '-', color: '#3B82F6', size: 'sm', weight: 'bold', align: 'end', flex: 4 }
            ]
          },
          { type: 'separator', margin: 'lg', color: '#E2E8F0' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: '#F8FAFC',
            cornerRadius: 'md',
            paddingAll: '12px',
            contents: [
              {
                type: 'text',
                text: 'ยอดที่ต้องชำระงวดนี้',
                color: '#64748B',
                size: 'xs'
              },
              {
                type: 'text',
                text: `฿${formatMoney(installmentAmount)}`,
                size: 'xxl',
                weight: 'bold',
                color: '#0F172A',
                margin: 'xs'
              },
              {
                type: 'text',
                text: `ยอดหนี้คงเหลือรวม: ฿${formatMoney(remainingBalance)}`,
                size: 'xs',
                color: '#94A3B8',
                margin: 'xs'
              }
            ]
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            backgroundColor: '#EFF6FF',
            cornerRadius: 'md',
            paddingAll: '12px',
            contents: [
              {
                type: 'text',
                text: 'ช่องทางการชำระเงิน',
                weight: 'bold',
                size: 'xs',
                color: '#1E40AF'
              },
              {
                type: 'text',
                text: bankAccount,
                size: 'xs',
                color: '#1E3A8A',
                margin: 'xs'
              },
              {
                type: 'text',
                text: accountName,
                size: 'xs',
                color: '#475569',
                margin: 'xxs'
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '15px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#06C755',
            height: 'sm',
            action: {
              type: 'message',
              label: '📸 ส่งสลิปชำระเงินในแชทนี้',
              text: 'ฉันต้องการส่งสลิปชำระเงิน'
            }
          },
          {
            type: 'text',
            text: '💡 เมื่อโอนเงินแล้ว กรุณาส่งรูปสลิปเข้ามาในแชทนี้ได้ทันที',
            size: 'xxs',
            color: '#94A3B8',
            align: 'center',
            margin: 'xs'
          }
        ]
      }
    }
  };
}

/**
 * 2. Flex Message: ยืนยันการรับสลิปเข้าสู่ระบบ
 */
function createSlipReceivedFlex({
  paymentId,
  debtId,
  uploadedAt,
  slipViewUrl
}) {
  return {
    type: 'flex',
    altText: '✅ บันทึกสลิปโอนเงินเข้าสู่ระบบแล้ว',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#06C755',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: '✅ ได้รับสลิปโอนเงินแล้ว',
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF'
          },
          {
            type: 'text',
            text: 'บันทึกรูปภาพลง Google Drive สำเร็จ',
            size: 'xs',
            color: '#E8F5E9',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'รหัสบันทึก:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: paymentId, color: '#0F172A', size: 'sm', weight: 'bold', align: 'end', flex: 4 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'รหัสสัญญา:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: debtId || 'สัญญาหลัก', color: '#0F172A', size: 'sm', align: 'end', flex: 4 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'เวลาที่ส่ง:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: uploadedAt, color: '#0F172A', size: 'sm', align: 'end', flex: 4 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'สถานะ:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: 'รอเจ้าหน้าที่ตรวจสอบยอด', color: '#F59E0B', size: 'sm', weight: 'bold', align: 'end', flex: 4 }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '15px',
        contents: [
          ...(slipViewUrl ? [{
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '🔗 เปิดดูสลิปบน Google Drive',
              uri: slipViewUrl
            }
          }] : []),
          {
            type: 'text',
            text: 'ขอบคุณที่ชำระตรงเวลาครับ/ค่ะ 🙏',
            size: 'xs',
            color: '#64748B',
            align: 'center',
            margin: 'xs'
          }
        ]
      }
    }
  };
}

/**
 * 3. Flex Message: ข้อมูลสรุปสัญญาหนี้
 */
function createDebtSummaryFlex({
  debtorName,
  debtId,
  totalAmount,
  remainingBalance,
  installmentAmount,
  dueDate,
  debtStatus
}) {
  const statusColor = debtStatus === 'ACTIVE' ? '#06C755' : debtStatus === 'OVERDUE' ? '#D93025' : '#64748B';

  return {
    type: 'flex',
    altText: `📄 ข้อมูลสัญญาหนี้ #${debtId}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F172A',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: 'สรุปข้อมูลสัญญาหนี้',
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF'
          },
          {
            type: 'text',
            text: `รหัส: ${debtId}`,
            size: 'xs',
            color: '#94A3B8',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ชื่อผู้กู้:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: debtorName, color: '#0F172A', size: 'sm', weight: 'bold', align: 'end', flex: 4 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'ยอดหนี้รวม:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: `฿${formatMoney(totalAmount)}`, color: '#0F172A', size: 'sm', align: 'end', flex: 4 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'ยอดคงเหลือ:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: `฿${formatMoney(remainingBalance)}`, color: '#2563EB', size: 'sm', weight: 'bold', align: 'end', flex: 4 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'ค่างวด/รอบ:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: `฿${formatMoney(installmentAmount)}`, color: '#0F172A', size: 'sm', weight: 'bold', align: 'end', flex: 4 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'วันครบกำหนด:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: dueDate || '-', color: '#D93025', size: 'sm', weight: 'bold', align: 'end', flex: 4 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'สถานะ:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: debtStatus, color: statusColor, size: 'sm', weight: 'bold', align: 'end', flex: 4 }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '15px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#06C755',
            height: 'sm',
            action: {
              type: 'message',
              label: '📸 แนบสลิปชำระเงิน',
              text: 'ฉันต้องการส่งสลิปชำระเงิน'
            }
          }
        ]
      }
    }
  };
}

/**
 * 4. Flex Message: ต้อนรับผู้ใช้ใหม่
 */
function createWelcomeFlex({ displayName, liffUrl }) {
  return {
    type: 'flex',
    altText: '👋 ยินดีต้อนรับสู่ระบบจัดการหนี้และแจ้งเตือน',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F172A',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: `สวัสดีคุณ ${displayName} 👋`,
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF'
          },
          {
            type: 'text',
            text: 'ระบบจัดการสัญญาหนี้ รับสลิป และแจ้งเตือนอัตโนมัติ',
            size: 'xs',
            color: '#94A3B8',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: 'ฟังก์ชันที่คุณสามารถใช้งานได้:',
            size: 'sm',
            weight: 'bold',
            color: '#1E293B'
          },
          {
            type: 'text',
            text: '• ลงทะเบียนข้อมูลลูกหนี้ / สัญญาผ่านฟอร์ม LIFF\n• ส่งภาพสลิปโอนเงินในแชท บอทจะบันทึกลง Google Drive อัตโนมัติ\n• รับแจ้งเตือนยอดครบกำหนดทุกเช้า 08:00 น.\n• พิมพ์ "เช็กยอด" เพื่อดูยอดหนี้คงเหลือ',
            size: 'xs',
            color: '#64748B',
            wrap: true,
            margin: 'md'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '15px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#2563EB',
            height: 'sm',
            action: {
              type: 'uri',
              label: '📱 เปิดระบบ Client Portal (LIFF)',
              uri: liffUrl
            }
          }
        ]
      }
    }
  };
}

/**
 * 5. Flex Message: แจ้งผลการตรวจสอบสลิป (อนุมัติ / ปฏิเสธ)
 */
function createPaymentStatusFlex({
  paymentId,
  debtId,
  status, // 'VERIFIED' | 'REJECTED'
  amount,
  remainingBalance,
  reason
}) {
  const isApproved = status === 'VERIFIED';
  const headerBg = isApproved ? '#06C755' : '#EF4444';
  const title = isApproved ? '🎉 ยืนยันการชำระเงินสำเร็จ' : '❌ สลิปไม่ผ่านการตรวจสอบ';
  const subtitle = isApproved ? 'ยอดเงินได้ถูกตัดออกจากยอดหนี้เรียบร้อยแล้ว' : (reason || 'กรุณาตรวจสอบสลิปแล้วส่งใหม่อีกครั้ง');

  return {
    type: 'flex',
    altText: `📢 ${title}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBg,
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: title,
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF'
          },
          {
            type: 'text',
            text: subtitle,
            size: 'xs',
            color: '#FFFFFF',
            wrap: true,
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'รหัสชำระเงิน:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: paymentId, color: '#0F172A', size: 'sm', weight: 'bold', align: 'end', flex: 4 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'รหัสสัญญา:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: debtId || '-', color: '#0F172A', size: 'sm', align: 'end', flex: 4 }
            ]
          },
          ...(amount ? [{
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'ยอดที่ชำระ:', color: '#64748B', size: 'sm', flex: 2 },
              { type: 'text', text: `฿${formatMoney(amount)}`, color: '#06C755', size: 'sm', weight: 'bold', align: 'end', flex: 4 }
            ]
          }] : []),
          ...(isApproved && remainingBalance !== undefined ? [{
            type: 'separator',
            margin: 'lg',
            color: '#E2E8F0'
          }, {
            type: 'box',
            layout: 'horizontal',
            margin: 'lg',
            contents: [
              { type: 'text', text: 'ยอดหนี้คงเหลือใหม่:', color: '#64748B', size: 'sm', flex: 3 },
              { type: 'text', text: `฿${formatMoney(remainingBalance)}`, color: '#2563EB', size: 'md', weight: 'bold', align: 'end', flex: 3 }
            ]
          }] : [])
        ]
      }
    }
  };
}

module.exports = {
  createReminderFlex,
  createSlipReceivedFlex,
  createDebtSummaryFlex,
  createWelcomeFlex,
  createPaymentStatusFlex
};
