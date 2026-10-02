/**
 * High-Speed In-Memory TTL Cache Engine
 * Provides ultra-fast caching (<1ms response time) with automatic expiration and pattern invalidation.
 */

class MemoryCache {
  constructor(defaultTtlSeconds = 30) {
    this.cache = new Map();
    this.defaultTtl = defaultTtlSeconds * 1000;
  }

  set(key, value, ttlSeconds = null) {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl;
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
    return value;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  del(key) {
    return this.cache.delete(key);
  }

  invalidate(pattern) {
    if (typeof pattern === 'string') {
      return this.del(pattern);
    }
    if (pattern instanceof RegExp) {
      let count = 0;
      for (const key of this.cache.keys()) {
        if (pattern.test(key)) {
          this.cache.delete(key);
          count++;
        }
      }
      return count;
    }
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Global cache instance
const cache = new MemoryCache(25); // Default 25 seconds TTL

module.exports = cache;
