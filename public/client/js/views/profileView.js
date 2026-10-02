/**
 * Client Portal: Profile Sub-View (#/profile)
 * Handles Debtor KYC Details, Copy LINE User ID, and Account Settings
 */

import { store, eventBus } from '../core/clientState.js';
import { showToast } from '../core/clientApi.js';

export function initProfileView() {
  const btnCopyUserId = document.getElementById('btnCopyUserId');

  if (btnCopyUserId) {
    btnCopyUserId.addEventListener('click', async () => {
      const userId = store.currentUser.userId;
      if (userId && userId.startsWith('U')) {
        try {
          await navigator.clipboard.writeText(userId);
          showToast('คัดลอก LINE User ID แล้ว', '📋');
        } catch (e) {
          showToast('LINE ID: ' + userId, '📋');
        }
      } else {
        showToast('ยังไม่ได้เข้าสู่ระบบ LINE', '⚠️');
      }
    });
  }

  eventBus.on('data:updated', () => renderProfile());
  eventBus.on('user:updated', () => renderProfile());

  renderProfile();
}

export function renderProfile() {
  const profileUserId = document.getElementById('profileUserId');
  const profileDisplayName = document.getElementById('profileDisplayName');
  const profileFullName = document.getElementById('profileFullName');
  const profilePhone = document.getElementById('profilePhone');
  const profileIdCard = document.getElementById('profileIdCard');
  const profileRegisteredAt = document.getElementById('profileRegisteredAt');

  const debtor = store.clientData?.debtor;
  const user = store.currentUser;

  if (profileUserId) profileUserId.textContent = user.userId || '-';
  if (profileDisplayName) profileDisplayName.textContent = user.displayName || '-';
  if (profileFullName) profileFullName.textContent = debtor?.fullName || user.displayName || '-';
  if (profilePhone) profilePhone.textContent = debtor?.phone || '-';
  if (profileIdCard) profileIdCard.textContent = debtor?.idCardNumber || '-';
  if (profileRegisteredAt) profileRegisteredAt.textContent = debtor?.registeredAt || '-';
}
