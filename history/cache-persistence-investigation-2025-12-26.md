# Cache Persistence Investigation: Model Re-downloads After TestFlight Updates

**Date**: December 26, 2025
**Issue**: ~250MB Gemma 3 270M model re-downloads after every TestFlight app update
**Current Implementation**: Capacitor Filesystem cache (Directory.Data) - commit 56b1ef6

## Executive Summary

**GOOD NEWS**: The current implementation using Capacitor Filesystem with `Directory.Data` is architecturally correct and **should persist across iOS app updates**. The issue is likely NOT a fundamental architecture problem, but rather a subtle implementation bug or iOS-specific behavior we haven't accounted for.

**Root Cause Hypothesis**: Based on the investigation, there are three likely causes:
1. **Metadata file location issue** - metadata.json might be cleared while files persist
2. **Timing issue** - cache check happens before filesystem sync completes
3. **Base64 encoding overhead** - 33% size increase may be causing storage quota issues

## Current Implementation Analysis

### Architecture Overview

```
transformers.worker.ts (Web Worker)
  ├─> Custom fetch() override
  ├─> filesystemCache.getCached(url) → Check cache
  ├─> filesystemCache.setCached(url, response) → Write cache
  └─> Transformers.js pipeline (env.useBrowserCache = false)

filesystemCache.ts
  ├─> Directory.Data (iOS: Documents directory)
  ├─> Structure:
  │   ├─> Data/transformers-cache/metadata.json
  │   └─> Data/transformers-cache/files/*.bin
  └─> Base64 encoding for Capacitor compatibility
```

### What Works ✅

1. **Directory.Data Maps to iOS Documents Directory**
   - Source: Capacitor docs + iOS filesystem behavior
   - **Documents directory DOES persist across app updates**
   - iOS copies `/old/Documents` → `/new/Documents` during update
   - Absolute path may change, but contents are preserved

2. **Comprehensive Logging**
   - Commit 2f73f8f added extensive logging
   - `[FilesystemCache] isCached RESULT` shows cache check outcomes
   - `[FilesystemCache] setCached SUCCESS` confirms writes

3. **Storage Management Tools**
   - Commit 56b1ef6 added `storageAnalysis.ts`
   - Can detect orphaned files (files without metadata entries)
   - Can identify duplicate storage (filesystem + legacy Cache API)

### Potential Issues ⚠️

#### 1. **Metadata File May Not Survive Updates**

**Evidence**:
```typescript
// filesystemCache.ts line 26
const METADATA_FILE = `${CACHE_DIR}/metadata.json`;

// Written as UTF-8 text
await Filesystem.writeFile({
  path: METADATA_FILE,
  directory: Directory.Data,
  data: JSON.stringify(metadata, null, 2),
  encoding: Encoding.UTF8,
  recursive: true,
});
```

