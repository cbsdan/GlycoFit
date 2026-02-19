# Caching Quick Reference

## Usage Patterns

### 1. Using Cached API Functions
```javascript
import api from '../services/api';

// Basic usage (auto-cached)
const meals = await api.getUserMeals('today');
const profile = await api.getProfile();

// Force fresh data (bypass cache)
const freshMeals = await api.getUserMeals('today', true);
const freshProfile = await api.getProfile(true);
```

### 2. Adding Cache to New API Endpoint

**Step 1**: Define cache config
```javascript
// In api.js CACHE_CONFIG object
const CACHE_CONFIG = {
  my_new_data: { maxAge: 10 * 60 * 1000 }, // 10 minutes
};
```

**Step 2**: Import CacheService
```javascript
import CacheService from './cacheService';
```

**Step 3**: Wrap your function
```javascript
// BEFORE (no cache)
export const getMyData = async () => {
  const response = await api.get('/my-endpoint');
  return response.data;
};

// AFTER (with cache)
const getMyDataUncached = async () => {
  const response = await api.get('/my-endpoint');
  return response.data;
};

export const getMyData = async (forceRefresh = false) => {
  return await CacheService.getData(
    'my_data',                      // Unique cache key
    () => getMyDataUncached(),      // Function to fetch fresh data
    { ...CACHE_CONFIG.my_new_data, forceRefresh }
  );
};
```

**Step 4**: Add cache invalidation to mutations
```javascript
export const updateMyData = async (data) => {
  const response = await api.put('/my-endpoint', data);
  
  // Invalidate cache after update
  await CacheService.invalidate('my_data');
  
  return response.data;
};
```

### 3. Dynamic Cache Keys (With Parameters)
```javascript
// For endpoints with parameters
const getMyDataUncached = async (id, days) => {
  const response = await api.get(`/my-endpoint/${id}?days=${days}`);
  return response.data;
};

export const getMyData = async (id, days = 7, forceRefresh = false) => {
  // Create unique key for each parameter combination
  const cacheKey = `my_data_${id}_${days}d`;
  
  return await CacheService.getData(
    cacheKey,
    () => getMyDataUncached(id, days),
    { ...CACHE_CONFIG.my_new_data, forceRefresh }
  );
};
```

### 4. Cache Invalidation Patterns

**Single cache**:
```javascript
await CacheService.invalidate('meals_today');
```

**Pattern matching** (all related caches):
```javascript
// Invalidate all meal caches (meals_today, meals_7days, etc.)
await CacheService.invalidatePattern(/^meals_/);

// Invalidate all step caches
await CacheService.invalidatePattern(/^step_/);

// Invalidate specific pattern
await CacheService.invalidatePattern(/^user_\d+_profile/);
```

**Clear all caches**:
```javascript
await CacheService.clearAll();
```

## Cache Duration Guidelines

| Data Type | Recommended Duration | Reason |
|-----------|---------------------|--------|
| **Real-time data** | 1-5 minutes | User activities, today's meals |
| **Frequently updated** | 5-10 minutes | Risk assessments, summaries |
| **User settings** | 30-60 minutes | Profile, health metrics |
| **Baseline/Reference** | 1-2 hours | Baselines (rarely change) |
| **Static lists** | 12-24 hours | Physicians, categories |

## CacheService API Reference

### Core Methods

#### `getData(key, fetchFunction, options)`
Get data from cache or fetch fresh
```javascript
const data = await CacheService.getData(
  'cache_key',                    // Unique identifier
  async () => { /* fetch logic */ }, // Function to fetch fresh data
  { 
    maxAge: 300000,               // 5 minutes in ms
    forceRefresh: false,          // Bypass cache
    returnStaleOnError: true      // Offline fallback
  }
);
```

#### `invalidate(key)`
Remove specific cache
```javascript
await CacheService.invalidate('meals_today');
```

#### `invalidatePattern(regexPattern)`
Remove caches matching pattern
```javascript
await CacheService.invalidatePattern(/^meals_/);
```

#### `clearAll()`
Remove all caches
```javascript
await CacheService.clearAll();
```

#### `getStats()`
Get cache statistics (debug)
```javascript
const stats = await CacheService.getStats();
console.log('Total keys:', stats.totalKeys);
console.log('All keys:', stats.keys);
```

## Common Patterns

