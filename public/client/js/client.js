/**
 * Client Portal Main Orchestrator & Bootstrap Entrypoint (v7.2 Modular ES)
 * Coordinates HashRouter, LIFF Auth, SWR Caching, and Sub-views
 */

import { store, eventBus, loadCachedData, saveCachedData } from './core/clientState.js?v=7.2';
import { fetchClientProfileApi, showToast } from './core/clientApi.js?v=7.2';
import { initLiffAuth } from './core/clientAuth.js?v=7.2';
import { clientRouter } from './core/clientRouter.js?v=7.2';

import { initDashboardView } from './views/dashboardView.js?v=7.2';
import { initPayView } from './views/payView.js?v=7.2';
import { initHistoryView } from './views/historyView.js?v=7.2';
import { initProfileView } from './views/profileView.js?v=7.2';

/**
 * 1. Data Loading with Stale-While-Revalidate (SWR) (0ms instant render)
 */
export async function loadClientData() {
  const userId = store.currentUser.userId;
  if (!userId) return;

  // 1. Instant Cache Render
  const cached = loadCachedData(userId);
  if (cached) {
    store.setClientData(cached);
  }

  // 2. Background Network Revalidation
  try {
    const json = await fetchClientProfileApi(userId, store.currentUser.displayName);
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
  initPayView();
  initHistoryView();
  initProfileView();

  // 2. Initialize Hash Router
  clientRouter.init();

  // 3. Re-fetch client data when a slip is submitted
  eventBus.on('slip:submitted', () => {
    loadClientData();
  });

  // 4. Initialize Auth & LIFF
  try {
    await initLiffAuth();
  } catch (authErr) {
    console.warn('Auth init caught exception:', authErr);
  }

  // 5. Always load client data
  await loadClientData();
});
