# 🤖 ระบบ LINE Bot จัดการหนี้ รับสลิปเข้า Google Drive และแจ้งเตือนอัตโนมัติ

ระบบบริหารจัดการหนี้สินและลูกหนี้ครบวงจรผ่าน LINE OA ที่ช่วยลดภาระงานแมนนวล:
- **เก็บบันทึกข้อมูล**: ผ่านหน้าฟอร์ม LIFF (LINE Front-end Framework) ดึง `userId` อัตโนมัติ ป้องกันข้อมูลผิดพลาด
- **รับและจัดเก็บสลิป**: เมื่อผู้ใช้ส่งรูปภาพสลิปในแชท บอทจะดาวน์โหลดและอัปโหลดเข้า Google Drive พร้อมแนบลิงก์ลง Google Sheets ทันที
- **แจ้งเตือนอัตโนมัติ**: ระบบ Cron Job ปลุกขึ้นมาตรวจวันครบกำหนดทุกเช้าเวลา 08:00 น. แล้วยิงข้อความส่วนตัว (LINE Push Message) หาลูกหนี้ที่มีกำหนดชำระ

---

## 🛠️ ข้อมูลและทรัพยากรที่ตั้งค่าไว้แล้วในระบบ
- **Google Sheets Database**: [เปิด Spreadsheet](https://docs.google.com/spreadsheets/d/1mPzvirxQwdQX9YhgLMi_-ro6ThEtjmC8RWVJXYuu8d8/edit)
  - Spreadsheet ID: `1mPzvirxQwdQX9YhgLMi_-ro6ThEtjmC8RWVJXYuu8d8`
- **Google Drive Storage**: [เปิด Drive Folder](https://drive.google.com/drive/folders/1B7OmfKEvVBeGpAWNT1fRgypArtsDeDpB)
  - Folder ID: `1B7OmfKEvVBeGpAWNT1fRgypArtsDeDpB`
- **LINE Channel Secret**: `511b5707c18d45e0cfeb16b7cf830e16`
- **LIFF ID**: `2011816015-RfpKwHVZ`

---

## 📋 2 สิ่งที่ต้องดำเนินการเพิ่มเพื่อให้ระบบทำงานได้ 100%

### 1. ใส่ LINE Channel Access Token (Long-lived)
1. ไปที่ [LINE Developers Console](https://developers.line.biz/)
2. เลือก Messaging API Channel ของคุณ
3. ไปที่แท็บ **Messaging API** เลื่อนลงไปล่างสุดที่หัวข้อ **Channel access token (long-lived)**
4. กดปุ่ม **Issue** แล้วคัดลอก Token
5. นำมาวางที่ไฟล์ `.env` ในบรรทัด:
   ```env
   LINE_CHANNEL_ACCESS_TOKEN=วาง_TOKEN_ตรงนี้
   ```

### 2. วางไฟล์คีย์ Google Service Account (`service-account.json`)
เพื่อให้ Node.js สามารถอ่าน/เขียน Google Sheets และอัปโหลดรูปภาพลง Google Drive โดยอัตโนมัติ:
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. เปิดใช้งาน API 2 ตัว:
   - **Google Sheets API**
   - **Google Drive API**
3. ไปที่ **Credentials** > สร้าง **Service Account**
4. คลิกที่ Service Account นั้น > ไปที่แท็บ **Keys** > **Add Key** > **Create new key** > เลือก **JSON**
5. นำไฟล์ที่ดาวน์โหลดมา เปลี่ยนชื่อเป็น `service-account.json` แล้ววางไว้ในโฟลเดอร์:
   ```
   credentials/service-account.json
   ```
6. **สำคัญมาก**: คัดลอกอีเมลของ Service Account (เช่น `xxx@project.iam.gserviceaccount.com`) แล้วไปกดปุ่ม **แชร์ (Share)** ใน:
   - [Google Sheet](https://docs.google.com/spreadsheets/d/1mPzvirxQwdQX9YhgLMi_-ro6ThEtjmC8RWVJXYuu8d8/edit) -> ให้สิทธิ์ **Editor**
   - [Google Drive Folder](https://drive.google.com/drive/folders/1B7OmfKEvVBeGpAWNT1fRgypArtsDeDpB) -> ให้สิทธิ์ **Editor**

---

## 🚀 วิธีการทดสอบและเริ่มใช้งาน

### 1. ทดสอบการเชื่อมต่อ Google API
รันคำสั่งเพื่อทดสอบว่าไฟล์คีย์และการแชร์สิทธิ์สำเร็จหรือไม่:
```bash
npm run setup:sheets
```

### 2. เริ่มต้นรันเซิร์ฟเวอร์
```bash
# โหมดรันปกติ
npm start

# หรือโหมด Development (รีโหลดอัตโนมัติเมื่อแก้โค้ด)
npm run dev
```

### 3. เปิด Webhook สำหรับทดสอบ Local (ใช้ Ngrok)
หากทดสอบบนเครื่อง ให้ใช้ ngrok เปิดพอร์ต 3000:
```bash
ngrok http 3000
```
จะได้ URL เช่น `https://xxxx.ngrok-free.app`
1. นำ `https://xxxx.ngrok-free.app/webhook` ไปใส่ใน **Webhook URL** บน LINE Developers Console และเปิด **Use webhook**
2. ไปที่แท็บ **LIFF** บน LINE Developers Console แก้ไข **Endpoint URL** ของ LIFF ID `2011816015-RfpKwHVZ` ให้ชี้ไปที่:
   ```
   https://xxxx.ngrok-free.app/liff/index.html
   ```

---

## 🧪 การทดสอบฟังก์ชันสำคัญ

1. **ทดสอบฟอร์ม LIFF**:
   - เปิดลิงก์: `https://liff.line.me/2011816015-RfpKwHVZ`
   - ระบบจะดึงชื่อ LINE ของคุณขึ้นมา กรอกยอดหนี้แล้วกดบันทึก ข้อมูลจะวิ่งเข้า Google Sheets ทันที
2. **ทดสอบส่งสลิป**:
   - เข้าห้องแชทของ LINE Official Account แล้วส่งรูปภาพสลิปโอนเงินใดๆ
   - บอทจะดาวน์โหลดและนำไปเซฟลง Google Drive ในโฟลเดอร์ `1B7OmfKEvVBeGpAWNT1fRgypArtsDeDpB` พร้อมตอบกลับ Flex Message ยืนยัน
3. **ทดสอบยิงเตือนทันที (ไม่ต้องรอ 08:00 น.)**:
   - ส่งคำขอ POST มาที่:
     ```bash
     curl -X POST http://localhost:3000/api/reminder/trigger-now
     ```
   - ระบบจะตรวจเช็กวันที่ใน Google Sheet แล้วยิง Push Message หาลูกหนี้ที่มีกำหนดชำระทันที
