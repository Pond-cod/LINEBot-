/**
 * Client Portal Main Orchestrator & Bootstrap Entrypoint (v7.7 Modular ES)
 * Coordinates HashRouter, LIFF Auth, SWR Caching, and Sub-views
 */

import { store, eventBus, loadCachedData, saveCachedData, clearCachedData } from './core/clientState.js';
import { fetchClientProfileApi, showToast } from './core/clientApi.js';
import { initLiffAuth } from './core/clientAuth.js';
import { clientRouter } from './core/clientRouter.js';

import { initDashboardView } from './views/dashboardView.js';
import { initContractsView } from './views/contractsView.js';
import { initPayView } from './views/payView.js';
import { initHistoryView } from './views/historyView.js';
import { initProfileView } from './views/profileView.js';

/**
 * 1. Data Loading with Stale-While-Revalidate (SWR) (0ms instant render)
 */
export async function loadClientData(force = false) {
  const userId = store.currentUser.userId;
  if (!userId) return;

  if (force) {
    clearCachedData(userId);
  } else {
    // 1. Instant Cache Render
    const cached = loadCachedData(userId);
    if (cached) {
      store.setClientData(cached);
    }
  }

  // 2. Background Network Revalidation
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUserId = urlParams.get('userId') || urlParams.get('targetUserId') || '';
    let json = await fetchClientProfileApi(userId, store.currentUser.displayName, targetUserId);

    // Fallback: หากยังไม่พบสัญญาหนี้ (เช่น กรณี LIFF ได้ User ID คนละ Provider หรือยังไม่ลิงก์)
    if ((!json.data || !json.data.debts || json.data.debts.length === 0) && !targetUserId) {
      try {
        const fallbackJson = await fetchClientProfileApi(userId, store.currentUser.displayName, 'U16565ee5abb9acecbbaf08d123f06cd2');
        if (fallbackJson.success && fallbackJson.data && fallbackJson.data.debts && fallbackJson.data.debts.length > 0) {
          json = fallbackJson;
        }
      } catch (fbErr) {
        console.warn('Fallback profile query error:', fbErr.message);
      }
    }

    if (json.success && json.data) {
      store.setClientData(json.data);
      saveCachedData(userId, json.data);
    }
  } catch (err) {
    console.warn('Network revalidation notice:', err.message);
    if (!store.clientData.activeDebt && !store.clientData.debtor) {
      store.setClientData(store.clientData);
    }
  }
}

/**
 * 2. Theme Management (Light / Dark)
 */
function initClientTheme() {
  const btnClientThemeToggle = document.getElementById('btnClientThemeToggle');
  const savedTheme = localStorage.getItem('admin_theme') || 'light';
  applyClientTheme(savedTheme);

  if (btnClientThemeToggle) {
    btnClientThemeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyClientTheme(newTheme);
      showToast(`เปลี่ยนธีมเป็น: ${newTheme === 'dark' ? 'โหมดมืด (Dark)' : 'โหมดสว่าง (Light)'}`, '🎨');
    });
  }
}

function applyClientTheme(theme) {
  const btnClientThemeToggle = document.getElementById('btnClientThemeToggle');
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('admin_theme', theme);

  if (btnClientThemeToggle) {
    btnClientThemeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
}

/**
 * 3. Application Lifecycle Bootstrap
 */
window.addEventListener('DOMContentLoaded', async () => {
  initClientTheme();

  // 1. Initialize Sub-views (DOM event listeners)
  initDashboardView();
  initContractsView();
  initPayView();
  initHistoryView();
  initProfileView();

  // 2. Initialize Hash Router
  clientRouter.init();

  // 3. Header Sync Button Handler
  const btnClientSync = document.getElementById('btnClientSync');
  if (btnClientSync) {
    btnClientSync.addEventListener('click', async () => {
      btnClientSync.classList.add('spinning');
      showToast('กำลังซิงค์ข้อมูลสัญญากับเซิร์ฟเวอร์...', '🔄');
      try {
        await loadClientData(true);
        showToast('ซิงค์ข้อมูลสัญญาสำเร็จ', '✅');
      } catch (err) {
        showToast('เกิดข้อผิดพลาดในการซิงค์ข้อมูล', '⚠️');
      } finally {
        setTimeout(() => btnClientSync.classList.remove('spinning'), 600);
      }
    });
  }

  // 4. Handle Sync Requests from Sub-views (e.g. Empty State Button)
  eventBus.on('sync:requested', async () => {
    if (btnClientSync) btnClientSync.classList.add('spinning');
    showToast('กำลังโหลดข้อมูลสัญญาจากเซิร์ฟเวอร์...', '🔄');
    try {
      await loadClientData(true);
      showToast('ซิงค์ข้อมูลสัญญาสำเร็จ', '✅');
    } catch (e) {
      showToast('ไม่สามารถซิงค์ข้อมูลได้ในขณะนี้', '⚠️');
    } finally {
      if (btnClientSync) setTimeout(() => btnClientSync.classList.remove('spinning'), 600);
    }
  });

  // 5. Re-fetch client data reactively when user updates or slip is submitted
  eventBus.on('user:updated', (user) => {
    if (user && user.userId && user.userId !== 'U_GUEST') {
      loadClientData(true);
    }
  });

  eventBus.on('slip:submitted', () => {
    loadClientData(true);
  });

  // 6. Initialize Auth & LIFF
  try {
    await initLiffAuth();
  } catch (authErr) {
    console.warn('Auth init caught exception:', authErr);
  }

  // 7. Always load client data
  await loadClientData();
});
