# XET Protocol Research Report
**Date**: 2025-12-26
**Context**: Investigating XET as potential replacement for HTTP downloads in Transformers.js model caching

## Executive Summary

**Recommendation**: ❌ **Do NOT adopt XET for browser-based model downloads**

**Rationale**:
- XET browser support is **experimental and incomplete** (as of March 2025)
- No published npm packages for client-side use
- Hugging Face's implementation is **not production-ready** for browsers
- Current HTTP-based approach is simpler and more reliable
- Better alternatives exist for addressing the real issues

**The Real Problem**: The user's download issues are NOT related to protocol inefficiency, but rather:
1. Progress tracking UX issues (multi-file aggregation complexity)
2. Cache invalidation after app updates
3. IndexedDB limitations on iOS (WKWebView 10MB file limit)

**Recommended Solution**: Fix current implementation with:
1. Improved progress calculation (already addressed in recent commits)
2. Capacitor Filesystem cache (already implemented)
3. Consider smaller quantized models (Q4 vs current setup)
4. Implement HTTP Range requests for resumable downloads (optional enhancement)

---

## What is XET?

### Overview
XET (from XetHub, acquired by Hugging Face) is a **Git-based storage protocol** designed for efficient large file handling in ML workflows.

### Key Features
- **Chunk-based deduplication**: Only transfers changed blocks, not entire files
- **Delta compression**: Reduces bandwidth for model updates
- **Git-integrated**: Works with existing Git workflows
- **Content-addressable storage**: Efficient storage and retrieval

### Design Goals
XET was built to replace Git LFS for ML model distribution on Hugging Face Hub with:
- 10x faster uploads/downloads
- ~30% storage savings through compression
- Chunk-level deduplication vs Git LFS's file-level approach

---

## XET Technology Stack

### Server-Side (Production-Ready)
- **xet-core**: Rust library powering Hugging Face Hub backend
- **Python bindings** (`hf_xet`): Production-ready as of `huggingface_hub >= 0.32.0`
- **Git integration**: `git-xet` plugin for Git repositories
- **Storage**: Works with Amazon S3, other object storage

### Client-Side (Experimental)

#### WebAssembly Builds
xet-core includes TWO WebAssembly variants:
1. **`hf_xet_wasm`**: Full-featured WASM build
2. **`hf_xet_thin_wasm`**: Lightweight WASM build

**Status**: Built but **NOT published to npm** as standalone packages.

#### JavaScript Integration
- **huggingface.js**: Reference implementation exists but incomplete
  - `XetBlob` utility (for file handling)
  - Upload support via `uploadShards`
  - Download support: **NOT IMPLEMENTED** (as of March 2025)

