# Gemma 3 270M On-Device Mobile Inference Research

**Date:** December 25, 2025
**Research Goal:** Evaluate feasibility of running Google's Gemma 3 270M model locally in a React + Capacitor iOS/Android app

---

## Executive Summary

**Recommendation: HYBRID APPROACH with cautious optimism**

Gemma 3 270M (270 million parameters) is technically feasible for on-device deployment in mobile apps, but **Capacitor's current lack of WebGPU support** is a critical blocker for browser-based approaches. The recommended path forward is:

1. **Short-term:** Continue with cloud APIs (OpenAI/Anthropic) for production
2. **Medium-term:** Experiment with native plugin approach using MediaPipe LLM Inference API
3. **Long-term:** Monitor WebGPU support in Capacitor and evaluate browser-based solutions when available

**Key Constraint:** WebGPU (essential for performant browser-based inference) is NOT currently supported in Capacitor's WebView on iOS/Android, despite being available in Safari and Chrome mobile browsers.

---

## 1. Model Overview: Gemma 3 270M

### Model Characteristics
- **Parameters:** 270M total (170M embeddings + 100M transformer blocks)
- **Vocabulary:** 256k tokens (large vocabulary for rare/specific tokens)
- **Design Philosophy:** Built for hyper-efficient, task-specific fine-tuning
- **Target Platforms:** Phones, Raspberry Pi, web runtimes, lightweight servers
- **Release Date:** August 2025 (very recent)

### Model Size After Quantization
| Format | Size | Use Case |
|--------|------|----------|
| Full Precision (FP16) | ~500 MB | Desktop/high-end devices |
| INT8 Quantized | ~270 MB | Balanced mobile deployment |
| INT4 Quantized (Q4_0) | **~125-241 MB** | **Optimal for mobile** |
| GGUF Q4_K_M | ~241 MB | llama.cpp compatible |

