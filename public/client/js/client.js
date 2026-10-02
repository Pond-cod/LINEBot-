/**
 * Client Portal Main Orchestrator & Bootstrap Entrypoint (v7.0 Modular ES)
 * Coordinates HashRouter, LIFF Auth, SWR Caching, and Sub-views
 */

import { store, eventBus, loadCachedData, saveCachedData } from './core/clientState.js';
import { fetchClientProfileApi, showToast } from './core/clientApi.js';
import { initLiffAuth } from './core/clientAuth.js';
import { clientRouter } from './core/clientRouter.js';

import { initDashboardView } from './views/dashboardView.js';
import { initPayView } from './views/payView.js';
import { initHistoryView } from './views/historyView.js';
import { initProfileView } from './views/profileView.js';

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
    console.error('Failed to revalidate client data:', err);
    if (!store.clientData.activeDebt && !store.clientData.debtor) {
      showToast('ไม่สามารถดึงข้อมูลได้', '⚠️');
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
  const shouldProceed = await initLiffAuth();
  if (shouldProceed) {
    await loadClientData();
  }
});
