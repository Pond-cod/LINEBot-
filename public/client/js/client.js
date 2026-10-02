/**
 * Client Portal Main Orchestrator & Bootstrap Entrypoint (v7.1 Modular ES)
 * Coordinates HashRouter, LIFF Auth, SWR Caching, and Sub-views
 */

import { store, eventBus, loadCachedData, saveCachedData } from './core/clientState.js?v=7.1';
import { fetchClientProfileApi, showToast } from './core/clientApi.js?v=7.1';
import { initLiffAuth } from './core/clientAuth.js?v=7.1';
import { clientRouter } from './core/clientRouter.js?v=7.1';

import { initDashboardView } from './views/dashboardView.js?v=7.1';
import { initPayView } from './views/payView.js?v=7.1';
import { initHistoryView } from './views/historyView.js?v=7.1';
import { initProfileView } from './views/profileView.js?v=7.1';

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
      // Ensure UI reflects empty/guest state gracefully
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

  // Initialize Sub-views
  initDashboardView();
  initPayView();
  initHistoryView();
  initProfileView();

  // Initialize Hash Router
  clientRouter.init();

  // Re-fetch client data when a slip is submitted
  eventBus.on('slip:submitted', () => {
    loadClientData();
  });

  // Initialize Auth & LIFF
  let shouldProceed = false;
  try {
    shouldProceed = await initLiffAuth();
  } catch (authErr) {
    console.warn('Auth init caught exception:', authErr);
  }

  // Always load client data so UI never stays stuck
  await loadClientData();
});
