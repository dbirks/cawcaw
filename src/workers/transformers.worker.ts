/**
 * Transformers.js Web Worker
 *
 * Runs AI inference in a background thread to prevent UI blocking.
 * Handles model loading, text generation, and progress events.
 *
 * Phase 2: Infrastructure scaffolding (no Transformers.js yet)
 * Phase 3: Will add actual @huggingface/transformers integration
 */

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
 * Model pipeline instance (Phase 3: will be Transformers.js pipeline)
 */
let modelPipeline: unknown = null;

/**
 * Flag to cancel ongoing generation
 */
let isCancelled = false;

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Load the AI model (Phase 3: will integrate Transformers.js)
 */
async function handleLoad(config: LoadConfig): Promise<void> {
  try {
    // Phase 3: Replace with actual Transformers.js implementation
    // import { pipeline, env } from '@huggingface/transformers';
    //
    // env.useBrowserCache = true;
    // env.allowRemoteModels = true;
    //
    // modelPipeline = await pipeline(
    //   'text-generation',
    //   config.modelId,
    //   {
    //     device: config.device,
    //     dtype: config.dtype,
    //     progress_callback: (progress) => {
    //       self.postMessage({
    //         type: 'load-progress',
    //         progress: progress.progress,
    //         stage: progress.status
    //       });
    //     }
    //   }
    // );

    // Placeholder: Simulate model loading with progress events
    const stages = [
      'Downloading tokenizer',
      'Downloading model weights',
      'Initializing WebGPU',
      'Loading model into GPU',
      'Ready',
    ];

    for (let i = 0; i < stages.length; i++) {
      const progress = ((i + 1) / stages.length) * 100;
      const stage = stages[i];

      self.postMessage({
        type: 'load-progress',
        progress,
        stage,
      } satisfies WorkerResponse);

      // Simulate download time
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Placeholder: Mark model as loaded
    modelPipeline = { loaded: true, config };

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
 * Generate text from prompt (Phase 3: will integrate Transformers.js)
 */
async function handleGenerate(_prompt: string, _options: GenerateOptions): Promise<void> {
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

    // Phase 3: Replace with actual Transformers.js streaming inference
    // const result = await modelPipeline(prompt, {
    //   max_new_tokens: options.maxNewTokens ?? 256,
    //   temperature: options.temperature ?? 0.7,
    //   top_p: options.topP ?? 0.9,
    //   streamer: (token) => {
    //     if (!firstTokenTime) firstTokenTime = performance.now();
    //     if (isCancelled) throw new Error('Generation cancelled');
    //     self.postMessage({ type: 'token', text: token } satisfies WorkerResponse);
    //   }
    // });

    // Placeholder: Simulate streaming token generation
    const mockResponse = 'This is a placeholder response. Phase 3 will integrate Transformers.js.';
    const tokens = mockResponse.split(' ');

    for (const token of tokens) {
      if (isCancelled) {
        throw new Error('Generation cancelled');
      }

      if (!firstTokenTime) {
        firstTokenTime = performance.now();
      }

      self.postMessage({
        type: 'token',
        text: `${token} `,
      } satisfies WorkerResponse);

      // Simulate token generation delay
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const firstTokenLatencyMs = firstTokenTime ? firstTokenTime - startTime : 0;

    self.postMessage({
      type: 'complete',
      fullText: mockResponse,
      stats: {
        totalTokens: tokens.length,
        durationMs,
        tokensPerSecond: (tokens.length / durationMs) * 1000,
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
function handleUnload(): void {
  // Phase 3: Add proper cleanup for Transformers.js pipeline
  // modelPipeline?.dispose?.();

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
      handleUnload();
      break;

    default:
      self.postMessage({
        type: 'error',
        message: `Unknown message type: ${type}`,
      } satisfies WorkerResponse);
  }
};
