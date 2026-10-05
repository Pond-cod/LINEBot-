/**
 * Client Portal Hash Router
 * Supports deep-linking, browser history (Back/Forward), and active bottom nav highlighting
 */

import { eventBus } from './clientState.js';

export const ROUTE_MAP = {
  '#/dashboard': 'view-dashboard',
  '#/contracts': 'view-contracts',
  '#/pay': 'view-pay',
  '#/history': 'view-history',
  '#/profile': 'view-profile'
};

const REVERSE_ROUTE_MAP = {
  'view-dashboard': '#/dashboard',
  'view-contracts': '#/contracts',
  'view-pay': '#/pay',
  'view-history': '#/history',
  'view-profile': '#/profile'
};

export class ClientRouter {
  constructor() {
    this.currentRoute = '#/dashboard';
    this.subViews = document.querySelectorAll('.sub-view');
    this.navItems = document.querySelectorAll('.bottom-nav .nav-item');
    this.viewport = document.querySelector('.views-viewport');
  }

  init() {
    // 1. Listen for hashchange
    window.addEventListener('hashchange', () => this.handleHashChange());

    // 2. Bind bottom navigation click events
    this.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetViewId = item.getAttribute('data-target');
        const hash = REVERSE_ROUTE_MAP[targetViewId] || '#/dashboard';
        window.location.hash = hash;
      });
    });

    // 3. Expose legacy switchView for inline onclicks
    window.switchView = (targetViewId) => {
      const hash = REVERSE_ROUTE_MAP[targetViewId] || (targetViewId.startsWith('#') ? targetViewId : '#/' + targetViewId);
      window.location.hash = hash;
    };

    // 4. Initial route resolution
    if (!window.location.hash || !ROUTE_MAP[window.location.hash]) {
      window.location.hash = '#/dashboard';
    } else {
      this.handleHashChange();
    }
  }

  handleHashChange() {
    let hash = window.location.hash || '#/dashboard';
    // Clean query params if any
    const pureHash = hash.split('?')[0];
    const targetViewId = ROUTE_MAP[pureHash] || 'view-dashboard';

    this.currentRoute = pureHash;

    // Toggle sub-views
    this.subViews.forEach(view => {
      if (view.id === targetViewId) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Toggle bottom navigation active state
    this.navItems.forEach(item => {
      if (item.getAttribute('data-target') === targetViewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Scroll viewport to top smoothly
    if (this.viewport) {
      this.viewport.scrollTop = 0;
    }

    eventBus.emit('route:changed', { hash: pureHash, viewId: targetViewId });
  }

  navigateTo(hash) {
    window.location.hash = hash;
  }
}

export const clientRouter = new ClientRouter();