**Sources:**
- [Introducing Gemma 3 270M (Google Developers Blog)](https://developers.googleblog.com/en/introducing-gemma-3-270m/)
- [google/gemma-3-270m (Hugging Face)](https://huggingface.co/google/gemma-3-270m)
- [Gemma 3 270M Guide (DataCamp)](https://www.datacamp.com/tutorial/gemma-3-270m)

---

## 2. Performance Benchmarks: Mobile Devices

### Battery Efficiency (Pixel 9 Pro)
- **INT4 quantized:** 0.75% battery for 25 conversations
- **Result:** Google's most power-efficient Gemma model
- **Conclusion:** Negligible battery impact for typical usage

### Inference Speed
- **Latency:** 50-200ms per token on modern mobile devices
- **Model Loading:** Depends on deployment strategy (see Section 6)
- **Performance:** Optimized for "hyper-efficient workloads"

### Memory Requirements
- **Runtime Memory (INT4):** ~125-241 MB
- **App Size Increase:** ~130 MB
- **iOS/Android Target:** Modern devices (iPhone 12+, Android 12+)

### Platform-Specific Performance
- **Android (Pixel 9 Pro):** Verified to run efficiently with INT4 quantization
- **iOS:** No specific benchmarks found, but model size/architecture suitable
- **Conclusion:** Modern flagship phones (2023+) should handle it well

**Sources:**
- [Introducing Gemma 3 270M (Google Developers Blog)](https://developers.googleblog.com/en/introducing-gemma-3-270m/)
- [Gemma 3 270M: Compact model (Simon Willison)](https://simonwillison.net/2025/Aug/14/gemma-3-270m/)
- [Google Gemma 3 270M on phones (eWeek)](https://www.eweek.com/news/google-gemma-3-270m/)

---

## 3. Integration Approaches: Technical Analysis

### A. Browser-Based (WebAssembly + WebGPU)

#### Transformers.js (Hugging Face)
**Status:** ✅ Gemma 3 270M ONNX model available

**Pros:**
- Official ONNX model: `onnx-community/gemma-3-270m-it-ONNX`
- Web Worker support for non-blocking UI
- Existing React integration patterns
- Active community, well-documented
- Zero server costs

**Cons:**
- ❌ **CRITICAL:** Capacitor WebView does NOT support WebGPU (as of Dec 2025)
- Requires Chrome-like browsers for WebGPU (works in Safari on iOS, Chrome on Android, but NOT in Capacitor)
- CPU-only fallback would be too slow for 270M model
- Model download size (~125-241 MB) on first use

**Technical Details:**
```typescript
// Installation
npm install @huggingface/transformers

// Usage pattern (Web Worker recommended)
import { pipeline } from '@huggingface/transformers';

const generator = await pipeline('text-generation',
  'onnx-community/gemma-3-270m-it-ONNX',
  { device: 'webgpu' }  // ❌ NOT available in Capacitor WebView
);
```

**Real-World Example:** Bedtime Story Generator demo using Transformers.js + Gemma 3 270M

**Verdict for Capacitor:** ⚠️ **NOT VIABLE** until Capacitor adds WebGPU support

**Sources:**
- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js/en/index)
- [onnx-community/gemma-3-270m-it-ONNX](https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX)
- [Building a React application (Transformers.js)](https://huggingface.co/docs/transformers.js/en/tutorials/react)

---

#### WebLLM (MLC AI)
**Status:** ⚠️ Gemma 2 supported, Gemma 3 requested (Issue #675, Mar 2025)

**Pros:**
- High-performance WebGPU acceleration
- OpenAI-compatible API
- Web Worker + Service Worker support
- Model caching for offline use
- Retains up to 80% native performance
- Cross-platform SDK (iOS, Android, Web)

**Cons:**
- ❌ **CRITICAL:** Same WebGPU limitation in Capacitor
- Gemma 3 270M not officially supported yet (community request exists)
- Larger bundle size than Transformers.js
- More complex setup

**Technical Details:**
```typescript
// Installation
npm install @mlc-ai/web-llm

// Usage pattern
import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("gemma-3-270m-q4", {
  // ❌ Requires WebGPU - not available in Capacitor
});
```

**Verdict for Capacitor:** ⚠️ **NOT VIABLE** (same WebGPU limitation) + model support pending

**Sources:**
- [WebLLM GitHub](https://github.com/mlc-ai/web-llm)
- [WebLLM: High-Performance In-Browser LLM Inference (arXiv)](https://arxiv.org/html/2412.15803v1)
- [Model Request: Gemma 3 (GitHub Issue #675)](https://github.com/mlc-ai/web-llm/issues/675)

---

### B. Native Plugin Approach

#### MediaPipe LLM Inference API (Google)
**Status:** ✅ Officially supports Gemma models on mobile

**Pros:**
- ✅ **WORKS in Capacitor** (native iOS/Android SDKs)
- Official Google support for Gemma models
- React Native bindings available
- Optimized for on-device inference
- Supports iOS, Android, AND Web
- No WebGPU dependency (uses Metal on iOS, Vulkan on Android)

**Cons:**
- Requires writing native Capacitor plugin
- More complex integration than browser-based
- Separate implementations for iOS/Android
- Larger initial development effort

**Available React Native Libraries:**
1. **expo-llm-mediapipe** (Expo-compatible)
   - Bridges React Native ↔ MediaPipe
   - Supports Gemma, Phi 2, Falcon, Stable LM
   - Works offline with privacy

2. **react-native-llm-mediapipe** (vanilla RN)
   - Similar functionality
   - Direct MediaPipe integration

**Technical Details:**
```bash
# For Expo apps
npm install expo-llm-mediapipe

# For React Native apps
npm install react-native-llm-mediapipe
```

**Capacitor Integration Path:**
1. Create custom Capacitor plugin
2. Use MediaPipe iOS SDK (Swift) + Android SDK (Kotlin)
3. Expose JavaScript bridge for React
4. Handle model loading/caching in native code

**Verdict for Capacitor:** ✅ **VIABLE** but requires native development

**Sources:**
- [LLM Inference Guide (Google AI Edge)](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference)
- [expo-llm-mediapipe (GitHub)](https://github.com/tirthajyoti-ghosh/expo-llm-mediapipe)
- [react-native-llm-mediapipe (GitHub)](https://github.com/cdiddy77/react-native-llm-mediapipe)
- [Deploy Gemma on mobile devices (Google AI)](https://ai.google.dev/gemma/docs/integrations/mobile)

---

#### TensorFlow Lite (Alternative)
**Status:** Possible but more work than MediaPipe

**Pros:**
- Mature ecosystem
- Native iOS/Android support
- Capacitor plugin feasible

**Cons:**
- Requires model conversion to TFLite format
- More manual optimization needed
- MediaPipe is higher-level abstraction

**Verdict:** ⚠️ **VIABLE** but MediaPipe is better choice for LLMs

---

### C. ONNX Runtime Web/Mobile
**Status:** Supports INT4/INT8 quantization

**Pros:**
- Official Gemma 3 270M ONNX models available
- Supports INT4 quantization (8x compression)
- Mobile-optimized ARM64 kernels
- Used by Transformers.js under the hood

**Cons:**
- Browser version requires WebGPU (same limitation)
- Mobile version requires native integration
- Less documentation than MediaPipe for mobile LLMs

**Verdict:** ⚠️ **CONSIDER** if Transformers.js isn't sufficient, but MediaPipe likely easier

**Sources:**
- [Quantize ONNX models (ONNX Runtime)](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html)
- [ONNX: 4 bit integer types](https://onnx.ai/onnx/technical/int4.html)

---

## 4. Model Availability & Formats

### Hugging Face Repositories

| Repository | Format | Quantization | Size | Use Case |
|------------|--------|--------------|------|----------|
| `google/gemma-3-270m` | PyTorch | None | ~500 MB | Base model |
| `google/gemma-3-270m-it` | PyTorch | None | ~500 MB | Instruction-tuned |
| `onnx-community/gemma-3-270m-it-ONNX` | ONNX | Multiple | Varies | Transformers.js |
| `unsloth/gemma-3-270m-it-GGUF` | GGUF | Q4, Q8, etc. | ~241 MB | llama.cpp |
| `ggml-org/gemma-3-270m-GGUF` | GGUF | Multiple | Varies | llama.cpp |
| `Durlabh/gemma-270m-q4-k-m-gguf` | GGUF | Q4_K_M | ~241 MB | llama.cpp |

### Conversion Tools
- **LiteRT Notebook:** For MediaPipe deployment (Google-provided)
- **ONNX Notebook:** For Transformers.js deployment (Google-provided)
- **Hugging Face Optimum:** General ONNX conversion

**Official Google Conversion Guide:** [Own your AI: Fine-tune Gemma 3 270M](https://developers.googleblog.com/own-your-ai-fine-tune-gemma-3-270m-for-on-device/)

**Sources:**
- Various Hugging Face model repositories listed above
- [Unsloth Gemma 3 Guide](https://docs.unsloth.ai/models/gemma-3-how-to-run-and-fine-tune)

---

## 5. Privacy & Cost Comparison

### On-Device Inference
**Privacy:**
- ✅ Data never leaves device
- ✅ GDPR/CCPA compliant by design
- ✅ No third-party data sharing
- ✅ Works offline

**Cost:**
- ✅ Zero API costs after model download
- ✅ One-time 125-241 MB download
- ❌ Increased app complexity
- ❌ Development time for native integration

**Performance:**
- ✅ No network latency (save 500-2000ms per request)
- ✅ Works offline
- ❌ Limited to smaller models (270M vs GPT-4's 1.76T parameters)
- ❌ Lower quality for complex tasks

### Cloud APIs (Current Approach)
**Privacy:**
- ⚠️ Data sent to third-party (OpenAI/Anthropic)
- ⚠️ Trust-based privacy
- ❌ Requires internet connection

**Cost:**
- ❌ Per-token pricing (ongoing costs)
- ✅ No upfront development cost
- ✅ Scales easily

**Performance:**
- ✅ Access to largest models (GPT-4, Claude Opus)
- ✅ Better quality for complex tasks
- ❌ Network latency overhead
- ❌ Offline usage impossible

### Hybrid Approach (Recommended for 2026+)
- **Simple tasks:** On-device (Gemma 3 270M) for privacy/speed
- **Complex tasks:** Cloud APIs for quality
- **Auto-fallback:** If on-device fails, use cloud
- **User control:** Let users choose privacy vs. quality

**Sources:**
- [On-Device LLM or Cloud API? (Medium)](https://medium.com/data-science-collective/on-device-llm-or-cloud-api-a-practical-checklist-for-product-owners-and-architects-30386f00f148)
- [Building AI-Powered Mobile Apps (Medium)](https://medium.com/@stepan_plotytsia/building-ai-powered-mobile-apps-running-on-device-llms-in-android-and-flutter-2025-guide-0b440c0ae08b)
- [Cloud LLM vs Local LLMs (AI Multiple)](https://research.aimultiple.com/cloud-llm/)

---

## 6. Implementation Roadmap

### Phase 1: Browser-Based Prototype (When WebGPU Available)
**Goal:** Validate performance with minimal native code

**Requirements:**
- Wait for Capacitor WebGPU support OR test in standalone Safari/Chrome
- Use Transformers.js for rapid prototyping
- Implement Web Worker pattern for non-blocking UI

**Code Example (React + Transformers.js):**
```typescript
// worker.ts - Runs in Web Worker
import { pipeline } from '@huggingface/transformers';

let generator: any = null;

self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  if (type === 'load') {
    generator = await pipeline(
      'text-generation',
      'onnx-community/gemma-3-270m-it-ONNX',
      {
        device: 'webgpu',  // Requires WebGPU
        progress_callback: (progress) => {
          self.postMessage({ type: 'progress', data: progress });
        }
      }
    );
    self.postMessage({ type: 'ready' });
  }

  if (type === 'generate') {
    const result = await generator(data.prompt, {
      max_new_tokens: data.maxTokens || 100,
      temperature: data.temperature || 0.7,
      do_sample: true,
    });
    self.postMessage({ type: 'result', data: result });
  }
});

// App.tsx - React Component
import { useEffect, useRef, useState } from 'react';

export function ChatView() {
  const workerRef = useRef<Worker | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (event) => {
      const { type, data } = event.data;

      if (type === 'progress') {
        setProgress(data.progress * 100);
      }
      if (type === 'ready') {
        setModelLoaded(true);
      }
      if (type === 'result') {
        // Handle generated text
        console.log(data[0].generated_text);
      }
    };

    // Load model
    workerRef.current.postMessage({ type: 'load' });

    return () => workerRef.current?.terminate();
  }, []);

  const generateText = (prompt: string) => {
    if (!modelLoaded) return;

    workerRef.current?.postMessage({
      type: 'generate',
      data: { prompt, maxTokens: 100, temperature: 0.7 }
    });
  };

  return (
    <div>
      {!modelLoaded && <div>Loading model... {progress}%</div>}
      {/* Chat UI */}
    </div>
  );
}
```

**Timeline:** 2-4 weeks (when WebGPU available)
**Risk:** HIGH (depends on Capacitor WebGPU support)

---

### Phase 2: Native Plugin (Recommended Path)
**Goal:** Production-ready on-device inference

**Approach:** MediaPipe LLM Inference API via custom Capacitor plugin

**Implementation Steps:**

#### Step 1: Create Capacitor Plugin
```bash
npm init @capacitor/plugin gemma-inference
cd gemma-inference
```

#### Step 2: iOS Implementation (Swift)
```swift
// GemmaInferencePlugin.swift
import Capacitor
import MediaPipeTasksGenAI

@objc(GemmaInferencePlugin)
public class GemmaInferencePlugin: CAPPlugin {
    private var llmInference: LlmInference?

    @objc func loadModel(_ call: CAPPluginCall) {
        let modelPath = call.getString("modelPath") ?? ""

        let options = LlmInference.Options()
        options.modelPath = modelPath
        options.maxTokens = 512

        do {
            llmInference = try LlmInference(options: options)
            call.resolve(["success": true])
        } catch {
            call.reject("Failed to load model: \(error)")
        }
    }

    @objc func generateText(_ call: CAPPluginCall) {
        guard let llm = llmInference else {
            call.reject("Model not loaded")
            return
        }

        let prompt = call.getString("prompt") ?? ""

        Task {
            do {
                let result = try await llm.generateResponse(inputText: prompt)
                call.resolve(["text": result])
            } catch {
                call.reject("Generation failed: \(error)")
            }
        }
    }
}
```

#### Step 3: Android Implementation (Kotlin)
```kotlin
// GemmaInferencePlugin.kt
package com.cawcaw.gemma

import com.getcapacitor.*
import com.google.mediapipe.tasks.genai.llminference.LlmInference

@CapacitorPlugin(name = "GemmaInference")
class GemmaInferencePlugin : Plugin() {
    private var llmInference: LlmInference? = null

    @PluginMethod
    fun loadModel(call: PluginCall) {
        val modelPath = call.getString("modelPath") ?: ""

        try {
            val options = LlmInference.LlmInferenceOptions.builder()
                .setModelPath(modelPath)
                .setMaxTokens(512)
                .build()

            llmInference = LlmInference.createFromOptions(context, options)
            call.resolve(JSObject().put("success", true))
        } catch (e: Exception) {
            call.reject("Failed to load model: ${e.message}")
        }
    }

    @PluginMethod
    fun generateText(call: PluginCall) {
        val llm = llmInference ?: run {
            call.reject("Model not loaded")
            return
        }

        val prompt = call.getString("prompt") ?: ""

        llm.generateResponseAsync(prompt).addOnSuccessListener { result ->
            call.resolve(JSObject().put("text", result))
        }.addOnFailureListener { e ->
            call.reject("Generation failed: ${e.message}")
        }
    }
}
```

#### Step 4: TypeScript Definitions
```typescript
// definitions.ts
export interface GemmaInferencePlugin {
  loadModel(options: { modelPath: string }): Promise<{ success: boolean }>;
  generateText(options: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string }>;
}
```

#### Step 5: React Integration
```typescript
// useGemmaInference.ts
import { Plugins } from '@capacitor/core';
import { GemmaInferencePlugin } from './definitions';

const { GemmaInference } = Plugins as { GemmaInference: GemmaInferencePlugin };

export function useGemmaInference() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load model on mount
    GemmaInference.loadModel({
      modelPath: 'models/gemma-3-270m-it-q4.bin'
    }).then(() => setIsLoaded(true));
  }, []);

  const generate = async (prompt: string) => {
    if (!isLoaded) throw new Error('Model not loaded');

    const result = await GemmaInference.generateText({
      prompt,
      maxTokens: 100,
      temperature: 0.7
    });

    return result.text;
  };

  return { isLoaded, generate };
}
```

**Timeline:** 6-10 weeks (full implementation + testing)
**Risk:** MEDIUM (requires native development skills)

---

### Phase 3: Streaming Support
**Goal:** Real-time token streaming like current cloud providers

**Challenges:**
- MediaPipe doesn't natively support streaming
- Need to implement chunked generation or callback-based approach
- More complex bridge between native ↔ JavaScript

**Workaround:**
- Generate in chunks (50 tokens at a time)
- Use callbacks to send partial results
- UI displays progressively

**Timeline:** +2-3 weeks on top of Phase 2

---

### Phase 4: Model Management
**Goal:** Download/update models without app updates

**Features:**
- Download models on-demand (vs. bundled in app)
- Model versioning and updates
- Multiple model support (270M, 1B, etc.)
- Cached storage using Capacitor Filesystem API

**Implementation:**
```typescript
// modelManager.ts
import { Filesystem, Directory } from '@capacitor/filesystem';

export class ModelManager {
  static async downloadModel(url: string, filename: string) {
    // Download model to app's data directory
    const response = await fetch(url);
    const blob = await response.blob();

    // Convert to base64 for Capacitor Filesystem
    const base64 = await blobToBase64(blob);

    await Filesystem.writeFile({
      path: `models/${filename}`,
      data: base64,
      directory: Directory.Data
    });

    return `models/${filename}`;
  }

  static async getModelPath(filename: string): Promise<string> {
    const uri = await Filesystem.getUri({
      path: `models/${filename}`,
      directory: Directory.Data
    });
    return uri.uri;
  }
}
```

**Timeline:** +2-4 weeks on top of Phase 2

---

## 7. API Compatibility with Current Setup

### Current Architecture
```typescript
// Current: ChatView.tsx uses AI SDK v5.0
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

const result = await generateText({
  model: openai('gpt-4o-mini'),  // or anthropic('claude-3-5-sonnet')
  messages: [...],
  tools: { /* MCP tools */ }
});
```

### On-Device Integration (Minimal Changes)
```typescript
// Add new provider: Gemma (on-device)
import { GemmaProvider } from '@/providers/gemma';

// Provider factory
const getProvider = (providerName: string) => {
  switch (providerName) {
    case 'openai': return createOpenAI({ apiKey });
    case 'anthropic': return createAnthropic({ apiKey });
    case 'gemma': return new GemmaProvider();  // ← New on-device provider
  }
};

// Usage (same interface)
const result = await generateText({
  model: getProvider('gemma')('gemma-3-270m-it-q4'),
  messages: [...],
  // Note: MCP tools might not work with on-device model
});
```

### Custom Provider Implementation
```typescript
// providers/gemma.ts
import { GemmaInference } from '@/plugins/gemma-inference';

export class GemmaProvider {
  async generateText(options: {
    model: string;
    messages: Message[];
    maxTokens?: number;
  }) {
    // Convert AI SDK format → Gemma prompt format
    const prompt = this.formatPrompt(options.messages);

    // Call native plugin
    const result = await GemmaInference.generateText({
      prompt,
      maxTokens: options.maxTokens || 100
    });

    // Convert back to AI SDK format
    return {
      text: result.text,
      usage: { /* token counts */ }
    };
  }

  private formatPrompt(messages: Message[]): string {
    // Convert chat messages to Gemma's instruction format
    return messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');
  }
}
```

### Settings UI Changes
```typescript
// Settings.tsx - Add Gemma option
const providers = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemma', label: 'Gemma (On-Device)' }  // ← New option
];

// Model selection for Gemma
const gemmaModels = [
  { value: 'gemma-3-270m-it-q4', label: 'Gemma 3 270M (INT4)' },
  // Future: support larger models
];
```

### MCP Tool Compatibility
**Challenge:** On-device models may not support function calling as robustly as cloud models

**Solutions:**
1. **Disable MCP for on-device:** Only use plain chat
2. **Prompt-based tools:** Use ReAct-style prompting instead of native function calling
3. **Hybrid approach:** Use cloud for tool-heavy tasks, on-device for simple chat

---

## 8. Trade-Offs: On-Device vs. Cloud

### Quality
| Task Type | On-Device (270M) | Cloud (GPT-4o Mini) | Cloud (Claude Opus) |
|-----------|------------------|---------------------|---------------------|
| Simple chat | ⭐⭐⭐⭐ (Good) | ⭐⭐⭐⭐⭐ (Excellent) | ⭐⭐⭐⭐⭐ (Excellent) |
| Instruction following | ⭐⭐⭐⭐ (51% IFEval) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Complex reasoning | ⭐⭐ (Limited) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Code generation | ⭐⭐⭐ (Basic) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Long context | ⭐⭐ (Limited) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### Speed
| Metric | On-Device | Cloud |
|--------|-----------|-------|
| First token | 50-200ms | 500-2000ms (network) |
| Tokens/second | ~10-20 (mobile) | ~50-100 (cloud) |
| Offline support | ✅ Yes | ❌ No |

### Cost (Per 1M Tokens)
| Provider | Input Cost | Output Cost | On-Device |
|----------|-----------|-------------|-----------|
| GPT-4o Mini | $0.15 | $0.60 | $0 |
| Claude Sonnet | $3.00 | $15.00 | $0 |
| Gemma 3 270M | **$0** | **$0** | ✅ |

**Break-even:** ~200MB download = ~333k tokens of GPT-4o Mini output

### Privacy
| Feature | On-Device | Cloud |
|---------|-----------|-------|
| Data leaves device | ❌ Never | ✅ Always |
| GDPR compliance | ✅ Automatic | ⚠️ Trust-based |
| Offline usage | ✅ Yes | ❌ No |
| Third-party access | ❌ None | ⚠️ Provider ToS |

### Development Complexity
| Aspect | On-Device (Native) | On-Device (Browser) | Cloud |
|--------|-------------------|---------------------|-------|
| Initial setup | ⭐⭐⭐⭐ (Complex) | ⭐⭐⭐ (Medium) | ⭐ (Easy) |
| Maintenance | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| Platform parity | ⭐⭐⭐ (iOS/Android separate) | ⭐⭐⭐⭐⭐ (Shared JS) | ⭐⭐⭐⭐⭐ |
| Debugging | ⭐⭐⭐ (Native tools) | ⭐⭐⭐⭐ (Browser DevTools) | ⭐⭐⭐⭐⭐ |

---

## 9. Critical Blockers & Risks

### 🚨 CRITICAL: Capacitor WebGPU Support
**Status:** NOT SUPPORTED as of December 2025

- GitHub Issue: [#8044 - Enable WebGPU support in Capacitor apps](https://github.com/ionic-team/capacitor/issues/8044)
- Reported: July 2025
- Impact: Blocks Transformers.js and WebLLM browser-based approaches
- Workaround: Use native MediaPipe plugin instead

**Why this matters:**
- WebGPU is essential for performant LLM inference in browsers
- Safari on iOS and Chrome on Android SUPPORT WebGPU natively
- But Capacitor's WKWebView (iOS) and WebView (Android) do NOT expose WebGPU
- This is an Apple/Google limitation, not Capacitor-specific

**Alternatives:**
1. Wait for Capacitor/iOS/Android to enable WebGPU in WebViews
2. Use native plugins with Metal (iOS) / Vulkan (Android) - this is what MediaPipe does
3. Use Electron instead of Capacitor (desktop only)

---

### ⚠️ Model Quality Limitations
- 270M parameters << GPT-4o's 1.76 trillion parameters
- Expect lower quality for complex tasks
- May require fine-tuning for specific use cases

**Mitigation:**
- Hybrid approach (on-device for simple, cloud for complex)
- User feedback loop to improve prompts
- Consider fine-tuning Gemma 3 270M for your specific domain

---

### ⚠️ Development Complexity
- Native plugin requires Swift (iOS) + Kotlin (Android) knowledge
- More testing surface (3 platforms: iOS, Android, Web)
- Longer development time vs. cloud APIs

**Mitigation:**
- Start with browser prototype (test in Safari/Chrome, not Capacitor)
- Hire mobile developers or pair with team members who know native
- Use MediaPipe's official examples as starting point

---

### ⚠️ User Experience
- 125-241 MB initial download (first use)
- Model loading time (5-15 seconds on first use)
- Potential for "model out of date" if not updated

**Mitigation:**
- Background download with progress indicator
- Cache models locally for instant subsequent loads
- Optional "download on WiFi only" setting

---

## 10. Recommended Implementation Strategy

### Phase 0: Research & Validation (DONE ✅)
- ✅ Evaluate Gemma 3 270M capabilities
- ✅ Identify technical approaches
- ✅ Assess Capacitor limitations

### Phase 1: Browser Prototype (2-3 weeks)
**Goal:** Validate performance WITHOUT Capacitor

1. Create standalone web app (Vite + React)
2. Integrate Transformers.js with Gemma 3 270M ONNX
3. Test in Safari (iOS) and Chrome (Android) on real devices
4. Measure performance, quality, battery usage
5. **Decision point:** Is quality/performance acceptable?

**Deliverable:** Technical proof-of-concept + performance report

---

### Phase 2A: Native Plugin (6-10 weeks) - IF Phase 1 succeeds
**Goal:** Integrate into Capacitor app

1. Create MediaPipe Capacitor plugin (iOS + Android)
2. Implement model loading + inference
3. Add React hooks for easy integration
4. Update Settings UI with "On-Device" option
5. Implement provider abstraction layer
6. Test on real devices (iPhone 12+, Pixel 6+)

**Deliverable:** Beta feature in production app

---

### Phase 2B: Wait for WebGPU (Alternative)
**If:** Capacitor adds WebGPU support before Phase 2A completes

1. Integrate Transformers.js directly (no native plugin needed)
2. Much simpler implementation
3. Shared codebase across platforms

**Monitor:** [Capacitor Issue #8044](https://github.com/ionic-team/capacitor/issues/8044)

---

### Phase 3: Hybrid Mode (2-4 weeks) - After Phase 2
**Goal:** Smart routing between on-device and cloud

1. Add "Model Selection" in Settings:
   - Auto (smart routing)
   - On-Device Only
   - Cloud Only
2. Implement task classifier (simple = on-device, complex = cloud)
3. Fallback logic (if on-device fails, retry with cloud)
4. Usage analytics (track success rate, latency, cost)

**Deliverable:** Fully hybrid AI chat app

---

### Phase 4: Optimization (Ongoing)
1. Fine-tune Gemma 3 270M for your use case
2. Add streaming support
3. Model versioning and updates
4. Multi-model support (270M, 1B, 2B)

---

## 11. Code Examples & Integration Patterns

### Web Worker Pattern (Best Practice for Browser)
```typescript
// gemma-worker.ts
import { pipeline } from '@huggingface/transformers';

let generator: any = null;
let isLoading = false;

self.addEventListener('message', async (event) => {
  const { id, type, data } = event.data;

  try {
    if (type === 'load') {
      if (isLoading || generator) {
        self.postMessage({
          id,
          type: 'error',
          error: 'Model already loading or loaded'
        });
        return;
      }

      isLoading = true;

      generator = await pipeline(
        'text-generation',
        'onnx-community/gemma-3-270m-it-ONNX',
        {
          device: 'webgpu',
          progress_callback: (progress) => {
            self.postMessage({
              id,
              type: 'progress',
              data: {
                status: progress.status,
                loaded: progress.loaded,
                total: progress.total,
                progress: progress.progress
              }
            });
          }
        }
      );

      isLoading = false;
      self.postMessage({ id, type: 'ready' });
    }

    if (type === 'generate') {
      if (!generator) {
        self.postMessage({
          id,
          type: 'error',
          error: 'Model not loaded'
        });
        return;
      }

      const result = await generator(data.prompt, {
        max_new_tokens: data.maxTokens || 100,
        temperature: data.temperature || 0.7,
        top_p: data.topP || 0.9,
        do_sample: true,
        // Streaming not supported in current Transformers.js version
      });

      self.postMessage({
        id,
        type: 'result',
        data: {
          text: result[0].generated_text
        }
      });
    }

    if (type === 'unload') {
      generator = null;
      self.postMessage({ id, type: 'unloaded' });
    }
  } catch (error: any) {
    self.postMessage({
      id,
      type: 'error',
      error: error.message
    });
  }
});
```

```typescript
// useGemmaWorker.ts - React Hook
import { useEffect, useRef, useState, useCallback } from 'react';

interface GenerateOptions {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export function useGemmaWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const callbacksRef = useRef<Map<string, (data: any) => void>>(new Map());

  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker(
      new URL('./gemma-worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (event) => {
      const { id, type, data, error: errorMsg } = event.data;

      if (type === 'progress') {
        setProgress(data.progress || 0);
      }

      if (type === 'ready') {
        setStatus('ready');
        setProgress(100);
      }

      if (type === 'error') {
        setStatus('error');
        setError(errorMsg);
      }

      // Call registered callback
      const callback = callbacksRef.current.get(id);
      if (callback) {
        callback({ type, data, error: errorMsg });
        callbacksRef.current.delete(id);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const loadModel = useCallback(() => {
    if (status !== 'idle') return;

    setStatus('loading');
    setProgress(0);
    setError(null);

    workerRef.current?.postMessage({
      id: 'load',
      type: 'load'
    });
  }, [status]);

  const generateText = useCallback((options: GenerateOptions): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (status !== 'ready') {
        reject(new Error('Model not ready'));
        return;
      }

      const id = `generate-${Date.now()}-${Math.random()}`;

      callbacksRef.current.set(id, ({ type, data, error }) => {
        if (type === 'error') {
          reject(new Error(error));
        } else if (type === 'result') {
          resolve(data.text);
        }
      });

      workerRef.current?.postMessage({
        id,
        type: 'generate',
        data: options
      });
    });
  }, [status]);

  return {
    status,
    progress,
    error,
    loadModel,
    generateText
  };
}
```

```typescript
// ChatView.tsx - Integration Example
import { useGemmaWorker } from '@/hooks/useGemmaWorker';

export function ChatView() {
  const { status, progress, error, loadModel, generateText } = useGemmaWorker();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-load model on mount
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  const handleSend = async () => {
    if (!input.trim() || status !== 'ready') return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      const response = await generateText({
        prompt: input,
        maxTokens: 200,
        temperature: 0.7
      });

      const assistantMessage = { role: 'assistant', content: response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Generation error:', err);
      // Optionally add error message to chat
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-dvh">
      {/* Model Loading Status */}
      {status === 'loading' && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading Gemma 3 270M... {Math.round(progress)}%</span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="p-4 bg-red-50 dark:bg-red-900">
          <span>Error: {error}</span>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.map((msg, i) => (
          <div key={i} className={/* ... */}>
            {msg.content}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          disabled={status !== 'ready' || isGenerating}
          placeholder={
            status === 'ready'
              ? 'Type a message...'
              : 'Loading model...'
          }
        />
      </div>
    </div>
  );
}
```

---

## 12. Performance Optimization Tips

### 1. Model Caching
```typescript
// Cache model in IndexedDB for instant subsequent loads
import { Filesystem, Directory } from '@capacitor/filesystem';

export class ModelCache {
  static async cacheModel(url: string, filename: string) {
    // Check if already cached
    const exists = await this.hasModel(filename);
    if (exists) return;

    // Download and cache
    const response = await fetch(url);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    await Filesystem.writeFile({
      path: `models/${filename}`,
      data: base64,
      directory: Directory.Data
    });
  }

  static async hasModel(filename: string): Promise<boolean> {
    try {
      await Filesystem.stat({
        path: `models/${filename}`,
        directory: Directory.Data
      });
      return true;
    } catch {
      return false;
    }
  }

  static async getModelUri(filename: string): Promise<string> {
    const uri = await Filesystem.getUri({
      path: `models/${filename}`,
      directory: Directory.Data
    });
    return uri.uri;
  }
}
```

### 2. Quantization Selection
```typescript
// Choose quantization based on device capabilities
export function selectOptimalModel(): string {
  const memory = (performance as any).memory?.jsHeapSizeLimit || 0;
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

  if (isMobile && memory < 4 * 1024 * 1024 * 1024) {  // < 4GB
    return 'gemma-3-270m-it-q4';  // INT4 - 125MB
  } else if (memory < 8 * 1024 * 1024 * 1024) {  // < 8GB
    return 'gemma-3-270m-it-q8';  // INT8 - 270MB
  } else {
    return 'gemma-3-270m-it-fp16';  // FP16 - 500MB
  }
}
```

### 3. Batch Processing
```typescript
// Process multiple requests in batch for efficiency
export class GemmaBatchProcessor {
  private queue: Array<{ prompt: string; resolve: (text: string) => void }> = [];
  private processing = false;

  async generate(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.queue.push({ prompt, resolve });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const batch = this.queue.splice(0, 5);  // Process 5 at a time

    // Combine prompts (if model supports batch inference)
    const results = await Promise.all(
      batch.map(({ prompt }) => this.generateSingle(prompt))
    );

    batch.forEach(({ resolve }, i) => resolve(results[i]));
    this.processing = false;

    // Continue with remaining queue
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  private async generateSingle(prompt: string): Promise<string> {
    // Actual generation logic
    return '...';
  }
}
```

---

## 13. Testing Strategy

### Unit Tests
```typescript
// gemma-inference.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { GemmaInference } from '@/plugins/gemma-inference';

describe('GemmaInference', () => {
  beforeAll(async () => {
    await GemmaInference.loadModel({
      modelPath: 'test-models/gemma-3-270m-it-q4.bin'
    });
  });

  it('generates text from prompt', async () => {
    const result = await GemmaInference.generateText({
      prompt: 'What is 2+2?',
      maxTokens: 50
    });

    expect(result.text).toContain('4');
  });

  it('respects max tokens limit', async () => {
    const result = await GemmaInference.generateText({
      prompt: 'Write a long story',
      maxTokens: 10
    });

    const tokenCount = result.text.split(/\s+/).length;
    expect(tokenCount).toBeLessThanOrEqual(15);  // Allow some overhead
  });
});
```

### Integration Tests (Playwright)
```typescript
// e2e/gemma-integration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Gemma On-Device Integration', () => {
  test('loads model and generates response', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Wait for model to load
    await expect(page.getByText(/Loading Gemma/)).toBeVisible();
    await expect(page.getByText(/Loading Gemma/)).toBeHidden({ timeout: 60000 });

    // Send message
    await page.getByPlaceholder('Type a message').fill('Hello!');
    await page.getByRole('button', { name: 'Send' }).click();

    // Wait for response
    await expect(page.getByText(/Hello|Hi|Hey/i)).toBeVisible({ timeout: 10000 });
  });

  test('switches between cloud and on-device', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Open settings
    await page.getByRole('button', { name: 'Settings' }).click();

    // Switch to Gemma
    await page.getByLabel('Provider').selectOption('gemma');
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify on-device mode
    await expect(page.getByText(/On-Device Mode/)).toBeVisible();
  });
});
```

### Performance Tests
```typescript
// performance/gemma-benchmark.ts
import { performance } from 'perf_hooks';
import { GemmaInference } from '@/plugins/gemma-inference';

async function benchmark() {
  const prompts = [
    'What is AI?',
    'Explain quantum computing',
    'Write a haiku about coding',
  ];

  const results = [];

  for (const prompt of prompts) {
    const start = performance.now();

    const result = await GemmaInference.generateText({
      prompt,
      maxTokens: 100
    });

    const end = performance.now();
    const latency = end - start;
    const tokensPerSecond = result.text.split(/\s+/).length / (latency / 1000);

    results.push({
      prompt,
      latency: `${latency.toFixed(2)}ms`,
      tokensPerSecond: tokensPerSecond.toFixed(2),
      outputLength: result.text.length
    });
  }

  console.table(results);
}

benchmark();
```

---

## 14. Final Recommendations

### FOR IMMEDIATE PRODUCTION (Q1 2026):
**❌ DO NOT implement on-device inference yet**

**Reasons:**
1. Capacitor lacks WebGPU support (browser approach blocked)
2. Native plugin requires significant development time (6-10 weeks)
3. Current cloud APIs work well and are proven
4. Team may lack native iOS/Android expertise

**Action:**
- Continue with OpenAI/Anthropic cloud APIs
- Monitor Capacitor WebGPU support (Issue #8044)
- Revisit in Q2/Q3 2026

---

### FOR EXPERIMENTAL/BETA FEATURE (Q2 2026):
**✅ CONSIDER native MediaPipe plugin**

**Conditions:**
1. Have iOS (Swift) + Android (Kotlin) developers available
2. User demand for privacy/offline features is high
3. Willing to invest 8-12 weeks of development time
4. Accept lower quality for on-device vs. cloud

**Implementation Path:**
1. Phase 1: Browser prototype (Safari/Chrome only) - 2 weeks
2. Phase 2: MediaPipe Capacitor plugin - 8 weeks
3. Phase 3: Hybrid routing logic - 3 weeks
4. Phase 4: Beta release with opt-in - 1 week

**Total Timeline:** ~14 weeks (3.5 months)

---

### FOR FUTURE EXPLORATION (2026+):
**✅ WAIT for WebGPU in Capacitor**

**Advantages when available:**
- Pure JavaScript implementation (no native code)
- Shared codebase across iOS, Android, Web
- Faster development (~2-4 weeks vs. 8-12 weeks)
- Easier maintenance

**Monitoring:**
- Subscribe to [Capacitor Issue #8044](https://github.com/ionic-team/capacitor/issues/8044)
- Test quarterly in Capacitor beta releases
- Evaluate alternative frameworks (Electron, Tauri) if WebGPU is priority

---

## 15. Conclusion

**Gemma 3 270M is technically feasible** for on-device deployment in mobile apps, with excellent performance characteristics (125MB INT4 model, 50-200ms latency, <1% battery usage). However, **Capacitor's current WebGPU limitation** makes browser-based approaches non-viable.

**Recommended Strategy:**
1. **Short-term:** Stick with cloud APIs (OpenAI/Anthropic)
2. **Medium-term:** Build native MediaPipe plugin IF privacy/offline is critical
3. **Long-term:** Migrate to browser-based approach when WebGPU is available

**Expected Timeline for Native Approach:**
- Research & Validation: ✅ Done (this document)
- Browser Prototype: 2-3 weeks
- Native Plugin Development: 6-10 weeks
- Integration & Testing: 2-3 weeks
- **Total: ~14-16 weeks** (3.5-4 months)

**Cost-Benefit Analysis:**
- **Development Cost:** 400-600 hours ($40k-$75k at $100/hr)
- **Ongoing Savings:** $0/user (vs. cloud API costs)
- **Privacy Benefit:** High (data never leaves device)
- **Break-even:** Depends on usage patterns, but likely not cost-effective unless privacy is primary driver

**Final Verdict:**
On-device inference with Gemma 3 270M is a **strategic investment in privacy and user control**, not a cost-saving measure. Proceed only if these values align with product vision and user demand.

---

## Sources

All research is based on December 2025 information from the following sources:

- [Introducing Gemma 3 270M (Google Developers Blog)](https://developers.googleblog.com/en/introducing-gemma-3-270m/)
- [google/gemma-3-270m (Hugging Face)](https://huggingface.co/google/gemma-3-270m)
- [Own your AI: Fine-tune Gemma 3 270M (Google Developers Blog)](https://developers.googleblog.com/own-your-ai-fine-tune-gemma-3-270m-for-on-device/)
- [Gemma 3 270M Guide (DataCamp)](https://www.datacamp.com/tutorial/gemma-3-270m)
- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js/en/index)
- [WebLLM GitHub Repository](https://github.com/mlc-ai/web-llm)
- [WebLLM: High-Performance In-Browser LLM Inference (arXiv)](https://arxiv.org/html/2412.15803v1)
- [MediaPipe LLM Inference Guide (Google AI Edge)](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference)
- [expo-llm-mediapipe (GitHub)](https://github.com/tirthajyoti-ghosh/expo-llm-mediapipe)
- [react-native-llm-mediapipe (GitHub)](https://github.com/cdiddy77/react-native-llm-mediapipe)
- [Capacitor WebGPU Issue #8044](https://github.com/ionic-team/capacitor/issues/8044)
- [ONNX Runtime Quantization](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html)
- [On-Device LLM or Cloud API? (Medium)](https://medium.com/data-science-collective/on-device-llm-or-cloud-api-a-practical-checklist-for-product-owners-and-architects-30386f00f148)
- [Building a React application (Transformers.js)](https://huggingface.co/docs/transformers.js/en/tutorials/react)
- [3W for In-Browser AI: WebLLM + WASM + WebWorkers (Mozilla)](https://blog.mozilla.ai/3w-for-in-browser-ai-webllm-wasm-webworkers/)

---

**Research completed:** December 25, 2025
**Next review:** March 2026 (check Capacitor WebGPU status)
