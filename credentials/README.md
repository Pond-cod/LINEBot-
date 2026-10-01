# Google Cloud Service Account Credentials

วางไฟล์คีย์ JSON ของ Google Service Account ไว้ที่โฟลเดอร์นี้ โดยตั้งชื่อไฟล์เป็น:
`service-account.json`

### วิธีการสร้างไฟล์ Service Account:
1. เข้าไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. เลือก Project ของคุณ (หรือสร้างใหม่)
3. ไปที่เมนู **APIs & Services** > **Library** แล้วกด **Enable** API 2 ตัว:
   - **Google Sheets API**
   - **Google Drive API**
4. ไปที่ **APIs & Services** > **Credentials** > คลิก **Create Credentials** > เลือก **Service Account**
5. ตั้งชื่อ เช่น `line-bot-service` แล้วกด **Done**
6. คลิกที่ชื่อ Service Account ที่เพิ่งสร้าง > ไปที่แท็บ **Keys** > คลิก **Add Key** > **Create new key** > เลือก **JSON** แล้วกด Create
7. ไฟล์จะถูกดาวน์โหลดมา ให้นำมาเปลี่ยนชื่อเป็น `service-account.json` แล้วย้ายมาไว้ในโฟลเดอร์ `credentials/` นี้
8. **สำคัญมาก**: คัดลอกอีเมลของ Service Account (เช่น `line-bot-service@xxx.iam.gserviceaccount.com`) แล้วไปกดปุ่ม **แชร์ (Share)** ใน:
   - Google Sheet: [เปิด Google Sheet](https://docs.google.com/spreadsheets/d/1mPzvirxQwdQX9YhgLMi_-ro6ThEtjmC8RWVJXYuu8d8/edit) -> ให้สิทธิ์ **Editor**
   - Google Drive Folder: [เปิด Drive Folder](https://drive.google.com/drive/folders/1B7OmfKEvVBeGpAWNT1fRgypArtsDeDpB) -> ให้สิทธิ์ **Editor**
