const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { isGasConfigured, callGas } = require('../src/services/gasService');
const { sheets, drive, sheetId, driveFolderId } = require('../src/config/google');
const { initializeSheets } = require('../src/services/sheetsService');

async function testConnection() {
  console.log('====================================================');
  console.log('🔍 ทดสอบการเชื่อมต่อ Google Sheets & Google Drive');
  console.log('====================================================\n');

  console.log(`📌 Target Google Sheet ID: ${sheetId}`);
  console.log(`📌 Target Google Drive Folder ID: ${driveFolderId}`);
  console.log(`📌 Google Apps Script Web App URL: ${process.env.GAS_WEBAPP_URL || '(ยังไม่ได้ระบุ)'}\n`);

  // 1. ตรวจสอบโหมด Google Apps Script Web App
  if (isGasConfigured()) {
    console.log('🚀 โหมดที่ใช้งาน: Google Apps Script Web App (GAS)');
    console.log('⏳ กำลังทดสอบเชื่อมต่อไปยัง Google Apps Script...');
    try {
      const initResult = await callGas('initialize');
      console.log('✅ เชื่อมต่อ Google Apps Script Web App สำเร็จ 100%!');
      console.log('📑 ผลการเตรียมแท็บใน Google Sheets:', JSON.stringify(initResult));
      console.log('\n🎉 ยินดีด้วยครับ! ระบบ Google Sheets & Google Drive พร้อมใช้งานเต็มรูปแบบแล้ว!');
      console.log('====================================================');
      return;
    } catch (gasErr) {
      console.error('❌ ไม่สามารถเรียกใช้งาน Google Apps Script Web App ได้:', gasErr.message);
      console.log('👉 ตรวจสอบว่าในขั้นตอน Deploy > New Deployment:');
      console.log('   - Execute as: Me (ฉัน)');
      console.log('   - Who has access: Anyone (ทุกคน)');
      console.log('====================================================');
      return;
    }
  }

  // 2. ตรวจสอบโหมด Google Service Account
  console.log('🏢 โหมดที่ใช้งาน: Google Cloud Service Account');
  if (!sheets || !drive) {
    console.warn('⚠️ ไม่พบทั้ง GAS_WEBAPP_URL และ service-account.json');
    console.log('👉 แนะนำวิธีที่ง่ายที่สุด: นำโค้ดในโฟลเดอร์ gas/Code.gs ไปวางใน Apps Script Project ของคุณ:');
    console.log('   https://script.google.com/u/0/home/projects/1cSEpWnwgJO3hawIbF4xAN111VIA_qGZpyFGCwhYNsG8K26JUSxD9LxSW/edit');
    console.log('   แล้ว Deploy เป็น Web App นำ URL ที่ได้มาใส่ใน .env ในบรรทัด GAS_WEBAPP_URL=...\n');
    return;
  }

  try {
    console.log('⏳ กำลังตรวจสอบสิทธิ์การเข้าถึง Google Sheets...');
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    console.log(`✅ เชื่อมต่อ Google Sheet สำเร็จ! ชื่อไฟล์: "${meta.data.properties.title}"`);
    console.log(`📑 แท็บที่มีอยู่ปัจจุบัน: ${meta.data.sheets.map(s => s.properties.title).join(', ')}`);

    console.log('\n⏳ กำลังตรวจสอบและสร้างแท็บฐานข้อมูล (Debtors, Debts, Payments, ReminderLogs)...');
    await initializeSheets();
    console.log('✅ ตรวจสอบและตั้งค่าแท็บฐานข้อมูลเรียบร้อยสมบูรณ์!\n');
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการเข้าถึง Google Sheets:', error.message);
  }

  try {
    console.log('⏳ กำลังตรวจสอบสิทธิ์การเข้าถึงโฟลเดอร์ Google Drive...');
    const folder = await drive.files.get({
      fileId: driveFolderId,
      fields: 'id, name, mimeType'
    });
    console.log(`✅ เชื่อมต่อ Google Drive สำเร็จ! ชื่อโฟลเดอร์: "${folder.data.name}"\n`);
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการเข้าถึง Google Drive:', error.message);
  }

  console.log('====================================================');
}

testConnection();
