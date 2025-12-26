# Cache Persistence Fix - Implementation Guide

**Issue**: Model re-downloads after every TestFlight update (~250MB wasted bandwidth)
**Status**: Investigation complete, fix ready for implementation
**Confidence**: 85% these changes will solve the problem

## TL;DR

The current Capacitor Filesystem implementation is architecturally correct, but has three subtle issues:

1. **Using `Directory.Data` which triggers iCloud backup** → Switch to `Directory.Library`
2. **No filesystem readiness check** → Add initialization verification
3. **Single point of failure in metadata.json** → Add Preferences backup

## Root Cause Analysis

✅ **What We Did Right**:
- Moved from Cache API (unreliable in WKWebView) to Capacitor Filesystem
- Used Directory.Data which persists across app updates
- Added comprehensive logging and storage management UI

⚠️ **What Needs Fixing**:
- `Directory.Data` = iOS Documents directory = **iCloud backup enabled**
- iOS may clear Documents when user is low on storage or iCloud quota is full
- Metadata file (metadata.json) is text-based, may be cleared separately from binary .bin files
- No verification that Capacitor Filesystem is ready before cache operations

## Recommended Solution (3 Changes)

### Change 1: Switch to Directory.Library ⭐ HIGHEST IMPACT

**Why**:
- Library/Application Support is for app-generated cache data
- NOT backed up to iCloud by default
- Still persists across app updates
- More semantically correct for cache storage

**Code Change**:
```typescript
// src/utils/filesystemCache.ts
- directory: Directory.Data,
+ directory: Directory.Library,
```

**Migration Needed**: Copy existing cache from Data → Library on first run after update.

**Impact**: Prevents iOS from clearing cache due to iCloud quota issues.

### Change 2: Add Filesystem Readiness Check

**Why**:
- Prevents race condition where cache check happens before Capacitor plugin initializes
- Ensures filesystem is accessible before operations
- Returns correct cache status on app startup

**Code Change**:
```typescript
// Add initialization check before cache operations
async function ensureFilesystemReady(): Promise<void> {
  // Verify directory exists and is accessible
  // Create if needed
}

export async function isCached(url: string): Promise<boolean> {
  await ensureFilesystemReady(); // ADD THIS LINE
  // ... rest of function
}
```

**Impact**: Eliminates false "not cached" results from timing issues.

### Change 3: Add Metadata Backup to Preferences

**Why**:
- If metadata.json is lost but .bin files survive, we can restore
- Capacitor Preferences persists reliably across updates
- Provides redundancy for critical metadata

**Code Change**:
```typescript
// Backup metadata to Preferences on every write
async function writeMetadata(metadata: CacheMetadata): Promise<void> {
  // Write to filesystem (primary)
  await Filesystem.writeFile(...);

  // Backup to Preferences (redundancy)
  await Preferences.set({ key: 'cache-metadata-backup', value: JSON.stringify(metadata) });
}

// Restore from Preferences if filesystem read fails
async function readMetadata(): Promise<CacheMetadata> {
  try {
    return await readFromFilesystem();
  } catch {
    // Try Preferences backup
    const backup = await Preferences.get({ key: 'cache-metadata-backup' });
    if (backup) return JSON.parse(backup);
    return emptyMetadata;
  }
}
```

**Impact**: Prevents total cache loss if metadata.json is corrupted/deleted.

## Implementation Steps

### Phase 1: Get User Debug Info (5 minutes)

Before implementing fixes, confirm the hypothesis:

**Ask user to test**:
1. Before TestFlight update:
   - Settings → LLM Provider → Storage Management
   - Click "Analyze Storage"
   - Screenshot showing cached files

2. After TestFlight update:
   - Settings → LLM Provider → Storage Management
   - Click "Analyze Storage" again
   - Screenshot showing cache state

**This confirms**:
- Do .bin files persist but metadata doesn't?
- Are there orphaned files?
- Is cache completely empty?

### Phase 2: Implement Fix (30 minutes)

**Priority Order**:
1. Directory.Library migration (10 min)
2. Readiness check (5 min)
3. Metadata backup (15 min)

See `history/cache-persistence-investigation-2025-12-26.md` for detailed code.

### Phase 3: Test (30 minutes)

1. **Local test**: Download model, restart app multiple times
2. **Version upgrade test**: Build v0.1.5, install over v0.1.4
3. **Edge case test**: Delete metadata.json manually, verify restore

### Phase 4: Deploy to TestFlight (10 minutes)

1. Commit changes with conventional message
2. Push to trigger GitHub Actions
3. Wait for TestFlight upload
4. Test on real device with version upgrade

## Expected Results

**Before Fix**:
```
User installs TestFlight update
→ App starts
→ Cache check: isCached() returns false
→ Model re-downloads (250MB, 5 minutes)
→ User frustrated 😡
```

**After Fix**:
```
User installs TestFlight update
→ App starts
→ ensureFilesystemReady() verifies access
→ readMetadata() finds cache in Library directory
→ isCached() returns true
→ Model loads instantly
→ User happy 😊
```

## Files to Modify

1. `src/utils/filesystemCache.ts` - Main implementation
2. `src/utils/storageAnalysis.ts` - Update to use Library directory
3. `package.json` - May need to add Preferences import

## Risks & Mitigation

**Risk 1**: Migration fails, users lose existing cache
- **Mitigation**: Test migration thoroughly, add error handling
- **Fallback**: If migration fails, just start fresh (same as current behavior)

**Risk 2**: Directory.Library has unexpected behavior
- **Mitigation**: Test on multiple iOS versions (15, 16, 17, 18)
- **Fallback**: Can revert to Directory.Data in emergency

**Risk 3**: Preferences backup fails
- **Mitigation**: Preferences is more reliable than filesystem
- **Fallback**: If both fail, re-download (same as current behavior)

## Success Metrics

**How to verify fix works**:
1. User reports model no longer re-downloads after updates
2. Storage Management UI shows cache persists
3. Sentry events show no cache loss warnings
4. User bandwidth saved: 250MB per update

## Alternative Solutions (NOT Recommended)

**Option A**: Bundle model in app binary
- ❌ Increases app download size by 250MB
- ❌ App Store rejects apps over 200MB for cellular download
- ❌ Every app update forces re-download of model

**Option B**: Use external CDN for streaming model
- ❌ Requires backend infrastructure
- ❌ Latency issues for model loading
- ❌ Still uses bandwidth on every app start

**Option C**: Implement custom native plugin
- ❌ Over-engineered, Capacitor Filesystem is sufficient
- ❌ Maintenance burden for native iOS code
- ❌ Doesn't solve the fundamental iCloud backup issue

## References

- **Investigation Details**: `history/cache-persistence-investigation-2025-12-26.md`
- **Capacitor Filesystem Docs**: https://capacitorjs.com/docs/apis/filesystem
- **iOS Directory Persistence**: https://developer.apple.com/forums/thread/7337
- **Commit History**:
  - 56b1ef6 - Storage management UI
  - 2f73f8f - Comprehensive logging
  - 1400620 - Filesystem cache implementation

## Next Actions

1. [ ] Ask user for debug info (before/after update screenshots)
2. [ ] Implement Directory.Library migration
3. [ ] Add filesystem readiness check
4. [ ] Add Preferences metadata backup
5. [ ] Test locally with version upgrade
6. [ ] Deploy to TestFlight
7. [ ] Verify with user that cache persists

---

**Last Updated**: December 26, 2025
**Author**: AI investigation based on codebase analysis
**Status**: Ready for implementation
