/**
 * LINE Debt Management Admin Portal - Modular Enterprise Architecture v7.0
 * Application Orchestrator & Entry Point
 */

import { router } from './core/router.js';
import { initAdminAuth, logout } from './core/auth.js';
import { showToast } from './core/api.js';

import * as overviewModule from './modules/overviewModule.js';
import * as contractsModule from './modules/contractsModule.js';
import * as newContractModule from './modules/newContractModule.js';
import * as slipsModule from './modules/slipsModule.js';
import * as debtorsModule from './modules/debtorsModule.js';
import * as remindersModule from './modules/remindersModule.js';
import * as managersModule from './modules/managersModule.js';
import * as auditModule from './modules/auditModule.js';
import { initAssignReminderModal } from './modules/assignReminderModal.js';

// ==============================================================================
// 1. Route Registry (Deep-Linking & Sub-view Management)
// ==============================================================================
router.register('#/overview', (params) => overviewModule.mount(params));
router.register('#/contracts', (params) => contractsModule.mount(params.debtorId));
router.register('#/contracts/new', (params) => newContractModule.mount(params.debtorId));
router.register('#/slips', (params) => slipsModule.mount(params.status));
router.register('#/debtors', (params) => debtorsModule.mount(params));
router.register('#/reminders', (params) => remindersModule.mount(params));
router.register('#/managers', (params) => managersModule.mount(params));
router.register('#/audit', (params) => auditModule.mount(params));

// ==============================================================================
// 2. Global UI Shell Event Listeners
// ==============================================================================
function initShellListeners() {
  // Sidebar navigation clicks
  const sidebarNavItems = document.querySelectorAll('.sidebar-nav-item');
  const routeMap = {
    'view-admin-overview': '#/overview',
    'view-admin-new-contract': '#/contracts/new',
    'view-admin-contracts': '#/contracts',
    'view-admin-slips': '#/slips',
    'view-admin-debtors': '#/debtors',
    'view-admin-reminders': '#/reminders',
    'view-admin-managers': '#/managers',
    'view-admin-audit': '#/audit'
  };

  sidebarNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      const route = routeMap[target] || '#/overview';
      router.navigate(route);
    });
  });

  // Mobile sidebar toggle
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const adminSidebar = document.getElementById('adminSidebar');
  if (btnToggleSidebar && adminSidebar) {
    btnToggleSidebar.addEventListener('click', () => {
      adminSidebar.classList.toggle('open');
    });
  }

  // Theme Toggle (Dark / Light)
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const themeToggleIcon = document.getElementById('themeToggleIcon');
  const themeToggleText = document.getElementById('themeToggleText');

  const currentTheme = localStorage.getItem('debt_admin_theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeUI(currentTheme);

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('debt_admin_theme', newTheme);
      updateThemeUI(newTheme);
      showToast(`สลับเป็น ${newTheme === 'dark' ? 'โหมดมืด (Dark)' : 'โหมดสว่าง (Light)'} เรียบร้อย`, '🎨');
    });
  }

  function updateThemeUI(theme) {
    if (themeToggleIcon) themeToggleIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (themeToggleText) themeToggleText.textContent = theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด';
  }

  // Logout Buttons
  const btnLogout = document.getElementById('btnLogout');
  const btnSwitchAccount = document.getElementById('btnSwitchAccount');
  const btnLogoutSidebar = document.getElementById('btnLogoutSidebar');

  if (btnLogout) btnLogout.addEventListener('click', logout);
  if (btnSwitchAccount) btnSwitchAccount.addEventListener('click', logout);
  if (btnLogoutSidebar) btnLogoutSidebar.addEventListener('click', logout);

  // Initialize shared modals
  initAssignReminderModal();
}

// ==============================================================================
// 3. Application Bootstrap
// ==============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initShellListeners();

  // ตรวจสอบสิทธิ์ผู้ดูแลระบบ
  const isAuthorized = await initAdminAuth();

  if (isAuthorized) {
    // เริ่มต้นระบบ Routing ตาม Hash URL
    router.init();
  }
});