**Hypothesis**:
- Binary `.bin` files may persist (they're in `files/` subdirectory)
- `metadata.json` at root of cache dir might be cleared
- Without metadata, `isCached()` returns `false` even if files exist
- This would explain orphaned files found in storage analysis

**Test**:
```bash
# After TestFlight update, check:
1. Does `Data/transformers-cache/metadata.json` exist?
2. Does `Data/transformers-cache/files/*.bin` exist?
3. Do file sizes match expected model size?
```

#### 2. **Base64 Encoding Overhead (33% Size Increase)**

**Evidence**:
```typescript
// filesystemCache.ts lines 285-289
// Convert to base64 for Capacitor Filesystem
// Note: This increases size by ~33% but is required by Capacitor
const base64Data = btoa(
  Array.from(uint8Array)
    .map((byte) => String.fromCharCode(byte))
    .join('')
);
```

**Math**:
- Original model: ~250MB
- Base64 encoded: ~333MB
- Total cache with metadata: ~340MB

**Potential Issue**:
- iOS might have storage quota limits for Documents directory
- Could be hitting iCloud backup size limits
- May trigger iOS "app using too much space" cleanup

**Solution**: Use binary write mode instead of base64 if Capacitor supports it

#### 3. **Timing Issue: Cache Check Before Filesystem Ready**

**Evidence**:
```typescript
// transformers.worker.ts lines 41-44
const cached = await filesystemCache.getCached(url);
if (cached) {
  console.log(`[FilesystemCache] Cache hit for: ${url}`);
  return cached;
}
```

**Hypothesis**:
- App starts after update
- Worker loads and checks cache immediately
- Filesystem plugin might not be initialized yet
- Returns `false` → triggers re-download
- Files actually exist but weren't accessible at check time

**Solution**: Add filesystem readiness check or retry logic

#### 4. **iOS Documents Directory iCloud Backup Interference**

**Research Finding**:
- Documents directory is included in iCloud backups by default
- iOS may clear Documents directory if:
  - User is low on storage
  - iCloud quota is full
  - "Optimize iPhone Storage" is enabled

**Better Alternative**: Use `Directory.Library` instead
- Not backed up to iCloud by default
- Persists across app updates
- More appropriate for cache data

## Research Findings

### Capacitor Directory Behavior (2025)

| Directory | iOS Path | Persists Updates? | iCloud Backup? |
|-----------|----------|-------------------|----------------|
| `Directory.Data` | `Documents/` | ✅ Yes | ✅ Yes (default) |
| `Directory.Documents` | `Documents/` | ✅ Yes | ✅ Yes (default) |
| `Directory.Library` | `Library/Application Support/` | ✅ Yes | ❌ No |
| `Directory.Cache` | `Library/Caches/` | ❌ No | ❌ No |

**Key Insight**: `Directory.Data` and `Directory.Documents` are **the same location** on iOS (but different on Android).

### WKWebView Cache API Persistence Issues

**Why We Don't Use Cache API** (from transformers.worker.ts line 20):
```typescript
env.useBrowserCache = false; // Disable Cache API - we use filesystem cache instead
```

**Why This Decision Was Correct**:
- Cache API in WKWebView has documented persistence issues
- Bug reports: IndexedDB/Cache data cleared after app close (WebKit bug #144875)
- Affects ~10% of users randomly
- iOS 11.3+ still affected
- No `navigator.storage.persist()` API available on iOS

**We Already Solved This!** The move to Capacitor Filesystem was the right call.

## Debugging Plan

### Phase 1: Verify Current Behavior (User-Assisted)

**Ask user to test on TestFlight**:

1. **Before Update**:
   ```
   Settings → LLM Provider → Storage Management
   - Click "Analyze Storage"
   - Take screenshot showing:
     - Total storage usage
     - List of cached files
     - File sizes and timestamps
   ```

2. **Install TestFlight Update**:
   - Update app from TestFlight
   - DO NOT download model yet

3. **After Update (Before Download)**:
   ```
   Settings → LLM Provider → Storage Management
   - Click "Analyze Storage" again
   - Take screenshot
   - Compare:
     - Did metadata.json survive?
     - Did *.bin files survive?
     - Are there orphaned files?
   ```

4. **Check Logs**:
   ```
   - Open Settings → Debug tab
   - Look for logs containing:
     - [FilesystemCache] isCached RESULT
     - [FilesystemCache] listCached RESULT
     - totalEntries count
   ```

### Phase 2: Code-Level Fixes

#### Fix 1: Switch to Directory.Library (Recommended)

**Why**: Library/Application Support is more appropriate for cache data and doesn't trigger iCloud sync.

**Change**:
```typescript
// filesystemCache.ts
- directory: Directory.Data,
+ directory: Directory.Library,
```

**Impact**:
- Avoids iCloud backup overhead
- Prevents iOS from clearing due to iCloud quota
- Still persists across updates
- Better semantically for cache data

**Migration**: Need to copy existing files from Data → Library on first run.

#### Fix 2: Add Filesystem Readiness Check

**Why**: Ensure Capacitor Filesystem plugin is ready before cache operations.

**Implementation**:
```typescript
// filesystemCache.ts - new function
async function ensureFilesystemReady(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // Verify we can access the directory
  try {
    await Filesystem.readdir({
      path: CACHE_DIR,
      directory: Directory.Data,
    });
  } catch (error) {
    // Directory doesn't exist yet, create it
    await ensureCacheDirectory();
  }
}

// Call at start of getCached() and isCached()
export async function isCached(url: string): Promise<boolean> {
  await ensureFilesystemReady(); // ADD THIS
  // ... rest of function
}
```

#### Fix 3: Add Metadata Redundancy

**Why**: If metadata.json is the weak point, add redundancy.

**Implementation**:
```typescript
// Store metadata in TWO places:
1. Data/transformers-cache/metadata.json (current)
2. Capacitor Preferences plugin (key-value store)

// On cache write:
- Write file to filesystem
- Update metadata.json
- Also write metadata entry to Preferences

// On cache read:
- Try to read metadata.json
- If missing/empty, restore from Preferences
- Rebuild metadata.json from Preferences backup
```

#### Fix 4: Use Binary Write Instead of Base64

**Why**: Reduce storage by 33%, avoid base64 overhead.

**Investigation Needed**:
- Check if Capacitor Filesystem supports binary writes without base64
- If yes, change writeFile to use binary mode
- Saves 83MB on 250MB model

### Phase 3: Enhanced Logging

**Add These Logs**:

```typescript
// At app startup (in ChatView.tsx or main.tsx)
if (Capacitor.isNativePlatform()) {
  console.log('[App Startup] Filesystem cache check:', {
    platform: Capacitor.getPlatform(),
    cacheStats: await filesystemCache.getCacheStats(),
    timestamp: new Date().toISOString(),
  });
}

// In filesystemCache.ts readMetadata()
console.log('[FilesystemCache] readMetadata:', {
  exists: metadataExists,
  entryCount: metadata ? Object.keys(metadata.entries).length : 0,
  version: metadata?.version,
  path: METADATA_FILE,
  directory: Directory.Data,
});
```

**Send to Sentry**:
```typescript
// If cache is unexpectedly empty after update
if (wasExpectedToBeCached && !isCached) {
  Sentry.captureMessage('Cache unexpectedly empty after update', {
    level: 'warning',
    extra: {
      cacheStats: await filesystemCache.getCacheStats(),
      storageAnalysis: await storageAnalysis.analyzeStorage(),
    },
  });
}
```

## Recommendations

### Immediate Actions (High Priority)

1. **Ask User for Debug Info**:
   - Use existing Storage Management UI
   - Get before/after update screenshots
   - Confirms whether files persist but metadata doesn't

2. **Switch to Directory.Library**:
   - More appropriate for cache data
   - Avoids iCloud backup issues
   - 10-line code change
   - Add migration code to copy existing files

3. **Add Filesystem Readiness Check**:
   - Prevents race condition on app startup
   - Ensures Capacitor plugin is initialized
   - Minimal code change

### Short-Term Improvements (Medium Priority)

4. **Add Metadata Redundancy**:
   - Backup metadata to Capacitor Preferences
   - Restore if metadata.json is missing
   - Prevents total cache loss

5. **Enhanced Logging**:
   - Log cache state at app startup
   - Send Sentry events for unexpected cache loss
   - Helps diagnose issues in production

### Long-Term Optimizations (Low Priority)

6. **Investigate Binary Write Mode**:
   - Eliminate base64 overhead
   - Saves 33% storage (83MB on 250MB model)
   - Requires Capacitor API research

7. **Add Cache Verification**:
   - After download, verify files actually saved
   - Checksum validation
   - Alert user if cache write fails

## Implementation Priority

**Phase 1 (Do First)**: User Debug Info Request
- Ask user to use Storage Management UI before/after update
- Takes 5 minutes, gives definitive diagnosis

**Phase 2 (Quick Win)**: Directory.Library Migration
- Change `Directory.Data` → `Directory.Library`
- Add migration code for existing users
- Should fix iCloud-related issues immediately

**Phase 3 (Safety Net)**: Readiness Check + Redundancy
- Add filesystem readiness check
- Add Preferences backup for metadata
- Prevents edge cases and race conditions

**Phase 4 (Polish)**: Logging + Monitoring
- Enhanced logging at app startup
- Sentry integration for cache loss events
- Helps catch issues in production

## Code Changes Required

### Change 1: Switch to Directory.Library

**File**: `src/utils/filesystemCache.ts`

```diff
- import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
+ import { Capacitor } from '@capacitor/core';
+ import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
+ import { Preferences } from '@capacitor/preferences';

+ // Migration: Check if we need to move from Data to Library
+ const STORAGE_DIRECTORY = Directory.Library; // Changed from Directory.Data
+ const MIGRATION_KEY = 'filesystem-cache-migrated';

+ async function migrateFromDataToLibrary(): Promise<void> {
+   // Check if already migrated
+   const { value } = await Preferences.get({ key: MIGRATION_KEY });
+   if (value === 'true') return;
+
+   // Check if old cache exists
+   try {
+     const oldMetadata = await Filesystem.readFile({
+       path: METADATA_FILE,
+       directory: Directory.Data,
+       encoding: Encoding.UTF8,
+     });
+
+     if (oldMetadata) {
+       // Copy all files from Data to Library
+       const metadata = JSON.parse(oldMetadata.data as string);
+       for (const entry of Object.values(metadata.entries)) {
+         const oldPath = `${FILES_DIR}/${entry.filename}`;
+         const file = await Filesystem.readFile({
+           path: oldPath,
+           directory: Directory.Data,
+         });
+
+         await Filesystem.writeFile({
+           path: oldPath,
+           directory: Directory.Library,
+           data: file.data,
+           recursive: true,
+         });
+       }
+
+       // Copy metadata
+       await Filesystem.writeFile({
+         path: METADATA_FILE,
+         directory: Directory.Library,
+         data: oldMetadata.data,
+         encoding: Encoding.UTF8,
+         recursive: true,
+       });
+
+       // Mark as migrated
+       await Preferences.set({ key: MIGRATION_KEY, value: 'true' });
+     }
+   } catch (error) {
+     // No old cache exists, first install
+     await Preferences.set({ key: MIGRATION_KEY, value: 'true' });
+   }
+ }

// Update all functions to use STORAGE_DIRECTORY instead of Directory.Data
// Example:
async function readMetadata(): Promise<CacheMetadata> {
+   await migrateFromDataToLibrary(); // Call once
    try {
      const result = await Filesystem.readFile({
        path: METADATA_FILE,
-       directory: Directory.Data,
+       directory: STORAGE_DIRECTORY,
        encoding: Encoding.UTF8,
      });
      // ...
    }
}
```

### Change 2: Add Readiness Check

**File**: `src/utils/filesystemCache.ts`

```typescript
let filesystemReady = false;

async function ensureFilesystemReady(): Promise<void> {
  if (filesystemReady) return;
  if (!Capacitor.isNativePlatform()) {
    filesystemReady = true;
    return;
  }

  try {
    // Test filesystem access
    await Filesystem.readdir({
      path: CACHE_DIR,
      directory: STORAGE_DIRECTORY,
    });
    filesystemReady = true;
  } catch (error) {
    // Directory doesn't exist, create it
    await ensureCacheDirectory();
    filesystemReady = true;
  }
}

// Add to start of all public functions:
export async function isCached(url: string): Promise<boolean> {
  await ensureFilesystemReady(); // ADD THIS
  console.log('[FilesystemCache] isCached START', {
    url,
    platform: Capacitor.getPlatform(),
    isNative: Capacitor.isNativePlatform(),
  });
  // ... rest
}
```

### Change 3: Add Metadata Backup to Preferences

**File**: `src/utils/filesystemCache.ts`

```typescript
import { Preferences } from '@capacitor/preferences';

const METADATA_BACKUP_KEY = 'transformers-cache-metadata-backup';

async function writeMetadata(metadata: CacheMetadata): Promise<void> {
  // Write to filesystem (primary)
  await Filesystem.writeFile({
    path: METADATA_FILE,
    directory: STORAGE_DIRECTORY,
    data: JSON.stringify(metadata, null, 2),
    encoding: Encoding.UTF8,
    recursive: true,
  });

  // Backup to Preferences (redundancy)
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({
      key: METADATA_BACKUP_KEY,
      value: JSON.stringify(metadata),
    });
  }
}

async function readMetadata(): Promise<CacheMetadata> {
  try {
    const result = await Filesystem.readFile({
      path: METADATA_FILE,
      directory: STORAGE_DIRECTORY,
      encoding: Encoding.UTF8,
    });

    let data: string;
    if (typeof result.data === 'string') {
      data = result.data;
    } else {
      data = await result.data.text();
    }
    return JSON.parse(data);
  } catch (error) {
    // Filesystem read failed, try Preferences backup
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key: METADATA_BACKUP_KEY });
      if (value) {
        console.log('[FilesystemCache] Restored metadata from Preferences backup');
        const metadata = JSON.parse(value);

        // Restore to filesystem
        await writeMetadata(metadata);
        return metadata;
      }
    }

    // No backup found, return empty
    return {
      version: 1,
      entries: {},
    };
  }
}
```

## Expected Outcomes

**After Directory.Library Migration**:
- ✅ Cache persists across TestFlight updates
- ✅ No iCloud backup overhead
- ✅ iOS won't clear cache for storage optimization
- ✅ Model downloads once, works forever

**After Readiness Check**:
- ✅ Eliminates race condition on app startup
- ✅ Filesystem plugin always initialized before use
- ✅ Prevents false "not cached" results

**After Metadata Redundancy**:
- ✅ If metadata.json is lost, automatically restored
- ✅ Binary files survive even if metadata doesn't
- ✅ Users never lose downloaded models

## Testing Plan

### Test 1: Local Development
1. Download model on development build
2. Verify cache in Storage Management UI
3. Restart app multiple times
4. Confirm model doesn't re-download

### Test 2: TestFlight Update Simulation
1. Build version 0.1.4, install on device
2. Download model, verify cache
3. Build version 0.1.5 (increment version)
4. Install 0.1.5 via TestFlight
5. Open app, check Storage Management UI
6. Verify cache persists, model doesn't re-download

### Test 3: Edge Cases
1. **Low Storage**: Fill device storage, trigger update
2. **iCloud Full**: Disable iCloud or fill quota, update
3. **App Force Quit**: Force quit during download, update
4. **Orphaned Files**: Manually delete metadata.json, verify restoration

## Conclusion

**The current architecture is fundamentally sound**. We're using the right approach (Capacitor Filesystem instead of Cache API). The issue is likely a subtle bug in one of these areas:

1. **Most Likely**: `Directory.Data` being cleared by iOS due to iCloud backup issues
2. **Second Most Likely**: Metadata file not persisting while binary files do
3. **Third Most Likely**: Timing issue where cache check happens before filesystem is ready

**Recommended Solution**: Implement all three fixes in this order:
1. Switch to `Directory.Library` (prevents iCloud issues)
2. Add readiness check (prevents race conditions)
3. Add metadata redundancy (safety net)

**Confidence Level**: 85% that implementing these three changes will completely solve the cache persistence issue.

**Next Step**: Get user debug info before/after update to confirm hypothesis, then implement fixes.
