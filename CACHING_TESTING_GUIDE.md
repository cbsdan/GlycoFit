# Caching Testing Guide

## Quick Test Scenarios

### Test 1: Cache Hit - Tab Switching
**Objective**: Verify cache reduces repeat requests

1. Open the app and navigate to Home screen
2. Wait for meals to load (observe loading indicator)
3. Navigate to Profile screen
4. Navigate back to Home screen
5. **Expected**: Meals load instantly without loading indicator

**Why**: Home screen meals cached for 5 minutes, should load from cache

---

### Test 2: Cache Invalidation - Meal Update
**Objective**: Verify cache invalidates after data mutation

1. Open Home screen and note current meal list
2. Add a new meal
3. Return to Home screen
4. **Expected**: New meal appears in the list immediately

**Why**: `saveMeal()` invalidates meal caches, forcing fresh fetch

---

### Test 3: Force Refresh - Pull to Refresh
**Objective**: Verify force refresh bypasses cache

1. Open Home screen (loads from cache if available)
2. Note timestamp of data
3. Pull down to refresh
4. **Expected**: Loading indicator shows, fresh data loads

**Why**: Pull-to-refresh passes `forceRefresh: true` to API

---

### Test 4: Offline Mode - Stale Data Fallback
**Objective**: Verify offline viewing with cached data

1. Open Home screen while online
2. Wait for data to load and cache
3. Enable airplane mode
4. Close and reopen the app
5. Navigate to Home screen
6. **Expected**: Shows cached data (may show "outdated" indicator)

**Why**: CacheService returns stale data when API fails

---

### Test 5: Cache Expiry
**Objective**: Verify expired caches refresh automatically

1. Open Home screen (meals cache for 5 min)
2. Leave app open and wait 6 minutes
3. Navigate away and back to Home
4. **Expected**: Loading indicator briefly, then fresh data

**Why**: Cache expired (>5 min), triggers fresh API call

---

### Test 6: Logout Cache Clear
**Objective**: Verify all caches cleared on logout

1. Login and browse multiple screens (Home, Profile, Meals)
2. Note cache stats (if debug enabled): `CacheService.getStats()`
3. Logout
4. Login again
5. Navigate to previously cached screens
6. **Expected**: All screens show loading indicators (fresh fetches)

**Why**: `authService.logout()` calls `CacheService.clearAll()`

---

## Debug Console Commands

### Check Cache Statistics
```javascript
import CacheService from './services/cacheService';
const stats = await CacheService.getStats();
console.log('Cache Stats:', stats);
```

**Output Example**:
```json
{
  "totalKeys": 8,
  "totalSize": "~245 KB",
  "keys": [
    "meals_today",
    "profile",
    "step_summary_7d",
    "food_baseline",
    ...
  ]
}
```

### Manual Cache Invalidation
```javascript
// Clear specific cache
await CacheService.invalidate('meals_today');

// Clear pattern (all meal caches)
await CacheService.invalidatePattern(/^meals_/);

// Clear everything
await CacheService.clearAll();
```

### Check if Cache Exists
```javascript
const cached = await CacheService.getData('meals_today', null, { maxAge: 0 });
console.log('Cached meals:', cached ? 'EXISTS' : 'MISSING');
```

---

## Performance Metrics to Monitor

### Expected Cache Hit Rate
- **Home Screen (repeated visits)**: 80-90% cache hits
- **Profile Screen**: 90%+ (rarely changes)
- **Meal History (same date)**: 95%+
- **Physicians List**: 99%+ (24hr cache)

### Expected Load Times
| Screen | First Load | Cached Load | Improvement |
|--------|-----------|-------------|-------------|
| Home | 300-500ms | <50ms | **6-10x faster** |
| Profile | 200-400ms | <30ms | **7-13x faster** |
| Meals | 400-600ms | <50ms | **8-12x faster** |
| Food Assessment | 500-800ms | <100ms | **5-8x faster** |

### Network Request Reduction
- **Before**: ~20-30 requests per typical session
- **After**: ~5-8 requests per typical session
- **Reduction**: **70-80%** fewer requests

---

## Common Issues

### Issue: "Cache not working"
**Check**:
1. AsyncStorage installed? `npm list @react-native-async-storage/async-storage`
2. Import correct? `import CacheService from './services/cacheService'`
3. Cache duration too short? Check `CACHE_CONFIG` in api.js

### Issue: "Stale data showing"
**Check**:
1. Data changed on server but not updated locally?
2. Cache invalidation missing in mutation function?
3. Cache duration too long? Reduce `maxAge` in `CACHE_CONFIG`

### Issue: "App slower after caching"
**Unlikely but check**:
1. AsyncStorage full? Check with `getStats()`
2. Large objects being cached? (should auto-serialize)
3. Too many cache keys? (unlikely with current implementation)

---

## Test Results Template

Use this to document your testing:

```
Test Date: ___________
Tester: ___________

✅ Test 1: Cache Hit (Tab Switching)
   - Result: PASS / FAIL
   - Notes: _______________________________

✅ Test 2: Cache Invalidation (Meal Update)
   - Result: PASS / FAIL
   - Notes: _______________________________

✅ Test 3: Force Refresh (Pull to Refresh)
   - Result: PASS / FAIL
   - Notes: _______________________________

✅ Test 4: Offline Mode (Stale Data)
   - Result: PASS / FAIL
   - Notes: _______________________________

✅ Test 5: Cache Expiry
   - Result: PASS / FAIL
   - Notes: _______________________________

✅ Test 6: Logout Cache Clear
   - Result: PASS / FAIL
   - Notes: _______________________________

Performance Metrics:
- Average cache hit rate: _____%
- Average cached load time: _____ms
- Network request reduction: _____%

Issues Found:
1. _______________________________
2. _______________________________

Overall Result: PASS / FAIL
```

---

## Next Steps After Testing

1. **If all tests pass**: Deploy to production
2. **If tests fail**: 
   - Check error logs
   - Verify AsyncStorage working
   - Review cache configuration
   - Test with fresh app install

3. **Monitor in production**:
   - User-reported data staleness
   - AsyncStorage errors
   - Offline performance
   - Network usage metrics

Good luck with testing! 🚀
