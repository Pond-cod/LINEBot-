require('dotenv').config();
const sheetsService = require('../src/services/sheetsService');
const lineService = require('../src/services/lineService');
const reminderSettingsService = require('../src/services/reminderSettingsService');
const { createReminderFlex } = require('../src/templates/flexMessages');

async function testRemindSingleDebt() {
  const debtId = 'DB-202610-2478';
  console.log(`Testing manual push reminder for debt ${debtId}...`);

  const debts = await sheetsService.getAllDebts();
  const target = debts.find(d => d.debtId === debtId);
  if (!target) {
    console.error('Debt not found');
    return;
  }

  const debtor = await sheetsService.getDebtorByUserId(target.userId);
  const settings = await reminderSettingsService.getSettings();
  const tpl = settings.template || {};
  const bankStr = tpl.bankName && tpl.accountNumber ? `${tpl.bankName} ${tpl.accountNumber}` : 'ธนาคารกสิกรไทย (KBANK) 123-4-56789-0';

  const flex = createReminderFlex({
    debtorName: debtor?.fullName || target.debtorName || 'คุณลูกค้า',
    debtId: target.debtId,
    installmentAmount: target.installmentAmount,
    remainingBalance: target.remainingBalance,
    dueDate: target.dueDate,
    reminderType: 'DUE_TODAY',
    tone: tpl.tone || 'POLITE',
    bankAccount: bankStr,
    accountName: tpl.accountName || 'ชื่อบัญชีผู้รับโอน',
    promptPayNumber: tpl.promptPayNumber || '',
    customFooter: tpl.customFooter || ''
  });

  const res = await lineService.pushMessage(target.userId, flex);
  console.log('✅ Flex message reminder sent successfully!', res);

  await sheetsService.logReminder({
    debtId: target.debtId,
    userId: target.userId,
    reminderType: 'MANUAL_ADMIN',
    status: 'SUCCESS'
  });
  console.log('✅ Logged to Google Sheets ReminderLogs tab!');
}

testRemindSingleDebt();
