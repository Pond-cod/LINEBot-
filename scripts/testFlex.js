const { createReminderFlex, createAdminDailySummaryFlex } = require('../src/templates/flexMessages');

try {
  const flex = createReminderFlex({
    debtorName: '😾POND-IT😸',
    debtId: 'DB-202610-2478',
    installmentAmount: 1900,
    remainingBalance: 13300,
    dueDate: '2026-11-01',
    reminderType: 'DUE_TODAY'
  });
  console.log('✅ createReminderFlex works perfectly!');
  console.log('AltText:', flex.altText);
  console.log('Flex Bubble Size:', flex.contents.size);
} catch (err) {
  console.error('❌ Error creating flex:', err);
}
