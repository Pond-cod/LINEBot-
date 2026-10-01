const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './credentials/service-account.json');

let auth = null;
let sheets = null;
let drive = null;

if (fs.existsSync(keyPath)) {
  try {
    auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ]
    });

    sheets = google.sheets({ version: 'v4', auth });
    drive = google.drive({ version: 'v3', auth });
    console.log('✅ Google Cloud Authentication Initialized (Service Account)');
  } catch (error) {
    console.error('❌ Failed to initialize Google Auth with key file:', error.message);
  }
} else {
  console.warn(`⚠️ Warning: Google Service Account key file not found at: ${keyPath}`);
  console.warn('👉 Please place your "service-account.json" inside the "credentials/" directory.');
}

module.exports = {
  auth,
  sheets,
  drive,
  sheetId: process.env.GOOGLE_SHEET_ID,
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID
};