**Critical GitHub Issues**:
- [#1274](https://github.com/huggingface/huggingface.js/issues/1274): "Be able to download xet files natively" - **OPEN**
- [#1278](https://github.com/huggingface/huggingface.js/issues/1278): "Download via xet natively via the current downloadFile function" - **OPEN**

**Implementation Status** (10 sub-issues tracked):
- ✅ 6 completed: XetBlob, LZ4, presigned URLs, cache optimization, streams, browser tests
- ❌ 4 remaining: **Native downloads**, speed optimization, test coverage, stream enhancements

**Key Quote from Issue #1274**:
> "We do not handle caching chunks at the moment."

This is a **blocker** for browser adoption - chunk caching is ESSENTIAL for XET's efficiency benefits.

---

## Browser/Capacitor Compatibility

### ❌ Critical Limitations for Our Use Case

#### 1. No npm Package Available
```bash
$ pnpm search hf_xet_wasm
# No results

$ pnpm search xethub
# No results (only unrelated packages)
```

The WebAssembly builds exist in the xet-core repo but are **not distributed via npm**.

#### 2. Incomplete Browser Implementation
According to Hugging Face docs:
> "Xet-backed repositories are seamlessly compatible with... huggingface.js, Web browser"

**Reality**: This compatibility is **marketing language**. The actual implementation:
- ✅ Upload works (via WASM)
- ❌ Download **does not work natively** (falls back to HTTP)
- ❌ Chunk caching **not implemented**
- ❌ No production examples exist

#### 3. Transformers.js Integration: None
Transformers.js uses its own caching layer:
- Uses `env.cacheDir` for cache configuration
- Downloads via standard fetch API
- No XET integration or custom download backend support
- Progress callbacks work with HTTP streams

**No evidence** of XET integration in Transformers.js codebase.

#### 4. iOS/Capacitor Blockers

**OPFS (Origin Private File System) Issues on iOS**:
- WKWebView (Capacitor's browser engine) **limits files to 10MB**
- Gemma 3 270M ONNX files are **~250MB** (way over limit)
- OPFS persistence issues: Files lost when app closes on iOS
- Capacitor Filesystem plugin required for reliable storage

**Conclusion**: Even if XET worked in browsers, iOS storage limitations would prevent it from working in our Capacitor app.

---

## Comparison: XET vs Current HTTP Approach

| Criteria | Current (HTTP fetch) | XET Protocol |
|----------|----------------------|--------------|
| **Download Size (Initial)** | 250MB full file | 250MB full file ⚖️ |
| **Download Size (Updates)** | 250MB full re-download | ~50MB delta ✅ |
| **Resumable Downloads** | ❌ No (could add Range requests) | ✅ Yes (when chunk caching works) |
| **Progress Tracking** | ✅ Per-file fetch events | ❌ Not implemented in browser |
| **Browser Support** | ✅ Universal (fetch API) | ❌ Experimental, incomplete |
| **iOS/Capacitor Support** | ✅ Works with Filesystem plugin | ❌ OPFS 10MB limit, persistence issues |
| **npm Package Availability** | ✅ `@huggingface/transformers` | ❌ No package published |
| **Transformers.js Integration** | ✅ Native | ❌ None |
| **Implementation Complexity** | ✅ Low (already working) | ❌ High (build from source, integrate WASM) |
| **Production Readiness** | ✅ Stable | ❌ Experimental (March 2025) |
| **Hugging Face Support** | ✅ Full support | ⚠️ Backend only, browser WIP |
| **Versioning** | ⚖️ Manual (model IDs) | ✅ Built-in Git versioning |
| **Offline Usage** | ✅ Works if cached | ✅ Works if cached ⚖️ |

**Key Takeaway**: XET's advantages (delta updates, deduplication) are **irrelevant** for initial downloads and **unavailable** in browsers due to incomplete implementation.

---

## Use Case Analysis

### 1. Initial Download (~250MB)
- **HTTP**: Download full 250MB via fetch API
- **XET**: Download full 250MB (no delta on first download)
- **Winner**: ⚖️ Tie (both download full file)

### 2. Model Update (New Version)
- **HTTP**: Re-download full 250MB
- **XET**: Download only changed blocks (~50MB estimated)
- **Winner**: ✅ XET (if it worked in browsers - it doesn't)

**Reality Check**: How often do we update models?
- Model updates are **infrequent** (weeks/months)
- Users typically stick with one model version
- Delta updates are a **nice-to-have**, not critical

### 3. App Update (TestFlight Build)
- **HTTP**: Works if Capacitor Filesystem cache persists (it does)
- **XET**: Would work if browser chunk cache persisted (no guarantee)
- **Winner**: ⚖️ Tie (both rely on cache persistence)

**Current Solution**: We already use Capacitor Filesystem for cache persistence across app updates.

### 4. Progress Tracking (User's Real Issue)
- **HTTP**: Per-file progress events (current challenge: aggregating multi-file progress)
- **XET**: **Not implemented** in browser
- **Winner**: ✅ HTTP (at least it exists and can be improved)

**Recent Fix**: We've already improved progress aggregation in `transformers.worker.ts` to handle multi-file downloads correctly.

### 5. Resumable Downloads (Failure Recovery)
- **HTTP**: Not implemented (could add via Range requests)
- **XET**: Built-in (when chunk caching works - not in browsers yet)
- **Winner**: ⚖️ Neither (both need additional work)

**Practical Reality**: Mobile networks are reliable enough that full re-downloads are acceptable. Range requests would be a better solution than XET.

---

## Alternative Solutions (Better Than XET)

### Option 1: Improve Current HTTP Implementation ✅ **RECOMMENDED**

**Already Done**:
- ✅ Capacitor Filesystem cache (persists across app updates)
- ✅ Multi-file progress aggregation fixed
- ✅ Monotonic progress reporting
- ✅ Custom fetch wrapper for caching

**Additional Improvements** (if needed):
1. **HTTP Range Requests** for resumable downloads:
   ```typescript
   // Pseudo-code for Range request implementation
   async function resumableDownload(url: string, destination: string) {
     const existingFile = await checkPartialDownload(destination);
     const headers = existingFile
       ? { 'Range': `bytes=${existingFile.size}-` }
       : {};

     const response = await fetch(url, { headers });
     // Append to existing file or start new
   }
   ```

   **Benefits**:
   - Simple to implement (standard HTTP feature)
   - Works with all Hugging Face models
   - No new dependencies
   - Universal browser support

2. **Smaller Models** (Q4 quantization):
   ```typescript
   // Current: gemma-3-270m-it-ONNX with Q8 quantization (~250MB)
   // Alternative: Q4 quantization (~125MB, 50% reduction)

   const config = {
     modelId: 'onnx-community/gemma-3-270m-it-ONNX',
     dtype: 'q4f16', // Instead of default (Q8)
     device: 'webgpu'
   };
   ```

   **Trade-offs**:
   - ✅ 50% smaller download
   - ✅ Faster initial download
   - ⚠️ Slight quality reduction (usually acceptable for on-device AI)

3. **Progressive Download UX**:
   - Show per-file progress instead of aggregated
   - Download on-demand (lazy loading) instead of preemptive
   - Stream model weights (if Transformers.js supports it)

### Option 2: Service Worker Caching 🤔 **WORTH EXPLORING**

**Concept**:
- Use Service Worker to intercept fetch requests
- Cache model files in Cache API
- Better control over cache invalidation
- Works offline automatically

**Implementation**:
```typescript
// service-worker.ts
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only cache Hugging Face model files
  if (url.includes('huggingface.co/') && url.includes('.onnx')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          return caches.open('models-v1').then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});
```

**Benefits**:
- ✅ Standard browser API
- ✅ Better cache control
- ✅ Offline support
- ✅ No iOS 10MB limit (Cache API is separate from OPFS)

**Challenges**:
- ⚠️ Service Workers require HTTPS (we have this)
- ⚠️ Capacitor Service Worker support needs testing
- ⚠️ Additional complexity vs current Filesystem cache

### Option 3: Background Download (Capacitor Plugin) 🔧 **ADVANCED**

**Concept**:
- Use native iOS background download APIs
- Download continues even when app is backgrounded
- System handles resume/retry automatically

**Implementation**:
```typescript
import { BackgroundDownload } from '@capacitor-community/background-download';

await BackgroundDownload.download({
  url: 'https://huggingface.co/.../model.onnx',
  path: 'models/gemma-3-270m.onnx'
});
```

**Benefits**:
- ✅ Native reliability (iOS URLSession)
- ✅ System-level resume support
- ✅ Works in background
- ✅ No size limits

**Challenges**:
- ⚠️ Requires native plugin integration
- ⚠️ More complex than browser fetch
- ⚠️ Platform-specific code

---

## XET Implementation POC (If We Were To Proceed)

**Note**: This is **hypothetical** - XET is NOT recommended for our use case.

### Step 1: Build WASM Module
```bash
# Clone xet-core
git clone https://github.com/huggingface/xet-core.git
cd xet-core/rust/hf_xet_thin_wasm

# Build WASM (requires Rust + wasm-pack)
wasm-pack build --target web

# Output: pkg/ directory with .wasm and .js bindings
```

### Step 2: Integrate with Project
```typescript
// Copy pkg/ contents to src/xet-wasm/
import init, { download_xet_file } from './xet-wasm';

// Initialize WASM module
await init();

// Attempt download (hypothetical API - not documented)
const blob = await download_xet_file({
  repo: 'onnx-community/gemma-3-270m-it-ONNX',
  file: 'onnx/model.onnx',
  token: 'hf_...'
});
```

### Step 3: Handle Chunk Caching
```typescript
// Problem: "We do not handle caching chunks at the moment"
// Would need to implement ourselves:

interface ChunkCache {
  hash: string;
  data: Uint8Array;
}

const chunkStore = new Map<string, ChunkCache>();

async function downloadWithChunkCache(url: string) {
  // Pseudo-code - actual XET protocol is complex
  const manifest = await fetchManifest(url);

  for (const chunk of manifest.chunks) {
    if (!chunkStore.has(chunk.hash)) {
      const data = await downloadChunk(chunk.url);
      chunkStore.set(chunk.hash, { hash: chunk.hash, data });
    }
  }

  return reconstructFile(manifest, chunkStore);
}
```

### Estimated Effort: 2-4 Weeks
- Build WASM module: 2 days
- Integration with codebase: 3 days
- Chunk caching implementation: 5 days
- iOS/Capacitor testing: 3 days
- Edge case handling: 3 days
- Documentation: 2 days

**Total**: 18 person-days minimum

**Risk**: High (immature browser support, unclear API, no documentation)

---

## Decision Matrix

### Should We Adopt XET?

| Factor | Weight | HTTP Score | XET Score | Winner |
|--------|--------|------------|-----------|--------|
| **Technical Maturity** | 10 | 10 ✅ | 3 ❌ | HTTP |
| **Browser Support** | 10 | 10 ✅ | 2 ❌ | HTTP |
| **iOS/Capacitor Compatibility** | 10 | 10 ✅ | 1 ❌ | HTTP |
| **Implementation Effort** | 8 | 10 ✅ | 2 ❌ | HTTP |
| **Maintenance Burden** | 8 | 10 ✅ | 3 ❌ | HTTP |
| **Bandwidth Efficiency (Initial)** | 5 | 5 ⚖️ | 5 ⚖️ | Tie |
| **Bandwidth Efficiency (Updates)** | 3 | 2 ⚠️ | 8 ✅ | XET |
| **Resumable Downloads** | 6 | 3 ⚠️ | 7 ✅* | XET* |
| **Progress Tracking** | 7 | 8 ✅ | 1 ❌ | HTTP |
| **Offline Support** | 6 | 9 ✅ | 6 ⚖️ | HTTP |

**Weighted Score**:
- **HTTP**: 8.4/10
- **XET**: 3.6/10

*\*When fully implemented (not currently available in browsers)*

**Clear Winner**: ✅ **HTTP/Current Implementation**

---

## Risk Analysis

### If We Adopt XET (High Risk)

**Technical Risks**:
- ❌ No npm package (must build from source)
- ❌ Incomplete browser implementation (missing native downloads)
- ❌ No chunk caching (core feature not implemented)
- ❌ Undocumented WASM API (would need to reverse-engineer)
- ❌ Breaking changes likely (experimental status)

**Platform Risks**:
- ❌ iOS OPFS 10MB file limit (incompatible with our use case)
- ❌ WKWebView persistence issues
- ❌ Capacitor compatibility unknown

**Project Risks**:
- ❌ 2-4 weeks development time
- ❌ High maintenance burden (tracking upstream changes)
- ❌ Difficult debugging (WASM + chunking complexity)
- ❌ No community support (no one else using XET in browsers)

**Business Risks**:
- ❌ Delays feature delivery
- ❌ Increases technical debt
- ❌ Reduces team velocity

### If We Stay with HTTP (Low Risk)

**Technical Risks**:
- ✅ Mature, well-understood technology
- ✅ Universal browser support
- ✅ Easy debugging
- ✅ Standard APIs (fetch, Range requests)

**Platform Risks**:
- ✅ Works on all platforms (iOS, Android, Web)
- ✅ Capacitor Filesystem well-tested

**Project Risks**:
- ✅ Low complexity
- ✅ Easy to maintain
- ✅ Fast iteration

**Business Risks**:
- ✅ Predictable timeline
- ✅ Lower costs
- ✅ Faster time-to-market

---

## Final Recommendation

### ❌ Do NOT Adopt XET

**Reasons**:
1. **Not Production-Ready**: Browser implementation is incomplete (as of March 2025)
2. **No npm Package**: Would require building from source and maintaining WASM module
3. **iOS Incompatibility**: OPFS file size limits prevent XET from working on iOS
4. **Missing Core Features**: Chunk caching not implemented in browser
5. **High Complexity**: 2-4 weeks development + ongoing maintenance burden
6. **Minimal Benefit**: Delta updates only help on model version changes (infrequent)

### ✅ Instead, Improve Current HTTP Implementation

**Immediate Actions** (Already Done ✅):
1. ✅ Fixed multi-file progress aggregation
2. ✅ Implemented Capacitor Filesystem cache
3. ✅ Monotonic progress reporting

**Future Enhancements** (If Needed):
1. **HTTP Range Requests** for resumable downloads
   - Standard HTTP feature
   - Works with existing infrastructure
   - Low implementation effort (~2 days)
   - Universal browser support

2. **Smaller Models** via Q4 quantization
   - 50% size reduction (250MB → 125MB)
   - No code changes required (just config)
   - Slight quality trade-off (acceptable for on-device)

3. **Service Worker Caching** (if offline support critical)
   - Better cache control than current approach
   - No iOS file size limits
   - Well-documented browser API

4. **Background Downloads** (if resume critical on iOS)
   - Use `@capacitor-community/background-download`
   - Native iOS reliability
   - System-level resume support

---

## Monitoring XET Development

**If you want to revisit XET in the future**, watch these indicators:

### Green Lights (Safe to Reconsider)
- ✅ XET npm package published (`hf_xet_wasm` or similar)
- ✅ GitHub issues #1274 and #1278 closed (native download support)
- ✅ Chunk caching implemented in browser
- ✅ Production examples published by Hugging Face
- ✅ Community adoption (other projects using XET in browsers)
- ✅ iOS OPFS file size limits resolved or workaround documented

### Red Flags (Still Not Ready)
- ❌ Issues remain open for >6 months
- ❌ No browser documentation appears
- ❌ No updates to huggingface.js XET code
- ❌ No npm package published

**Check these URLs quarterly**:
- https://github.com/huggingface/huggingface.js/issues/1274
- https://github.com/huggingface/huggingface.js/issues/1278
- https://www.npmjs.com/search?q=xet
- https://huggingface.co/docs/xet

---

## References

### Official Documentation
- [XetHub (now Hugging Face Xet)](https://xethub.com/)
- [Xet Protocol Specification](https://huggingface.co/docs/xet/index)
- [Xet on Hugging Face Hub](https://huggingface.co/docs/hub/en/xet/index)
- [huggingface.js Documentation](https://huggingface.co/docs/huggingface.js/index)

### GitHub Repositories
- [xetdata/xet-core](https://github.com/xetdata/xet-core) - Original Rust implementation
- [huggingface/xet-core](https://github.com/huggingface/xet-core) - HF fork with WASM builds
- [huggingface/huggingface.js](https://github.com/huggingface/huggingface.js) - JS client library

### Key GitHub Issues
- [#1274 - Xet file downloads](https://github.com/huggingface/huggingface.js/issues/1274)
- [#1278 - Download via xet natively](https://github.com/huggingface/huggingface.js/issues/1278)
- [Capacitor OPFS persistence issue](https://github.com/ionic-team/capacitor/issues/6965)

### Related Research
- [MDN: HTTP Range Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests)
- [Fetch API: Download Progress](https://javascript.info/fetch-progress)
- [ONNX Quantization Guide](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html)

### Internal Documentation
- `/home/david/dev/cawcaw/src/workers/transformers.worker.ts` - Current download implementation
- `/home/david/dev/cawcaw/src/utils/filesystemCache.ts` - Capacitor Filesystem cache
- `/home/david/dev/cawcaw/history/transformers-js-webgpu-research.md` - Related research

---

## Appendix A: XET Protocol Technical Details

### How XET Works (High Level)

1. **Chunking**: Files split into content-defined chunks (using Gearhash algorithm)
2. **Hashing**: Each chunk gets a unique hash (content-addressable)
3. **Deduplication**: Identical chunks stored only once
4. **Compression**: Chunks compressed with LZ4 before storage
5. **Xorbs**: Chunks bundled into "xorbs" (compressed archives)
6. **Shards**: Xorbs organized into shards for efficient retrieval
7. **Reconstruction**: Client downloads xorbs, extracts chunks, rebuilds file

### XET vs Git LFS

| Feature | Git LFS | XET |
|---------|---------|-----|
| **Deduplication** | File-level | Chunk-level ✅ |
| **Update Efficiency** | Full file re-download | Delta only ✅ |
| **Compression** | None | LZ4 ✅ |
| **Storage Savings** | Baseline | ~30% reduction ✅ |
| **Speed** | Baseline | ~10x faster ✅ |
| **Browser Support** | ✅ Via Git | ❌ Experimental |

**Conclusion**: XET is excellent for **server-side** ML workflows (Python, Git), but **not ready** for browser/Capacitor apps.

---

## Appendix B: Transformers.js Caching Architecture

### Current Implementation

```typescript
// transformers.worker.ts (lines 19-21)
env.useBrowserCache = false; // Disable Cache API
env.allowRemoteModels = true; // Allow HF Hub downloads

// Custom fetch wrapper (lines 36-72)
async function cachedFetch(input, init) {
  // Check Capacitor Filesystem cache
  const cached = await filesystemCache.getCached(url);
  if (cached) return cached;

  // Download and cache
  const response = await originalFetch(input, init);
  await filesystemCache.setCached(url, response.clone());
  return response;
}

// Override global fetch
globalThis.fetch = cachedFetch;
```

### Why This Works

1. **Capacitor Filesystem**: Persists across app updates (unlike Cache API)
2. **Fetch Interception**: Transparent to Transformers.js
3. **Simple**: No complex chunking or deduplication
4. **Reliable**: Standard file operations

### Cache Storage Location
```
Documents/transformers-cache/
  ├── model-files/
  │   ├── 7a3c9f1e... (hashed URL)
  │   ├── 9d2e4b8a...
  │   └── ...
  └── cache-index.json
```

**Persistence**: ✅ Survives app updates
**Size Limit**: ✅ No iOS 10MB limit (uses app Documents directory)
**Offline Access**: ✅ Works without network

---

## Appendix C: Progress Tracking Implementation

### Problem: Multi-File Download Progress

Transformers.js downloads **multiple files** per model:
- `config.json` (~2KB)
- `tokenizer.json` (~500KB)
- `model_quantized.onnx` (~250MB) ← Main file
- `model.onnx_data` (if split)

**Challenge**: Show single progress bar for entire model download.

### Current Solution (Fixed)

```typescript
// Calculate aggregated progress across all files
function calculateAggregatedProgress(): number {
  let totalBytes = 0;
  let loadedBytes = 0;

  for (const [url, progress] of fileProgressMap) {
    // Only include files with known sizes
    if (progress.total > 0) {
      totalBytes += progress.total;
      loadedBytes += progress.loaded;
    }
  }

  return totalBytes > 0 ? loadedBytes / totalBytes : 0;
}
```

**Key Insight**: Exclude files without known sizes (`total === 0`) to prevent small files from dominating progress calculation before large files report sizes.

### Result
- ✅ Smooth, monotonic progress (0% → 100%)
- ✅ Accurate size-weighted progress
- ✅ Debounced UI updates (100ms interval)

**Conclusion**: HTTP progress tracking is **solved** - no need for XET.

---

**END OF REPORT**
