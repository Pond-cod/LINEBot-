const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './credentials/service-account.json');

let auth = null;
let sheets = null;
let drive = null;

const scopes = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive'
];

try {
  // 1. อ่านจาก Environment Variable (JSON String หรือ Base64) เหมาะสำหรับ Vercel Serverless
  const rawEnvJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_CREDENTIALS;
  const rawEnvBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;

  let credentialsObj = null;
  if (rawEnvJson) {
    try {
      credentialsObj = JSON.parse(rawEnvJson);
    } catch (e) {
      try {
        const decoded = Buffer.from(rawEnvJson, 'base64').toString('utf8');
        credentialsObj = JSON.parse(decoded);
      } catch (err2) {
        console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
      }
    }
  } else if (rawEnvBase64) {
    try {
      const decoded = Buffer.from(rawEnvBase64, 'base64').toString('utf8');
      credentialsObj = JSON.parse(decoded);
    } catch (e) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_BASE64:', e.message);
    }
  }

  if (credentialsObj) {
    auth = new google.auth.GoogleAuth({
      credentials: credentialsObj,
      scopes
    });
    sheets = google.sheets({ version: 'v4', auth });
    drive = google.drive({ version: 'v3', auth });
    console.log('✅ Google Cloud Authentication Initialized (from Environment Variable)');
  } else if (fs.existsSync(keyPath)) {
    // 2. อ่านจาก Key File ในโฟลเดอร์ credentials
    auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes
    });
    sheets = google.sheets({ version: 'v4', auth });
    drive = google.drive({ version: 'v3', auth });
    console.log('✅ Google Cloud Authentication Initialized (Service Account File)');
  } else {
    console.warn(`⚠️ Warning: Google Service Account key file not found at: ${keyPath}`);
    console.warn('👉 On Vercel: You can set GOOGLE_SERVICE_ACCOUNT_JSON in environment variables.');
  }
} catch (error) {
  console.error('❌ Failed to initialize Google Auth:', error.message);
}

module.exports = {
  auth,
  sheets,
  drive,
  sheetId: process.env.GOOGLE_SHEET_ID,
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID
};
