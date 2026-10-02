/**
 * ==============================================================================
 * สคริปต์สร้างและติดตั้ง LINE Official Rich Menu สไตล์สถาบันการเงิน (6 ช่อง)
 * วิธีใช้งาน: node scripts/setupRichMenu.js
 * ==============================================================================
 */

require('dotenv').config();
const { messagingApi } = require('@line/bot-sdk');

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const liffId = process.env.LIFF_ID;

if (!channelAccessToken) {
  console.error('❌ ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ในไฟล์ .env');
  process.exit(1);
}

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: channelAccessToken
});

const clientBlob = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: channelAccessToken
});

async function setupOfficialRichMenu() {
  console.log('====================================================');
  console.log('🏛️ กำลังสร้าง LINE Rich Menu สไตล์สถาบันการเงิน (6 ช่อง)...');
  console.log('====================================================\n');

  const liffBaseUrl = liffId ? `https://liff.line.me/${liffId}` : 'https://line.me';

  // 1. นิยามโครงสร้าง Rich Menu 6 ช่อง (ขนาดมาตรฐาน 2500 x 1686 px)
  const richMenuObject = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: 'เมนูหลักสถาบันการเงิน (Official Banking Rich Menu)',
    chatBarText: '📋 เมนูบริการลูกค้า',
    areas: [
      // ช่องที่ 1: ตรวจสอบยอดหนี้ & สัญญา
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: {
          type: 'uri',
          label: 'ยอดหนี้ของฉัน',
          uri: `${liffBaseUrl}?target=/client/`
        }
      },
      // ช่องที่ 2: แนบสลิปชำระเงิน
      {
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: {
          type: 'uri',
          label: 'แจ้งชำระเงิน',
          uri: `${liffBaseUrl}?target=/client/#view-slip`
        }
      },
      // ช่องที่ 3: ประวัติและใบเสร็จรับเงิน
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: {
          type: 'uri',
          label: 'ประวัติ & ใบเสร็จ',
          uri: `${liffBaseUrl}?target=/client/#view-history`
        }
      },
      // ช่องที่ 4: ข้อมูลบัญชีรับชำระ
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: {
          type: 'message',
          label: 'เลขที่บัญชี',
          text: 'ข้อมูลการชำระเงิน'
        }
      },
      // ช่องที่ 5: สรุปข้อมูลสัญญา & นโยบาย
      {
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: {
          type: 'uri',
          label: 'ข้อมูลสัญญา',
          uri: `${liffBaseUrl}?target=/client/#view-profile`
        }
      },
      // ช่องที่ 6: ติดต่อฝ่ายบริการลูกค้า
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: {
          type: 'message',
          label: 'ติดต่อเจ้าหน้าที่',
          text: 'ติดต่อเจ้าหน้าที่'
        }
      }
    ]
  };

  try {
    // 2. ส่งคำขอสร้าง Rich Menu ไปยัง LINE
    console.log('⏳ กำลังลงทะเบียน Rich Menu เข้าสู่ LINE Messaging API...');
    const createdMenu = await client.createRichMenu(richMenuObject);
    const richMenuId = createdMenu.richMenuId;
    console.log(`✅ สร้าง Rich Menu สำเร็จ! Rich Menu ID: ${richMenuId}\n`);

    // 3. ตั้งค่าให้เป็น Default Rich Menu สำหรับผู้ใช้ทุกคน
    console.log('⏳ กำลังตั้งค่าให้เป็น Rich Menu เริ่มต้น (Default Rich Menu)...');
    await client.setDefaultRichMenu(richMenuId);
    console.log('✅ ตั้งค่าเป็น Default Rich Menu เรียบร้อยแล้ว!');

    console.log('\n====================================================');
    console.log('🎉 เสร็จสิ้นการตั้งค่า Rich Menu ทางการ!');
    console.log(`📌 รหัสเมนู: ${richMenuId}`);
    console.log('👉 ขั้นตอนถัดไป: คุณสามารถอัปโหลดภาพพื้นหลังขนาด 2500 x 1686 px');
    console.log('   ผ่าน LINE Official Account Manager (LINE OA) หรือใช้ API อัปโหลดภาพ');
    console.log('====================================================');
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการสร้าง Rich Menu:', error.message);
    if (error.details) console.error('Details:', error.details);
  }
}

setupOfficialRichMenu();
