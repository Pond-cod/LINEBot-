require('dotenv').config();
const { lineClient } = require('../src/config/line');
const sheetsService = require('../src/services/sheetsService');
const reminderSettingsService = require('../src/services/reminderSettingsService');
const { getAdminUserIds } = require('../src/middleware/adminAuth');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

async function diagnose() {
  console.log('=== DIAGNOSTIC REPORT ===');
  
  // 1. Check LINE Bot Config
  console.log('\n--- 1. LINE Bot Messaging API Check ---');
  try {
    const botInfo = await lineClient.getBotInfo();
    console.log('✅ LINE Channel Access Token is VALID!');
    console.log('Bot Name:', botInfo.displayName);
    console.log('Bot Basic ID:', botInfo.basicId);
  } catch (err) {
    console.error('❌ LINE Channel Access Token / Config ERROR:', err.message);
    if (err.originalError?.response?.data) {
      console.error('LINE API Response:', err.originalError.response.data);
    }
  }

  // 2. Check Reminder Settings
  console.log('\n--- 2. Reminder Settings Check ---');
  try {
    const settings = await reminderSettingsService.getSettings();
    console.log('Reminder Settings:', JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('❌ Error getting reminder settings:', err.message);
  }

  // 3. Check Debts & Debtors in Sheet
  console.log('\n--- 3. Debts & Debtors in Sheet ---');
  try {
    const debts = await sheetsService.getAllDebts();
    const debtors = await sheetsService.getAllDebtors();
    console.log(`Found ${debtors.length} debtors, ${debts.length} debts.`);
    console.log('Debts:', JSON.stringify(debts, null, 2));
    console.log('Debtors:', JSON.stringify(debtors, null, 2));

    const tz = 'Asia/Bangkok';
    const todayStr = dayjs().tz(tz).format('YYYY-MM-DD');
    console.log(`Current Date in ${tz}: ${todayStr}`);

    // Check if any debt matches today or overdue
    debts.forEach(d => {
      console.log(`Debt ${d.debtId}: dueDate=${d.dueDate}, remainingBalance=${d.remainingBalance}, debtStatus=${d.debtStatus}, userId=${d.userId}`);
    });
  } catch (err) {
    console.error('❌ Error getting debts/debtors:', err.message);
  }

  // 4. Check Admin User IDs
  console.log('\n--- 4. Admin Users Check ---');
  try {
    const adminIds = await getAdminUserIds();
    console.log('Admin User IDs:', adminIds);
  } catch (err) {
    console.error('❌ Error getting admin IDs:', err.message);
  }

  // 5. Check Cron / Schedule setup
  console.log('\n--- 5. Cron Setup ---');
  console.log('Default cron is set to: 0 8 * * * (08:00 AM Asia/Bangkok)');
  console.log('Server process currently running:', process.env.VERCEL ? 'Vercel Serverless (Cron jobs do NOT run automatically on Vercel free tier without cron triggers!)' : 'Local / VPS Node.js');
}

diagnose();
