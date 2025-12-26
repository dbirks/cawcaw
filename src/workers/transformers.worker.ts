/**
 * Transformers.js Web Worker
 *
 * Runs AI inference in a background thread to prevent UI blocking.
 * Handles model loading, text generation, and progress events.
 *
 * Phase 4: Integrated with Capacitor Filesystem cache for persistence across app updates
 */

import {
  env,
  pipeline,
  type TextGenerationOutput,
  type TextGenerationPipeline,
  TextStreamer,
} from '@huggingface/transformers';
import * as filesystemCache from '../utils/filesystemCache';

// Configure Transformers.js environment
env.useBrowserCache = false; // Disable Cache API - we use filesystem cache instead
env.allowRemoteModels = true; // Allow downloading from HuggingFace Hub

// ============================================================================
// Filesystem Cache Integration
// ============================================================================

/**
 * Store the original fetch function before we override it
 */
const originalFetch = globalThis.fetch;

/**
 * Custom fetch implementation that uses Capacitor Filesystem cache
 * Falls back to original fetch if not cached
 */
async function cachedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  // Check filesystem cache first
  const cached = await filesystemCache.getCached(url);
  if (cached) {
    console.log(`[FilesystemCache] Cache hit for: ${url}`);
    return cached;
  }

  console.log(`[FilesystemCache] Cache miss, downloading: ${url}`);

  // Download and cache
  const response = await originalFetch(input, init);

  // Only cache successful responses
  if (response.ok) {
    try {
      // Clone the response before caching since we'll consume it
      const clonedResponse = response.clone();

      // Cache in background (don't await to avoid blocking)
      filesystemCache.setCached(url, clonedResponse).catch((error) => {
        console.error(`[FilesystemCache] Failed to cache ${url}:`, error);
      });
    } catch (error) {
      console.error(`[FilesystemCache] Error during cache operation:`, error);
    }
  }

  return response;
}

// Override global fetch with our cached version
globalThis.fetch = cachedFetch;

// ============================================================================
// Message Protocol Types
// ============================================================================

/**
 * Configuration for loading the AI model
 */
export interface LoadConfig {
  modelId: string; // e.g., 'onnx-community/gemma-3-270m-it-ONNX'
  dtype: 'q4f16' | 'fp16'; // CRITICAL: Avoid q4/fp32 (crashes on WebGPU)
  device: 'webgpu' | 'wasm';
}

/**
 * Options for text generation
 */
export interface GenerateOptions {
  maxNewTokens?: number; // Default: 256
  temperature?: number; // Default: 0.7
  topP?: number; // Default: 0.9
}

/**
 * Statistics about the inference run
 */
export interface InferenceStats {
  totalTokens: number;
  durationMs: number;
  tokensPerSecond: number;
  firstTokenLatencyMs: number;
}

/**
 * Messages sent FROM main thread TO worker
 */
export type WorkerRequest =
  | { type: 'load'; config: LoadConfig }
  | { type: 'generate'; prompt: string; options: GenerateOptions }
  | { type: 'cancel' }
  | { type: 'unload' };

/**
 * Messages sent FROM worker TO main thread
 */
export type WorkerResponse =
  | { type: 'load-progress'; progress: number; stage: string }
  | { type: 'ready' }
  | { type: 'token'; text: string }
  | { type: 'complete'; fullText: string; stats: InferenceStats }
  | { type: 'error'; message: string; stack?: string };

// ============================================================================
// Worker State
// ============================================================================

/**
 * Model pipeline instance
 */
let modelPipeline: TextGenerationPipeline | null = null;

/**
 * Flag to cancel ongoing generation
 */
let isCancelled = false;

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Load the AI model using Transformers.js
 */
