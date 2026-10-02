/**
 * Client-Side Hash Router with Deep-Linking & Query Param Support
 * Controls sub-view switching, URL synchronization, and browser history (Back/Forward).
 */

const viewTitleMap = {
  'view-admin-overview': 'ภาพรวม & สถิติ',
  'view-admin-new-contract': 'สร้างสัญญาหนี้ใหม่',
  'view-admin-contracts': 'จัดการสัญญาหนี้',
  'view-admin-slips': 'ตรวจสอบสลิปโอนเงิน',
  'view-admin-debtors': 'สมุดรายชื่อลูกหนี้',
  'view-admin-reminders': 'ระบบแจ้งเตือนอัตโนมัติ',
  'view-admin-managers': 'จัดการทีมแอดมิน',
  'view-admin-audit': 'บันทึกประวัติระบบ (Audit Trail)'
};

const routeToViewMap = {
  '#/overview': 'view-admin-overview',
  '#/contracts/new': 'view-admin-new-contract',
  '#/contracts': 'view-admin-contracts',
  '#/slips': 'view-admin-slips',
  '#/debtors': 'view-admin-debtors',
  '#/reminders': 'view-admin-reminders',
  '#/managers': 'view-admin-managers',
  '#/audit': 'view-admin-audit'
};

const viewToRouteMap = {
  'view-admin-overview': '#/overview',
  'view-admin-new-contract': '#/contracts/new',
  'view-admin-contracts': '#/contracts',
  'view-admin-slips': '#/slips',
  'view-admin-debtors': '#/debtors',
  'view-admin-reminders': '#/reminders',
  'view-admin-managers': '#/managers',
  'view-admin-audit': '#/audit'
};

class HashRouter {
  constructor() {
    this.routes = new Map();
    this.currentRoute = '';
    this.currentParams = {};

    window.addEventListener('hashchange', () => this.handleRouteChange());
  }

  register(path, handler) {
    this.routes.set(path, handler);
  }

  navigate(path, params = {}) {
    let url = path;
    const queryParts = [];
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
      }
    });

    if (queryParts.length > 0) {
      url += '?' + queryParts.join('&');
    }

    if (window.location.hash === url) {
      this.handleRouteChange();
    } else {
      window.location.hash = url;
    }
  }

  parseHash() {
    const raw = window.location.hash || '#/overview';
    const [pathPart, queryPart] = raw.split('?');
    const params = {};

    if (queryPart) {
      queryPart.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }

    return { path: pathPart || '#/overview', params };
  }

  handleRouteChange() {
    const { path, params } = this.parseHash();
    this.currentRoute = path;
    this.currentParams = params;

    const targetViewId = routeToViewMap[path] || 'view-admin-overview';

    // 1. สลับ CSS Active Class ของ Sub-views
    const subViews = document.querySelectorAll('.sub-view');
    subViews.forEach(v => {
      if (v.id === targetViewId) {
        v.classList.add('active');
      } else {
        v.classList.remove('active');
      }
    });

    // 2. อัปเดต Sidebar Navigation Active State
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    navItems.forEach(item => {
      if (item.getAttribute('data-target') === targetViewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // 3. อัปเดต Title บน Topbar
    const topbarTitle = document.getElementById('topbarCurrentViewTitle');
    if (topbarTitle) {
      topbarTitle.textContent = viewTitleMap[targetViewId] || 'Admin Hub';
    }

    // 4. เลื่อน Scroll กลับขึ้นบนสุด
    const viewport = document.querySelector('.views-viewport');
    if (viewport) viewport.scrollTop = 0;

    // 5. ปิด Mobile Sidebar หากเปิดอยู่
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar) sidebar.classList.remove('open');

    // 6. เรียก handler ของโมดูลที่ลงทะเบียนไว้
    if (this.routes.has(path)) {
      const handler = this.routes.get(path);
      try {
        handler(params);
      } catch (err) {
        console.error(`Error executing route handler for ${path}:`, err);
      }
    } else {
      // Fallback: หาก path ไม่ตรง ให้ไปที่ overview
      const overviewHandler = this.routes.get('#/overview');
      if (overviewHandler) overviewHandler(params);
    }
  }

  init() {
    if (!window.location.hash) {
      window.location.hash = '#/overview';
    } else {
      this.handleRouteChange();
    }
  }
}

export const router = new HashRouter();

// Helper switchView สำหรับรองรับโค้ด HTML เก่าที่เรียก switchView('view-admin-...')
window.switchView = function(viewId, params = {}) {
  const route = viewToRouteMap[viewId] || '#/overview';
  router.navigate(route, params);
};
