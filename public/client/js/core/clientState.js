/**
 * Client Portal Central State & Pub/Sub EventBus
 * Implements Stale-While-Revalidate (SWR) LocalStorage caching for 0ms loads
 * Supports Multi-Contract Debt Management
 */

export const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394A3B8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z'/></svg>";

export const store = {
  currentUser: {
    userId: 'U_GUEST',
    displayName: 'ผู้ใช้งานทั่วไป',
    pictureUrl: DEFAULT_AVATAR
  },
  clientData: {
    debtor: null,
    activeDebt: null,
    debts: [],
    totalRemainingAll: 0,
    totalContractsCount: 0,
    activeContractsCount: 0,
    payments: []
  },
  selectedDebtId: null,
  currentSlipBase64: null,

  setCurrentUser(user) {
    this.currentUser = { ...this.currentUser, ...user };
    eventBus.emit('user:updated', this.currentUser);
  },

  setClientData(data) {
    this.clientData = data || { debtor: null, activeDebt: null, debts: [], payments: [] };
    
    // Automatically select a debt if none selected or if selected is no longer valid
    const allDebts = this.clientData.debts || [];
    if (!this.selectedDebtId || (this.selectedDebtId !== 'ALL' && !allDebts.some(d => d.debtId === this.selectedDebtId))) {
      if (allDebts.length > 1) {
        this.selectedDebtId = 'ALL';
      } else if (allDebts.length === 1) {
        this.selectedDebtId = allDebts[0].debtId;
      } else if (this.clientData.activeDebt) {
        this.selectedDebtId = this.clientData.activeDebt.debtId;
      } else {
        this.selectedDebtId = null;
      }
    }

    eventBus.emit('data:updated', this.clientData);
  },

  setSelectedDebtId(debtId) {
    this.selectedDebtId = debtId;
    eventBus.emit('debt:selected', this.getSelectedDebt());
  },

  getSelectedDebt() {
    const allDebts = this.clientData.debts || [];
    if (this.selectedDebtId && this.selectedDebtId !== 'ALL') {
      const found = allDebts.find(d => d.debtId === this.selectedDebtId);
      if (found) return found;
    }
    return this.clientData.activeDebt || (allDebts.length > 0 ? allDebts[0] : null);
  },

  isViewingAllDebts() {
    return this.selectedDebtId === 'ALL';
  },

  setSlipBase64(base64) {
    this.currentSlipBase64 = base64;
    eventBus.emit('slip:selected', this.currentSlipBase64);
  }
};

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in event listener for "${event}":`, err);
        }
      });
    }
  }
}

export const eventBus = new EventBus();

// LocalStorage SWR Caching
export function loadCachedData(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`client_cache_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Cache read notice:', e);
  }
  return null;
}

export function saveCachedData(userId, data) {
  if (!userId || !data) return;
  try {
    localStorage.setItem(`client_cache_${userId}`, JSON.stringify(data));
  } catch (e) {
    console.warn('Cache write notice:', e);
  }
}

export function clearCachedData(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(`client_cache_${userId}`);
  } catch (e) {}
}
