/**
 * CacheService - Client-side caching for API responses
 * 
 * Reduces network requests by storing API responses locally with timestamps.
 * Implements time-based cache expiry and manual invalidation.
 * Supports offline mode - returns stale cache immediately when disconnected.
 * 
 * Usage:
 *   const data = await CacheService.getData('user_profile', fetchFunction, { maxAge: 30*60*1000 });
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

class CacheService {
  constructor() {
    this.prefix = 'cache_';
    this.metadataKey = 'cache_metadata';
    this.isConnected = true;
    
    // Monitor network status
    this.initNetworkMonitoring();
  }

  /**
   * Initialize network connectivity monitoring
   * @private
   */
  initNetworkMonitoring() {
    NetInfo.addEventListener(state => {
      this.isConnected = state.isConnected && state.isInternetReachable !== false;
      if (!this.isConnected) {
        console.log('[Cache] 📡 Device is offline - using cached data only');
      }
    });
  }

  /**
   * Get data with caching logic
   * @param {string} key - Unique cache key (e.g., 'user_profile', 'meals_today')
   * @param {function} fetchFunction - Async function that fetches from API
   * @param {object} options - Configuration options
   * @param {number} options.maxAge - Max age in milliseconds (default: 5 minutes)
   * @param {boolean} options.forceRefresh - Skip cache and fetch fresh data
   * @param {boolean} options.allowStale - Return stale cache on error
   * @returns {Promise<any>} - The cached or fresh data
   */
  async getData(key, fetchFunction, options = {}) {
    const { 
      maxAge = 5 * 60 * 1000, // Default: 5 minutes
      forceRefresh = false,
      allowStale = true
    } = options;

    try {
      // Step 1: Check if we have cached data
      const cached = await this.get(key);
      
      // Step 2: If offline and cache exists (even if stale), return it immediately
      if (!this.isConnected && cached) {
        const cacheAge = Date.now() - new Date(cached.lastFetched).getTime();
        console.log(`[Cache] 📡 Offline mode: using cached data for "${key}" (age: ${Math.round(cacheAge/1000)}s)`);
        return cached.data;
      }

      // Step 3: Handle force refresh
      if (forceRefresh) {
        console.log(`[Cache] 🔄 Force refresh for "${key}"`);
        return await this.fetchAndCache(key, fetchFunction, allowStale);
      }
      
      if (!cached) {
        console.log(`[Cache] ❌ No cache found for "${key}"`);
        return await this.fetchAndCache(key, fetchFunction, allowStale);
      }

      const { data, lastFetched, lastUpdated } = cached;
      const now = Date.now();
      const cacheAge = now - new Date(lastFetched).getTime();

      // Step 4: Check if cache is still fresh (time-based)
      if (cacheAge < maxAge) {
        console.log(`[Cache] ✅ Fresh cache hit for "${key}" (age: ${Math.round(cacheAge/1000)}s)`);
        return data;
      }

      // Step 5: Cache is stale, fetch fresh data
      console.log(`[Cache] ⚠️  Stale cache for "${key}" (age: ${Math.round(cacheAge/1000)}s), fetching fresh...`);
      return await this.fetchAndCache(key, fetchFunction, allowStale);

    } catch (error) {
      console.error(`[Cache] ❌ Error for "${key}":`, error.message);
      
      // On error, try to return stale cache if allowed
      if (allowStale) {
        try {
          const staleCache = await this.get(key);
          if (staleCache) {
            console.log(`[Cache] ⚠️  Returning stale cache for "${key}" due to error`);
            return staleCache.data;
          }
        } catch (e) {
          console.error(`[Cache] ❌ Could not retrieve stale cache:`, e.message);
        }
      }
      
      throw error;
    }
  }

  /**
   * Fetch data from API and save to cache
   * @private
   */
  async fetchAndCache(key, fetchFunction, allowStale = true) {
    try {
      const response = await fetchFunction();
      
      // Handle different response formats
      let data, updatedAt;
      
      if (response && typeof response === 'object') {
        // If response has explicit data and updated_at fields
        if ('data' in response && 'updated_at' in response) {
          data = response.data;
          updatedAt = response.updated_at;
        }
        // If response has updated_at or updatedAt
        else if ('updated_at' in response || 'updatedAt' in response) {
          const { updated_at, updatedAt: updatedAtCamel, ...rest } = response;
          data = rest;
          updatedAt = updated_at || updatedAtCamel;
        }
        // Otherwise, use the whole response as data
        else {
          data = response;
          updatedAt = new Date().toISOString();
        }
      } else {
        data = response;
        updatedAt = new Date().toISOString();
      }

      await this.save(key, data, updatedAt);
      console.log(`[Cache] 💾 Cached fresh data for "${key}"`);
      return data;

    } catch (error) {
      console.error(`[Cache] ❌ Fetch error for "${key}":`, error.message);
      
      // On fetch error, try to return stale cache if allowed
      if (allowStale) {
        try {
          const staleCache = await this.get(key);
          if (staleCache) {
            console.log(`[Cache] ⚠️  Returning stale cache for "${key}" due to fetch error`);
            return staleCache.data;
          }
        } catch (e) {
          console.error(`[Cache] ❌ Could not retrieve stale cache:`, e.message);
        }
      }
      
      throw error;
    }
  }

  /**
   * Get cached item
   * @private
   */
  async get(key) {
    try {
      const cached = await AsyncStorage.getItem(`${this.prefix}${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error(`[Cache] ❌ Error reading cache for "${key}":`, error.message);
      return null;
    }
  }

  /**
   * Save data to cache with timestamps
   * @private
   */
  async save(key, data, updatedAt) {
    try {
      const cacheData = {
        data,
        lastFetched: new Date().toISOString(),
        lastUpdated: updatedAt || new Date().toISOString(),
        key
      };

      await AsyncStorage.setItem(`${this.prefix}${key}`, JSON.stringify(cacheData));
      
      // Update metadata
      await this.updateMetadata(key, cacheData);
      
    } catch (error) {
      console.error(`[Cache] ❌ Error saving cache for "${key}":`, error.message);
      throw error;
    }
  }

  /**
   * Update cache metadata (for tracking and debugging)
   * @private
   */
  async updateMetadata(key, cacheData) {
    try {
      const metadata = await this.getMetadata();
      metadata[key] = {
        lastFetched: cacheData.lastFetched,
        lastUpdated: cacheData.lastUpdated,
        size: JSON.stringify(cacheData.data).length
      };
      await AsyncStorage.setItem(this.metadataKey, JSON.stringify(metadata));
    } catch (error) {
      // Metadata is not critical, just log error
      console.warn(`[Cache] ⚠️  Could not update metadata:`, error.message);
    }
  }

  /**
   * Get cache metadata
   * @private
   */
  async getMetadata() {
    try {
      const metadata = await AsyncStorage.getItem(this.metadataKey);
      return metadata ? JSON.parse(metadata) : {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Invalidate (delete) specific cached item
   * @param {string} key - Cache key to invalidate
   */
  async invalidate(key) {
    try {
      await AsyncStorage.removeItem(`${this.prefix}${key}`);
      console.log(`[Cache] 🗑️  Invalidated "${key}"`);
      
      // Update metadata
      const metadata = await this.getMetadata();
      delete metadata[key];
      await AsyncStorage.setItem(this.metadataKey, JSON.stringify(metadata));
      
    } catch (error) {
      console.error(`[Cache] ❌ Error invalidating "${key}":`, error.message);
    }
  }

  /**
   * Invalidate multiple cache keys
   * @param {string[]} keys - Array of cache keys to invalidate
   */
  async invalidateMultiple(keys) {
    console.log(`[Cache] 🗑️  Invalidating ${keys.length} cache entries...`);
    await Promise.all(keys.map(key => this.invalidate(key)));
  }

  /**
   * Invalidate all caches matching a pattern
   * @param {RegExp|string} pattern - Pattern to match cache keys
   */
  async invalidatePattern(pattern) {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.prefix));
      
      const regex = typeof pattern === 'string' 
        ? new RegExp(pattern) 
        : pattern;
      
      const keysToInvalidate = cacheKeys
        .map(key => key.replace(this.prefix, ''))
        .filter(key => regex.test(key));
      
      console.log(`[Cache] 🗑️  Invalidating ${keysToInvalidate.length} entries matching pattern: ${pattern}`);
      await this.invalidateMultiple(keysToInvalidate);
      
    } catch (error) {
      console.error(`[Cache] ❌ Error invalidating pattern "${pattern}":`, error.message);
    }
  }

  /**
   * Clear all cached items
   */
  async clearAll() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.prefix));
      
      await AsyncStorage.multiRemove(cacheKeys);
      await AsyncStorage.removeItem(this.metadataKey);
      
      console.log(`[Cache] 🗑️  Cleared ${cacheKeys.length} cached items`);
    } catch (error) {
      console.error(`[Cache] ❌ Error clearing all cache:`, error.message);
    }
  }

  /**
   * Get cache statistics for debugging
   * @returns {Promise<object>} Cache statistics
   */
  async getStats() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.prefix));
      
      const stats = {
        totalEntries: cacheKeys.length,
        totalSize: 0,
        entries: []
      };

      for (const fullKey of cacheKeys) {
        try {
          const cached = await AsyncStorage.getItem(fullKey);
          if (cached) {
            const parsedCache = JSON.parse(cached);
            const key = fullKey.replace(this.prefix, '');
            const size = cached.length;
            const age = Date.now() - new Date(parsedCache.lastFetched).getTime();
            
            stats.totalSize += size;
            stats.entries.push({
              key,
              lastFetched: parsedCache.lastFetched,
              lastUpdated: parsedCache.lastUpdated,
              ageSeconds: Math.round(age / 1000),
              ageMinutes: Math.round(age / 60000),
              sizeBytes: size,
              sizeKB: Math.round(size / 1024 * 10) / 10
            });
          }
        } catch (e) {
          // Skip invalid entries
        }
      }

      // Sort by age (newest first)
      stats.entries.sort((a, b) => 
        new Date(b.lastFetched).getTime() - new Date(a.lastFetched).getTime()
      );

      stats.totalSizeKB = Math.round(stats.totalSize / 1024 * 10) / 10;
      stats.totalSizeMB = Math.round(stats.totalSize / 1024 / 1024 * 100) / 100;

      return stats;
    } catch (error) {
      console.error(`[Cache] ❌ Error getting stats:`, error.message);
      return { totalEntries: 0, totalSize: 0, entries: [] };
    }
  }

  /**
   * Print cache info to console (for debugging)
   */
  async logStats() {
    const stats = await this.getStats();
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 CACHE STATISTICS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total Entries: ${stats.totalEntries}`);
    console.log(`Total Size: ${stats.totalSizeKB} KB (${stats.totalSizeMB} MB)`);
    console.log('───────────────────────────────────────────────────────');
    
    if (stats.entries.length > 0) {
      console.log('\nCached Entries:');
      stats.entries.forEach((entry, index) => {
        console.log(`\n${index + 1}. ${entry.key}`);
        console.log(`   Age: ${entry.ageMinutes}m ${entry.ageSeconds % 60}s`);
        console.log(`   Size: ${entry.sizeKB} KB`);
        console.log(`   Last Fetched: ${new Date(entry.lastFetched).toLocaleString()}`);
      });
    } else {
      console.log('\nNo cached entries found.');
    }
    
    console.log('\n═══════════════════════════════════════════════════════\n');
    
    return stats;
  }

  /**
   * Check if a cache key exists and is fresh
   * @param {string} key - Cache key to check
   * @param {number} maxAge - Max age in milliseconds
   * @returns {Promise<boolean>} True if cache exists and is fresh
   */
  async isFresh(key, maxAge = 5 * 60 * 1000) {
    try {
      const cached = await this.get(key);
      if (!cached) return false;
      
      const age = Date.now() - new Date(cached.lastFetched).getTime();
      return age < maxAge;
    } catch (error) {
      return false;
    }
  }

  /**
   * Preload multiple cache entries (useful on app startup)
   * @param {Array<object>} entries - Array of {key, fetchFunction, maxAge}
   */
  async preload(entries) {
    console.log(`[Cache] 🚀 Preloading ${entries.length} cache entries...`);
    
    const results = await Promise.allSettled(
      entries.map(({ key, fetchFunction, maxAge }) => 
        this.getData(key, fetchFunction, { maxAge })
      )
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`[Cache] ✅ Preload complete: ${successful} successful, ${failed} failed`);
    
    return results;
  }
}

// Export singleton instance
export default new CacheService();
