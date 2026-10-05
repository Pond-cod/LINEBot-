/**
 * Shared Reactive State Store & Event Bus
 * Provides central data management for contracts, debtors, slips, profiles, and cross-module pub/sub.
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const filtered = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, filtered);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in event listener for "${event}":`, err);
      }
    });
  }
}

export const eventBus = new EventBus();

export const store = {
  contracts: [],
  debtors: [],
  slips: [],
  reminderProfiles: [],
  reminderSettings: null,
  admins: [],
  stats: null,
  activeDebtorId: '', // For contracts module selection-first flow

  setContracts(list) {
    this.contracts = list || [];
    const badge = document.getElementById('sidebarContractsBadge');
    if (badge) {
      badge.textContent = this.contracts.length;
    }
    eventBus.emit('contracts:updated', this.contracts);
  },

  setDebtors(list) {
    this.debtors = list || [];
    eventBus.emit('debtors:updated', this.debtors);
  },

  setSlips(list) {
    this.slips = list || [];
    const badge = document.getElementById('sidebarSlipsBadge');
    if (badge) {
      const pendingCount = this.slips.filter(s => s.verificationStatus === 'PENDING').length;
      badge.textContent = `${pendingCount} ใบ`;
      badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }
    eventBus.emit('slips:updated', this.slips);
  },

  setReminderProfiles(list) {
    this.reminderProfiles = list || [];
    eventBus.emit('profiles:updated', this.reminderProfiles);
  },

  setReminderSettings(settings) {
    this.reminderSettings = settings;
    eventBus.emit('settings:updated', this.reminderSettings);
  },

  setActiveDebtorId(userId) {
    this.activeDebtorId = userId || '';
    eventBus.emit('activeDebtor:changed', this.activeDebtorId);
  }
};
