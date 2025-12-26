# Transformers.js v3 + WebGPU for Gemma 3 270M: Technical Research

**Date**: 2025-12-26
**Purpose**: Validate technical approach for integrating Transformers.js v3 with WebGPU for local AI inference in a Capacitor iOS app.

---

## Table of Contents

1. [Transformers.js v3 WebGPU Setup](#1-transformersjs-v3-webgpu-setup)
2. [Model Selection: Gemma 3 270M](#2-model-selection-gemma-3-270m)
3. [Known Issues and Gotchas](#3-known-issues-and-gotchas)
4. [Web Worker Integration](#4-web-worker-integration)
5. [Caching and Offline Support](#5-caching-and-offline-support)
6. [iOS WKWebView Specifics](#6-ios-wkwebview-specifics)
7. [Recommendations](#7-recommendations)
8. [Sources](#8-sources)

---

## 1. Transformers.js v3 WebGPU Setup

### Installation

```bash
pnpm add @huggingface/transformers
```

> **Note**: v3 moved from `@xenova/transformers` to `@huggingface/transformers`. This is a breaking change from v2.

### Basic Import and Pipeline API

```javascript
import { pipeline, TextStreamer } from "@huggingface/transformers";

// Create a text generation pipeline with WebGPU
const generator = await pipeline(
  "text-generation",
  "onnx-community/gemma-3-270m-it-ONNX",
  {
    dtype: "fp32",  // or "q4", "fp16", "q4f16"
    device: "webgpu"
  }
);
```

### Device Configuration Options

| Option | Description |
|--------|-------------|
| `"webgpu"` | GPU-accelerated computation via WebGPU API |
| `"wasm"` | WebAssembly fallback (CPU) |
| `undefined` | Defaults to WASM |

### dtype Configuration Options

| dtype | Description | Use Case |
|-------|-------------|----------|
| `"fp32"` | Full precision (32-bit float) | Maximum accuracy, largest memory |
| `"fp16"` | Half precision (16-bit float) | Good balance for WebGPU |
| `"q8"` | 8-bit quantized | WASM default |
| `"q4"` | 4-bit quantized | Smallest, may have issues |
| `"q4f16"` | 4-bit with fp16 compute | Fixed for some Gemma models |

### Per-Module dtype (Advanced)

For complex models like Florence-2:

```javascript
const model = await Florence2ForConditionalGeneration.from_pretrained(
  "onnx-community/Florence-2-base-ft",
  {
    dtype: {
      embed_tokens: "fp16",
      vision_encoder: "fp16",
      encoder_model: "q4",
      decoder_model_merged: "q4",
    },
    device: "webgpu",
  }
);
```

### Environment Configuration

```javascript
import { env } from "@huggingface/transformers";

// Check WebGPU availability
console.log("WebGPU available:", await env.backends.onnx.webgpu.isSupported());

// Configure caching
env.useBrowserCache = true;  // Use Cache API (default: true if available)
env.allowRemoteModels = true; // Allow HF Hub downloads
env.localModelPath = "/models/"; // For bundled models

// WASM configuration
env.backends.onnx.wasm.numThreads = 4;
```

---

## 2. Model Selection: Gemma 3 270M

### Model Availability

**Repository**: [onnx-community/gemma-3-270m-it-ONNX](https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX)

| Property | Value |
|----------|-------|
| **Gated?** | No - Non-gated, publicly accessible |
| **License** | Gemma License ([terms](https://ai.google.dev/gemma/terms)) |
| **Context Window** | 32K tokens (smaller than 4B/12B/27B which have 128K) |
| **Training Data** | 6 trillion tokens, knowledge cutoff August 2024 |
| **Variants** | 61 quantized variants available |

### Usage Example

```javascript
import { pipeline, TextStreamer } from "@huggingface/transformers";

const generator = await pipeline(
  "text-generation",
  "onnx-community/gemma-3-270m-it-ONNX",
  { dtype: "fp32" }  // Start with fp32, see issues below
);

const messages = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Write a poem about machine learning." },
];

const output = await generator(messages, {
  max_new_tokens: 512,
  do_sample: false,
  streamer: new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
  }),
});

console.log(output[0].generated_text.at(-1).content);
```

### Larger Alternative: Gemma 3 1B

For better quality (but larger download):
- **Repository**: [onnx-community/gemma-3-1b-it-ONNX-GQA](https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX-GQA)
- Uses GQA (Grouped Query Attention) for efficiency
- **Warning**: Has known JSEP crash issues with some quantizations

---

## 3. Known Issues and Gotchas

### Critical: Gemma 3 + WebGPU JSEP Crashes

**Issue**: [huggingface/transformers.js#1469](https://github.com/huggingface/transformers.js/issues/1469)

Loading Gemma 3 1B with `device: "webgpu"` or `device: "wasm"` can cause JSEP (JavaScript Execution Provider) crashes.

**Symptoms**:
- Cryptic error: `"3436070408"` (just a number)
- Or: `"Aborted(). Build with -sASSERTIONS for more info. RuntimeError: Aborted()"`

**Root Cause**: The embedding layer is "extremely large," causing buffer size/memory allocation failures in WebAssembly/WebGPU runtime.

**Affected Quantizations** (for 1B model):

| Quantization | Status |
|--------------|--------|
| `q4` | BROKEN - Buffer size issues |
| `fp32` | BROKEN - Buffer size limitations |
| `q4f16` | WORKING - Re-uploaded fix |
| `fp16` | WORKING - Re-uploaded fix |

**Workaround**: Use `dtype: "q4f16"` or `dtype: "fp16"` instead of `q4` for Gemma 3 models.

### Float16 Precision Issues in Gemma 3

**Issue**: [huggingface/transformers#36822](https://github.com/huggingface/transformers/issues/36822)

Gemma 3 activations can exceed float16's maximum range (65504), causing NaN/infinity issues.

**Impact**: On devices without native fp32 compute (like Tesla T4), you may encounter:
- NaN outputs
- Infinity values in computations

**Note**: Gemma 3n does NOT have this activation issue, but infinities can still occur.

### GitHub Issue microsoft/onnxruntime#26732

**Status**: Could not locate this specific issue. The closest related issues are:
- General fp16 conversion issues in ONNX Runtime
- fp16 performance not being optimized the same way as fp32

### Community Compatibility Tracker

The Transformers.js team maintains a [support tracker](https://transformers-js-support.vercel.app/) documenting model compatibility across quantization levels.

---

## 4. Web Worker Integration

### Why Web Workers?

- ML inference is computationally intensive
- Running on main thread blocks UI rendering
- Web Workers run in separate threads, keeping UI responsive
- Essential for good UX during model loading (can take minutes)

### Worker Architecture Pattern

**worker.js**:
```javascript
import { pipeline, TextStreamer } from "@huggingface/transformers";

// Singleton pattern for lazy model loading
class PipelineSingleton {
  static task = "text-generation";
  static model = "onnx-community/gemma-3-270m-it-ONNX";
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, {
        dtype: "fp32",
        device: "webgpu",
        progress_callback,
      });
    }
    return this.instance;
  }
}

// Listen for messages from main thread
self.addEventListener("message", async (event) => {
  const { type, data } = event.data;

  if (type === "generate") {
    // Initialize pipeline with progress reporting
    const generator = await PipelineSingleton.getInstance((x) => {
      self.postMessage({ type: "progress", data: x });
    });

    // Stream output tokens back to main thread
    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text) => {
        self.postMessage({ type: "token", data: text });
      },
    });

    // Generate response
    const output = await generator(data.messages, {
      max_new_tokens: data.maxTokens || 512,
      do_sample: false,
      streamer,
    });

    // Send completion
    self.postMessage({
      type: "complete",
      data: output[0].generated_text.at(-1).content,
    });
  }

  if (type === "abort") {
    // TODO: Implement cancellation
    // Currently no built-in abort mechanism in Transformers.js
  }
});
```

**main.js** (React example):
```javascript
import { useEffect, useRef, useState } from "react";

function useLocalAI() {
  const worker = useRef(null);
  const [progress, setProgress] = useState(null);
  const [output, setOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Create worker
    worker.current = new Worker(
      new URL("./worker.js", import.meta.url),
      { type: "module" }
    );

    // Handle messages from worker
    worker.current.addEventListener("message", (e) => {
      const { type, data } = e.data;

      switch (type) {
        case "progress":
          // Progress data: { status, file, progress, loaded, total }
          if (data.status === "downloading") {
            setProgress({
              file: data.file,
              percent: Math.round((data.loaded / data.total) * 100),
            });
          }
          break;
        case "token":
          setOutput((prev) => prev + data);
          break;
        case "complete":
          setIsGenerating(false);
          break;
      }
    });

    return () => worker.current?.terminate();
  }, []);

  const generate = (messages, maxTokens = 512) => {
    setOutput("");
    setIsGenerating(true);
    worker.current.postMessage({
      type: "generate",
      data: { messages, maxTokens },
    });
  };

  return { generate, progress, output, isGenerating };
}
```

### Progress Callback Data Structure

```javascript
{
  status: "downloading" | "done" | "loading" | "ready",
  file: "model.onnx",      // Current file being downloaded
  progress: 45.5,          // Percentage (0-100)
  loaded: 123456789,       // Bytes loaded
  total: 274000000,        // Total bytes
  name: "model_name"       // Model identifier
}
```

### Cancellation Pattern

Transformers.js doesn't have built-in abort. Workaround:

```javascript
// Worker-side: Check abort flag periodically
let abortRequested = false;

self.addEventListener("message", (e) => {
  if (e.data.type === "abort") {
    abortRequested = true;
  }
});

// In streamer callback
const streamer = new TextStreamer(generator.tokenizer, {
  callback_function: (text) => {
    if (abortRequested) {
      throw new Error("Generation aborted");
    }
    self.postMessage({ type: "token", data: text });
  },
});
```

---

## 5. Caching and Offline Support

### Browser Cache API

Transformers.js uses the Web [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache) for model storage.

```javascript
import { env } from "@huggingface/transformers";

// Default: true if Cache API available
env.useBrowserCache = true;

// Custom cache (must implement match/put from Cache API)
env.useCustomCache = true;
env.customCache = {
  async match(request) {
    // Return cached Response or undefined
  },
  async put(request, response) {
    // Store response
  },
};
```

### Cache Persistence

- Models cached in browser storage persist across sessions
- Cache size depends on browser/device (typically several GB available)
- Use `caches.delete()` to clear if needed

### Offline / Bundled Models

For truly offline operation (no initial download):

```javascript
import { env } from "@huggingface/transformers";

// Disable remote model fetching
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";  // Served from app bundle

// Models must be pre-downloaded and bundled with app
```

**Bundling Strategy**:
1. Download model files from HF Hub
2. Place in `public/models/` or equivalent
3. Configure Vite/bundler to serve them
4. Set `env.localModelPath` accordingly

**Considerations for Capacitor**:
- Model files can be 100MB-1GB+
- App bundle size increases significantly
- Consider downloading on first launch instead

### First-Run Download Pattern

```javascript
async function ensureModelCached() {
  const cacheKey = "gemma-3-270m-cached";

  if (localStorage.getItem(cacheKey)) {
    return; // Already cached
  }

  // Load model (triggers download and caching)
  await pipeline(
    "text-generation",
    "onnx-community/gemma-3-270m-it-ONNX",
    {
      progress_callback: (p) => updateUI(p),
    }
  );

  localStorage.setItem(cacheKey, "true");
}
```

---

## 6. iOS WKWebView Specifics

### WebGPU Support Timeline

| iOS Version | Safari | WKWebView | Status |
|-------------|--------|-----------|--------|
| iOS 17.4 | Feature Flag | NO | Early preview only |
| iOS 18.2 | Feature Flag | NO | Safari-only, not WKWebView |
| **iOS 26** | **Enabled by default** | **TBD** | Safari confirmed, WKWebView needs testing |

### Critical WKWebView Limitation

**From [Apple Developer Forums](https://developer.apple.com/forums/thread/770862)**:

> WebGPU feature flags only impact Safari and not WebKit generally. For WKWebView, the feature will work when it's enabled by default.

**Translation**: Even with iOS 18.2's WebGPU support in Safari, Capacitor apps using WKWebView do NOT get WebGPU automatically.

### iOS 26 Expectations

- WebGPU is enabled by default in Safari 26 (iOS 26)
- Apple recommends testing on iOS 26 beta for WKWebView support
- The distinction between "Safari support" and "WKWebView support" is crucial

### Capacitor Configuration

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  // ... existing config
  ios: {
    // WKWebView is used by default (not UIWebView)
    webContentsDebuggingEnabled: true, // For debugging WebGPU issues
  },
};
```

### Fallback Strategy

```javascript
async function initializeAI() {
  const webgpuAvailable = await env.backends.onnx.webgpu.isSupported();

  if (webgpuAvailable) {
    console.log("Using WebGPU acceleration");
    return pipeline("text-generation", model, { device: "webgpu" });
  } else {
    console.log("Falling back to WASM");
    return pipeline("text-generation", model, { device: "wasm" });
  }
}
```

### Memory Limits

iOS WKWebView has strict memory limits:
- **Watchdog**: System may kill app if memory usage spikes
- **Limits vary**: Based on device, iOS version, background state
- **Recommendation**: Use smaller models (270M vs 1B) and quantized dtypes

### Recommended Testing Matrix

| Test Case | iOS 18 | iOS 26 Beta |
|-----------|--------|-------------|
| WebGPU detection in WKWebView | Expect: false | Test: maybe true |
| WASM fallback | Should work | Should work |
| Model loading time | Baseline | Compare |
| Memory usage during inference | Monitor | Monitor |
| Thermal throttling | Test on device | Test on device |

---

## 7. Recommendations

### Immediate Implementation Plan

1. **Start with WASM backend** - guaranteed to work across iOS versions
2. **Use fp32 dtype** for Gemma 3 270M - avoid known q4 issues
3. **Implement Web Worker** - prevent UI blocking
4. **Add progress UI** - model download can take minutes
5. **Test on real iOS devices** - simulator may behave differently

### Code Architecture

```
src/
  services/
    localAI/
      worker.ts          # Web Worker for inference
      useLocalAI.ts      # React hook for main thread
      modelManager.ts    # Cache/download management
      types.ts           # TypeScript interfaces
```

### Graceful Degradation

```javascript
export async function getAIProvider(): Promise<"webgpu" | "wasm" | "cloud"> {
  // Check WebGPU first
  if (await env.backends.onnx.webgpu.isSupported()) {
    return "webgpu";
  }

  // Check if device can handle local inference
  const isLowEndDevice = navigator.deviceMemory < 4; // API may not be available
  if (isLowEndDevice) {
    return "cloud"; // Fall back to OpenAI/Anthropic
  }

  return "wasm";
}
```

### Model Selection Decision Tree

```
Is this iOS 26+ with WKWebView WebGPU?
├── YES → Use WebGPU + fp16/q4f16 for speed
└── NO →
    Is device memory >= 4GB?
    ├── YES → Use WASM + fp32 for accuracy
    └── NO → Fall back to cloud API
```

### Future Considerations

1. **iOS 26 release** (Fall 2025): Re-test WKWebView WebGPU support
2. **Model updates**: Monitor onnx-community for new quantizations
3. **Transformers.js updates**: Track issue #1469 for JSEP crash fixes
4. **Gemma 3n**: Consider as alternative without fp16 activation issues

---

## 8. Sources

### Official Documentation

- [Transformers.js v3 Announcement](https://huggingface.co/blog/transformersjs-v3)
- [Transformers.js WebGPU Guide](https://huggingface.co/docs/transformers.js/guides/webgpu)
- [Transformers.js Environment API](https://huggingface.co/docs/transformers.js/api/env)
- [Transformers.js v3 Release Notes](https://github.com/huggingface/transformers.js/releases/tag/3.0.0)
- [GitHub Repository](https://github.com/huggingface/transformers.js)

### Model Resources

- [onnx-community/gemma-3-270m-it-ONNX](https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX)
- [onnx-community/gemma-3-1b-it-ONNX-GQA](https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX-GQA)
- [Transformers.js Model Support Tracker](https://transformers-js-support.vercel.app/)

### Issue Trackers

- [WebGPU JSEP Crash - Issue #1469](https://github.com/huggingface/transformers.js/issues/1469)
- [Gemma 3 fp16 Issues - transformers#36822](https://github.com/huggingface/transformers/issues/36822)

### iOS/WebGPU

- [WebGPU Browser Support - web.dev](https://web.dev/blog/webgpu-supported-major-browsers)
- [Safari 26 Beta - WebKit Blog](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
- [WebGPU in iOS 26](https://appdevelopermagazine.com/webgpu-in-ios-26/)
- [WKWebView WebGPU Discussion](https://developer.apple.com/forums/thread/770862)
- [Can I Use - WebGPU](https://caniuse.com/webgpu)
- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)

### Tutorials

- [Client-Side AI with Transformers.js and Web Workers](https://medium.com/techhappily/client-side-ai-with-transformers-js-next-js-and-web-worker-threads-259f6d955918)
- [Transformers.js + ONNX Runtime WebGPU](https://medium.com/@GenerationAI/transformers-js-onnx-runtime-webgpu-46c3e58d547c)
- [Running SmolVLM in Browser with Transformers.js](https://pyimagesearch.com/2025/10/20/running-smolvlm-locally-in-your-browser-with-transformers-js/)
