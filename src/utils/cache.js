/**
 * High-Speed In-Memory TTL Cache Engine
 * Provides ultra-fast caching (<1ms response time) with automatic expiration,
 * pattern invalidation, and in-flight request deduplication (stampede protection).
 */

class MemoryCache {
  constructor(defaultTtlSeconds = 90) {
    this.cache = new Map();
    this.inFlight = new Map(); // stampede protection: reuse in-flight promises
    this.defaultTtl = defaultTtlSeconds * 1000;
  }

  set(key, value, ttlSeconds = null) {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl;
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
    this.inFlight.delete(key); // resolve any waiting callers
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
    this.inFlight.delete(key);
    return this.cache.delete(key);
  }

  /**
   * Stampede-safe fetch: if a promise for this key is already in-flight,
   * return the same promise instead of launching a duplicate request.
   * Usage: await cache.getOrFetch('key', () => expensiveAsyncFn(), ttlSeconds)
   */
  async getOrFetch(key, fetchFn, ttlSeconds = null) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const promise = fetchFn().then(result => {
      this.set(key, result, ttlSeconds);
      return result;
    }).catch(err => {
      this.inFlight.delete(key);
      throw err;
    });

    this.inFlight.set(key, promise);
    return promise;
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
          this.inFlight.delete(key);
          count++;
        }
      }
      return count;
    }
    return 0;
  }

  delByPattern(pattern) {
    return this.invalidate(pattern);
  }

  clear() {
    this.cache.clear();
    this.inFlight.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Global cache instance — TTL 90s (ข้อมูล Sheets เปลี่ยนบ่อยสุดทุก ~1 นาที)
const cache = new MemoryCache(90);

module.exports = cache;