### Pattern 1: List with Date Range
```javascript
const getUserMealsUncached = async (date) => {
  const response = await api.get('/meals', { params: { date } });
  return response.data;
};

export const getUserMeals = async (date, forceRefresh = false) => {
  // Different cache key for each date
  const cacheKey = `meals_${date}`;
  return await CacheService.getData(
    cacheKey,
    () => getUserMealsUncached(date),
    { ...CACHE_CONFIG.meals_history, forceRefresh }
  );
};

// Invalidate all meal caches when adding/updating
export const saveMeal = async (mealData) => {
  const response = await api.post('/meals', mealData);
  await CacheService.invalidatePattern(/^meals_/);
  return response.data;
};
```

### Pattern 2: User-Specific Data
```javascript
// Cache per user (for multi-user apps)
const cacheKey = `user_${userId}_profile`;

export const getUserProfile = async (userId, forceRefresh = false) => {
  return await CacheService.getData(
    `user_${userId}_profile`,
    () => fetchUserProfile(userId),
    { ...CACHE_CONFIG.profile, forceRefresh }
  );
};
```

### Pattern 3: Nested Data with Dependencies
```javascript
// Main data cached separately from summary
export const getMainData = async (forceRefresh = false) => {
  return await CacheService.getData('main_data', fetchMain, { maxAge: 600000, forceRefresh });
};

export const getDataSummary = async (forceRefresh = false) => {
  return await CacheService.getData('data_summary', fetchSummary, { maxAge: 300000, forceRefresh });
};

// Invalidate both when updating
export const updateData = async (data) => {
  const result = await api.put('/data', data);
  await CacheService.invalidate('main_data');
  await CacheService.invalidate('data_summary');
  return result.data;
};
```

## Testing Snippets

### Check Cache Status
```javascript
// In screen's useEffect
useEffect(() => {
  const checkCache = async () => {
    const stats = await CacheService.getStats();
    console.log('📊 Cache status:', stats);
  };
  checkCache();
}, []);
```

### Monitor Cache Hits/Misses
```javascript
// CacheService already logs to console:
// "CacheService: Cache HIT for meals_today"
// "CacheService: Cache MISS for meals_today (expired)"
// Check your console/logs
```

### Force Refresh on Pull-to-Refresh
```javascript
const onRefresh = async () => {
  setRefreshing(true);
  try {
    // Pass true to force fresh data
    await api.getUserMeals('today', true);
    await api.getProfile(true);
  } finally {
    setRefreshing(false);
  }
};
```

## Cache Key Naming Convention

Follow this pattern for consistency:

```
{entity}_{identifier}_{param}

Examples:
- meals_today
- meals_2025-01-15
- meals_7days
- step_summary_7d
- step_summary_30d
- food_assessment_7d
- user_123_profile
- physician_slots_456_all_all
```

## Performance Tips

1. **Use appropriate cache durations**: Longer = fewer requests, shorter = fresher data
2. **Invalidate broadly**: Use pattern matching to clear related caches
3. **Cache expensive operations**: Priority on complex calculations or large datasets
4. **Don't cache mutations**: Only cache GET requests
5. **Monitor cache size**: Use `getStats()` to check storage usage

## Troubleshooting

### "Cache not clearing after update"
✅ Check mutation function calls `invalidatePattern()`
```javascript
await CacheService.invalidatePattern(/^meals_/);
```

### "Data too stale"
✅ Reduce maxAge in CACHE_CONFIG
```javascript
meals_today: { maxAge: 2 * 60 * 1000 }, // 5min → 2min
```

### "Cache hit rate low"
✅ Check cache keys match between fetch and subsequent calls
✅ Ensure parameters create consistent cache keys

### "AsyncStorage quota exceeded"
✅ Call `clearAll()` periodically or on logout
✅ Reduce cache durations
✅ Avoid caching large blobs/images

## Integration Checklist

When adding caching to a screen:

- [ ] Identify all API calls in the screen
- [ ] Add cache config for each endpoint
- [ ] Wrap API functions with caching
- [ ] Add forceRefresh parameter
- [ ] Add cache invalidation to mutations
- [ ] Test cache hit (navigate away and back)
- [ ] Test cache invalidation (update data, verify refresh)
- [ ] Test force refresh (pull-to-refresh)
- [ ] Test offline fallback (airplane mode)

---

**Need Help?** Check:
- `CACHING_IMPLEMENTATION_COMPLETE.md` - Full implementation details
- `CACHING_TESTING_GUIDE.md` - Testing scenarios
- `mobile/services/cacheService.js` - Source code with inline docs