async function handleLoad(config: LoadConfig): Promise<void> {
  try {
    // Load the text generation pipeline with progress callbacks
    // Type assertion needed due to complex union type from pipeline()
    // Using double assertion to work around TypeScript's complex union type issue
    modelPipeline = (await pipeline('text-generation', config.modelId, {
      device: config.device,
      dtype: config.dtype,
      progress_callback: (progressData) => {
        // Transform Transformers.js progress format to our protocol
        // ProgressInfo is a union type: InitiateProgressInfo | DownloadProgressInfo | ProgressStatusInfo | DoneProgressInfo | ReadyProgressInfo
        // Only ProgressStatusInfo has the progress field
        // CRITICAL: Transformers.js reports progress as 0-100, not 0-1!
        // We normalize to 0-1 range for consistent internal representation
        let rawProgress = progressData.status === 'progress' ? progressData.progress : 0;

        // Clamp to valid 0-100 range and convert to 0-1
        rawProgress = Math.max(0, Math.min(100, rawProgress));
        const progress = rawProgress / 100;

        const stage = progressData.status;

        self.postMessage({
          type: 'load-progress',
          progress,
          stage,
        } satisfies WorkerResponse);
      },
    })) as unknown as TextGenerationPipeline;

    self.postMessage({ type: 'ready' } satisfies WorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load model';
    const stack = error instanceof Error ? error.stack : undefined;

    self.postMessage({
      type: 'error',
      message,
      stack,
    } satisfies WorkerResponse);
  }
}

/**
 * Generate text from prompt using Transformers.js
 */
async function handleGenerate(prompt: string, options: GenerateOptions): Promise<void> {
  if (!modelPipeline) {
    self.postMessage({
      type: 'error',
      message: 'Model not loaded. Call load() first.',
    } satisfies WorkerResponse);
    return;
  }

  try {
    isCancelled = false;
    const startTime = performance.now();
    let firstTokenTime: number | null = null;
    let tokenCount = 0;

    // Create a TextStreamer for token-by-token output
    const streamer = new TextStreamer(modelPipeline.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        if (isCancelled) {
          throw new Error('Generation cancelled');
        }

        if (!firstTokenTime) {
          firstTokenTime = performance.now();
        }

        tokenCount++;

        self.postMessage({
          type: 'token',
          text,
        } satisfies WorkerResponse);
      },
    });

    // Run text generation with streaming
    const result = await modelPipeline(prompt, {
      max_new_tokens: options.maxNewTokens ?? 256,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.95,
      streamer,
    });

    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const firstTokenLatencyMs = firstTokenTime ? firstTokenTime - startTime : 0;

    // Extract generated text from result
    // Result is TextGenerationOutput (array of TextGenerationSingle)
    // Type assertion to handle complex union type
    const resultArray = result as TextGenerationOutput;
    let fullText = '';
    if (Array.isArray(resultArray) && resultArray.length > 0) {
      const generatedText = resultArray[0].generated_text;
      fullText = typeof generatedText === 'string' ? generatedText : '';
    }

    self.postMessage({
      type: 'complete',
      fullText,
      stats: {
        totalTokens: tokenCount,
        durationMs,
        tokensPerSecond: (tokenCount / durationMs) * 1000,
        firstTokenLatencyMs,
      },
    } satisfies WorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed';
    const stack = error instanceof Error ? error.stack : undefined;

    self.postMessage({
      type: 'error',
      message,
      stack,
    } satisfies WorkerResponse);
  }
}

/**
 * Cancel ongoing generation
 */
function handleCancel(): void {
  isCancelled = true;
}

/**
 * Unload the model and free memory
 */
async function handleUnload(): Promise<void> {
  // Transformers.js pipelines have a dispose method for cleanup
  if (modelPipeline && typeof modelPipeline.dispose === 'function') {
    await modelPipeline.dispose();
  }

  modelPipeline = null;
  isCancelled = false;
}

// ============================================================================
// Worker Message Listener
// ============================================================================

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type } = event.data;

  switch (type) {
    case 'load':
      await handleLoad(event.data.config);
      break;

    case 'generate':
      await handleGenerate(event.data.prompt, event.data.options);
      break;

    case 'cancel':
      handleCancel();
      break;

    case 'unload':
      await handleUnload();
      break;

    default:
      self.postMessage({
        type: 'error',
        message: `Unknown message type: ${type}`,
      } satisfies WorkerResponse);
  }
};
