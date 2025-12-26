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

      // CRITICAL FIX: Await cache operation to ensure files are written
      // before model loading completes. This prevents "download complete
      // but cache shows as empty" bugs.
      console.log(`[FilesystemCache] Starting cache write for: ${url.substring(0, 100)}`);
      await filesystemCache.setCached(url, clonedResponse);
      console.log(`[FilesystemCache] Cache write complete for: ${url.substring(0, 100)}`);
    } catch (error) {
      console.error(`[FilesystemCache] CRITICAL - Failed to cache ${url}:`, error);
      // Don't throw - allow the response to be used even if caching fails
      // This ensures download works even if filesystem has issues
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
  | {
      type: 'load-progress';
      progress: number;
      stage: string;
      downloadSpeed?: string;
      modelName?: string;
      modelSize?: string;
    }
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

/**
 * Progress tracking for multi-file downloads
 * Maps file URLs to their individual progress
 */
interface FileProgress {
  loaded: number;
  total: number;
  progress: number; // 0-1 (normalized from Transformers.js 0-100 range)
}

const fileProgressMap = new Map<string, FileProgress>();
let lastReportedProgress = 0;

/**
 * Download speed tracking
 */
let downloadStartTime: number | null = null;
let totalBytesLoaded = 0;
let currentModelId = '';
let totalModelSize = 0;

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Format bytes to human-readable size (MB or GB)
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB';

  const mb = bytes / 1024 / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(0)} MB`;
  }

  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

/**
 * Extract model name from HuggingFace model ID
 * e.g., "onnx-community/gemma-3-270m-it-ONNX" -> "gemma-3-270m-it"
 */
function extractModelName(modelId: string): string {
  // Remove organization prefix (e.g., "onnx-community/")
  const parts = modelId.split('/');
  const modelPart = parts[parts.length - 1];

  // Remove common suffixes
  return modelPart.replace(/-ONNX$/i, '').replace(/-onnx$/i, '');
}

/**
 * Calculate aggregated progress across all downloaded files
 * Returns a monotonically increasing progress value (0-1)
 *
 * CRITICAL: Only includes files with known sizes (total > 0) to prevent
 * small files from dominating the progress calculation before large files
 * report their sizes.
 */
function calculateAggregatedProgress(): number {
  if (fileProgressMap.size === 0) {
    console.log('[Progress Debug] No files in map, returning 0');
    return 0;
  }

  let totalBytes = 0;
  let loadedBytes = 0;
  let filesWithKnownSizes = 0;

  // Debug: Log all files in the map
  const filesDebug: Array<{
    file: string;
    loaded: number;
    total: number;
    progress: number;
    included: boolean;
  }> = [];

  for (const [fileUrl, fileProgress] of fileProgressMap.entries()) {
    // CRITICAL FIX: Only include files with known sizes (total > 0)
    // This prevents small files from completing before large files report sizes,
    // which would cause progress to jump to 100% prematurely
    const hasKnownSize = fileProgress.total > 0;

    if (hasKnownSize) {
      totalBytes += fileProgress.total;
      loadedBytes += fileProgress.loaded;
      filesWithKnownSizes++;
    }

    filesDebug.push({
      file: fileUrl.split('/').pop() || 'unknown',
      loaded: fileProgress.loaded,
      total: fileProgress.total,
      progress: fileProgress.progress,
      included: hasKnownSize,
    });
  }

  if (totalBytes === 0) {
    console.log(
      '[Progress Debug] Total bytes is 0 (no files with known sizes yet), files:',
      filesDebug
    );
    return 0;
  }

  // Calculate overall progress (0-1 range)
  const overallProgress = loadedBytes / totalBytes;

  // Ensure monotonic increase - never report lower progress than before
  const monotonicProgress = Math.max(overallProgress, lastReportedProgress);

  // Comprehensive debug logging
  console.log('[Progress Debug] Calculation:', {
    filesInMap: fileProgressMap.size,
    filesWithKnownSizes,
    filesDetails: filesDebug,
    totalBytes,
    loadedBytes,
    calculatedProgress: overallProgress,
    lastReportedProgress,
    finalProgress: monotonicProgress,
    isMonotonic: monotonicProgress === lastReportedProgress,
  });

  // Update last reported value
  lastReportedProgress = monotonicProgress;

  return monotonicProgress;
}

/**
 * Debounce timer for progress updates
 */
let progressDebounceTimer: NodeJS.Timeout | null = null;
let hasPendingProgressUpdate = false;

/**
 * Calculate download speed in MB/s
 */
function calculateDownloadSpeed(): string | undefined {
  if (!downloadStartTime || totalBytesLoaded === 0) {
    return undefined;
  }

  const elapsedSeconds = (Date.now() - downloadStartTime) / 1000;
  if (elapsedSeconds < 0.1) {
    // Too early to calculate meaningful speed
    return undefined;
  }

  const speedMBps = totalBytesLoaded / elapsedSeconds / 1024 / 1024;

  // Format based on speed magnitude
  if (speedMBps < 0.1) {
    return `${(speedMBps * 1024).toFixed(0)} KB/s`;
  }

  return `${speedMBps.toFixed(1)} MB/s`;
}

/**
 * Report progress update to main thread with debouncing
 * This reduces the frequency of UI updates and prevents visual flashing
 */
function reportProgress(progress: number, stage: string): void {
  hasPendingProgressUpdate = true;

  if (progressDebounceTimer) {
    clearTimeout(progressDebounceTimer);
  }

  // Debounce to max 10 updates per second (100ms interval)
  progressDebounceTimer = setTimeout(() => {
    if (hasPendingProgressUpdate) {
      const downloadSpeed = calculateDownloadSpeed();
      const modelName = currentModelId ? extractModelName(currentModelId) : undefined;
      const modelSize = totalModelSize > 0 ? formatBytes(totalModelSize) : undefined;

      self.postMessage({
        type: 'load-progress',
        progress,
        stage,
        downloadSpeed,
        modelName,
        modelSize,
      } satisfies WorkerResponse);

      hasPendingProgressUpdate = false;
    }
    progressDebounceTimer = null;
  }, 100);
}

/**
 * Load the AI model using Transformers.js
 */
async function handleLoad(config: LoadConfig): Promise<void> {
  try {
    // Reset progress tracking state for new download
    fileProgressMap.clear();
    lastReportedProgress = 0;
    downloadStartTime = null;
    totalBytesLoaded = 0;
    currentModelId = config.modelId;
    totalModelSize = 0;

    // Load the text generation pipeline with progress callbacks
    // Type assertion needed due to complex union type from pipeline()
    // Using double assertion to work around TypeScript's complex union type issue
    modelPipeline = (await pipeline('text-generation', config.modelId, {
      device: config.device,
      dtype: config.dtype,
      progress_callback: (progressData) => {
        // Transform Transformers.js progress format to our protocol
        // ProgressInfo is a union type: InitiateProgressInfo | DownloadProgressInfo | ProgressStatusInfo | DoneProgressInfo | ReadyProgressInfo
        // Only ProgressStatusInfo has the progress field with loaded/total bytes
        // CRITICAL: Transformers.js reports progress per-file, not overall!
        // We need to aggregate across all files for smooth UX

        console.log('[Progress Debug] Raw event:', {
          status: progressData.status,
          file: 'file' in progressData ? progressData.file : undefined,
          progress: 'progress' in progressData ? progressData.progress : undefined,
          loaded: 'loaded' in progressData ? progressData.loaded : undefined,
          total: 'total' in progressData ? progressData.total : undefined,
        });

        if (progressData.status === 'progress' && 'file' in progressData) {
          const fileUrl = progressData.file;
          const rawProgress = progressData.progress ?? 0;
          const loaded = 'loaded' in progressData ? (progressData.loaded as number) : 0;
          const total = 'total' in progressData ? (progressData.total as number) : 0;

          // Start download timer on first progress event
          if (!downloadStartTime) {
            downloadStartTime = Date.now();
          }

          // Track total bytes loaded across all files
          const previousLoaded = fileProgressMap.get(fileUrl)?.loaded ?? 0;
          const bytesAddedThisUpdate = loaded - previousLoaded;
          totalBytesLoaded += bytesAddedThisUpdate;

          // Track total model size (sum of all file sizes)
          if (total > 0) {
            const previousTotal = fileProgressMap.get(fileUrl)?.total ?? 0;
            if (previousTotal === 0) {
              // New file with known size - add to total
              totalModelSize += total;
            }
          }

          // CRITICAL FIX: Transformers.js reports progress as 0-100, not 0-1
          // Convert to 0-1 range for consistency with our internal format
          const normalizedProgress = rawProgress / 100;

          console.log('[Progress Debug] Processing progress event:', {
            file: fileUrl.split('/').pop(),
            rawProgress,
            normalizedProgress,
            loaded,
            total,
            totalBytesLoaded,
            totalModelSize,
            downloadSpeed: calculateDownloadSpeed(),
          });

          // Update file progress tracking (using normalized 0-1 range)
          fileProgressMap.set(fileUrl, {
            loaded,
            total,
            progress: normalizedProgress,
          });

          // Calculate aggregated progress across all files
          const aggregatedProgress = calculateAggregatedProgress();

          // Debug logging
          console.log('[Worker Multi-File Progress]', {
            file: fileUrl.split('/').pop(), // Just filename for brevity
            fileProgress: `${rawProgress.toFixed(1)}%`,
            fileSize: `${(loaded / 1024 / 1024).toFixed(2)}MB / ${(total / 1024 / 1024).toFixed(2)}MB`,
            filesTracked: fileProgressMap.size,
            aggregatedProgress: `${(aggregatedProgress * 100).toFixed(2)}%`,
            isMonotonic: aggregatedProgress >= lastReportedProgress,
          });

          // Report aggregated progress with debouncing
          reportProgress(aggregatedProgress, 'downloading');
        } else if (progressData.status === 'initiate' || progressData.status === 'download') {
          // File download initiated - report as-is
          const stage = progressData.status;
          console.log(`[Worker Progress] ${stage}:`, {
            file: 'file' in progressData ? progressData.file : 'unknown',
          });

          reportProgress(lastReportedProgress, stage);
        } else if (progressData.status === 'done') {
          // File completed - mark as 100%
          if ('file' in progressData) {
            const fileUrl = progressData.file as string;
            const existingProgress = fileProgressMap.get(fileUrl);

            console.log('[Progress Debug] File done event:', {
              file: fileUrl.split('/').pop(),
              existingProgress,
            });

            if (existingProgress) {
              // Mark file as fully loaded (1.0 = 100%)
              fileProgressMap.set(fileUrl, {
                loaded: existingProgress.total,
                total: existingProgress.total,
                progress: 1.0,
              });

              const aggregatedProgress = calculateAggregatedProgress();
              console.log('[Worker File Completed]', {
                file: fileUrl.split('/').pop(),
                aggregatedProgress: `${(aggregatedProgress * 100).toFixed(2)}%`,
              });

              reportProgress(aggregatedProgress, 'done');
            }
          }
        } else if (progressData.status === 'ready') {
          // All files loaded - report 100%
          console.log('[Worker All Files Complete]');
          reportProgress(1.0, 'ready');
        }
      },
    })) as unknown as TextGenerationPipeline;

    // Ensure final progress update is sent
    if (progressDebounceTimer) {
      clearTimeout(progressDebounceTimer);
      progressDebounceTimer = null;
    }

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
