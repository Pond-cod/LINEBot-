/**
 * Client Portal Central State & Pub/Sub EventBus
 * Implements Stale-While-Revalidate (SWR) LocalStorage caching for 0ms loads
 * Supports Multi-Contract Debt Management
 */

export const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394A3B8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z'/></svg>";

/**
 * ฟังก์ชันเรียงลำดับสัญญา: สัญญาที่ยังไม่ชำระและถึงรอบชำระก่อนให้แสดงก่อนเสมอ
 */
export function sortDebtsByDueDate(debtsList) {
  if (!Array.isArray(debtsList)) return [];

  return [...debtsList].sort((a, b) => {
    const aRemain = Number(a.remainingBalance) || 0;
    const bRemain = Number(b.remainingBalance) || 0;
    const aActive = (a.debtStatus === 'ACTIVE' || a.debtStatus === 'OVERDUE') && aRemain > 0;
    const bActive = (b.debtStatus === 'ACTIVE' || b.debtStatus === 'OVERDUE') && bRemain > 0;

    // 1. สัญญาที่ยังต้องชำระ (Active/Overdue) ต้องมาก่อนสัญญาที่จ่ายครบแล้ว (PAID)
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    // 2. ถ้าทั้งคู่ยังต้องชำระ ให้เรียงตามวันครบกำหนดชำระ (dueDate) ที่ถึงรอบก่อน (น้อยไปมาก)
    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
    if (dateA !== dateB) {
      return dateA - dateB;
    }

    // 3. หากวันครบกำหนดตรงกัน ให้เรียงตามแถวล่าสุด
    return (b.rowIndex || 0) - (a.rowIndex || 0);
  });
}

const defaultStore = {
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
    if (data && Array.isArray(data.debts)) {
      data.debts = sortDebtsByDueDate(data.debts);
    }
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

// Global Singleton Guard to prevent duplicate instances across query string imports
const globalScope = typeof window !== 'undefined' ? window : globalThis;
if (!globalScope.__CLIENT_EVENT_BUS__) {
  globalScope.__CLIENT_EVENT_BUS__ = new EventBus();
}
export const eventBus = globalScope.__CLIENT_EVENT_BUS__;

if (!globalScope.__CLIENT_STORE__) {
  globalScope.__CLIENT_STORE__ = defaultStore;
}
export const store = globalScope.__CLIENT_STORE__;

const CACHE_VERSION = '7.9';

// LocalStorage SWR Caching
export function loadCachedData(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`client_cache_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Valid cache must have cacheVersion 7.8 and must have debts array
      if (parsed && typeof parsed === 'object' && parsed._cv === CACHE_VERSION && Array.isArray(parsed.debts) && parsed.debts.length > 0) {
        return parsed;
      } else {
        localStorage.removeItem(`client_cache_${userId}`);
      }
    }
  } catch (e) {
    console.warn('Cache read notice:', e);
  }
  return null;
}

export function saveCachedData(userId, data) {
  if (!userId || !data) return;
  // ไม่บันทึกทับด้วยข้อมูลสัญญาว่างเปล่า
  if (!Array.isArray(data.debts) || data.debts.length === 0) return;
  try {
    const toSave = { ...data, _cv: CACHE_VERSION };
    localStorage.setItem(`client_cache_${userId}`, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Cache write notice:', e);
  }
}

export function clearCachedData(userId) {
  if (!userId) {
    // Clear all client cache keys
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('client_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}
    return;
  }
  try {
    localStorage.removeItem(`client_cache_${userId}`);
  } catch (e) {}
}
