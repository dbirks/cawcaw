/**
 * Local AI Service
 *
 * Manages the Web Worker for on-device AI inference.
 * Provides a Promise-based API for the main thread with progress callbacks.
 *
 * Phase 2: Infrastructure scaffolding
 * Phase 3: Will integrate with actual Transformers.js worker
 */

import * as Sentry from '@sentry/react';
import type {
  GenerateOptions,
  InferenceStats,
  LoadConfig,
  WorkerRequest,
  WorkerResponse,
} from '../workers/transformers.worker';

// ============================================================================
// Types
// ============================================================================

/**
 * Callback for model loading progress
 */
export type ProgressCallback = (
  progress: number,
  stage: string,
  downloadSpeed?: string,
  modelName?: string,
  modelSize?: string
) => void;

/**
 * Callback for streaming tokens during generation
 */
export type TokenCallback = (token: string) => void;

/**
 * Result from text generation
 */
export interface GenerateResult {
  text: string;
  stats: InferenceStats;
}

/**
 * Worker state
 */
type WorkerState = 'idle' | 'loading' | 'ready' | 'generating' | 'error';

// ============================================================================
// Local AI Service Class
// ============================================================================

/**
 * Service for managing local AI inference worker
 */
export class LocalAIService {
  private worker: Worker | null = null;
  private state: WorkerState = 'idle';
  private currentPromise: {
    // biome-ignore lint/suspicious/noExplicitAny: Generic promise handler for multiple return types
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  } | null = null;

  // Callbacks for async operations
  private progressCallback: ProgressCallback | null = null;
  private tokenCallback: TokenCallback | null = null;

  /**
   * Initialize the worker and load the model
   *
   * @param config - Model configuration
   * @param onProgress - Optional callback for loading progress
   * @returns Promise that resolves when model is ready
   */
  async initialize(config: LoadConfig, onProgress?: ProgressCallback): Promise<void> {
    if (this.state === 'ready') {
      console.warn('LocalAIService: Model already loaded');
      return;
    }

    if (this.state === 'loading') {
      throw new Error('LocalAIService: Model is already loading');
    }

    console.log('[LocalAIService] Initializing with config:', {
      modelId: config.modelId,
      dtype: config.dtype,
      device: config.device,
    });

    Sentry.addBreadcrumb({
      category: 'local-ai.service',
      message: 'Initializing local AI service',
      level: 'info',
      data: {
        modelId: config.modelId,
        dtype: config.dtype,
        device: config.device,
        stage: 'service-init',
      },
    });

    return new Promise((resolve, reject) => {
      this.state = 'loading';
      this.currentPromise = { resolve, reject };
      this.progressCallback = onProgress ?? null;

      // Create worker
      try {
        console.log('[LocalAIService] Creating Web Worker...');
        this.worker = new Worker(new URL('../workers/transformers.worker.ts', import.meta.url), {
          type: 'module',
        });
        console.log('[LocalAIService] Web Worker created successfully');

        Sentry.addBreadcrumb({
          category: 'local-ai.service',
          message: 'Worker created',
          level: 'info',
          data: { stage: 'worker-created' },
        });
      } catch (workerError) {
        console.error('[LocalAIService] CRITICAL - Failed to create Web Worker:', workerError);
        console.error('[LocalAIService] Worker creation error details:', {
          message: workerError instanceof Error ? workerError.message : 'Unknown error',
          stack: workerError instanceof Error ? workerError.stack : undefined,
        });
        this.state = 'error';
        const errorMessage = `Failed to create Web Worker: ${workerError instanceof Error ? workerError.message : 'Unknown error'}`;
        Sentry.captureException(workerError, {
          tags: { component: 'local-ai-service', operation: 'worker-creation' },
          extra: {
            stage: 'worker-creation',
            errorMessage,
          },
        });
        reject(new Error(errorMessage));
        return;
      }

      // Set up message handler
      this.worker.onmessage = this.handleWorkerMessage.bind(this);

      // Set up error handler
      this.worker.onerror = (error) => {
        this.state = 'error';
        const errorMessage = error.message || 'Worker error';

        console.error('[LocalAIService] CRITICAL - Worker error:', error);
        console.error('[LocalAIService] Worker error details:', {
          message: errorMessage,
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno,
        });

        Sentry.captureException(new Error(errorMessage), {
          tags: { component: 'local-ai-service', operation: 'worker-runtime' },
          extra: {
            stage: 'worker-error',
            errorMessage,
            filename: error.filename,
            lineno: error.lineno,
            colno: error.colno,
          },
        });

        this.currentPromise?.reject(new Error(errorMessage));
        this.currentPromise = null;
      };

      // Send load command
      console.log('[LocalAIService] Sending load command to worker...');
      this.postMessage({ type: 'load', config });

      Sentry.addBreadcrumb({
        category: 'local-ai.service',
        message: 'Load command sent to worker',
        level: 'info',
        data: {
          modelId: config.modelId,
          stage: 'load-command-sent',
        },
      });
    });
  }

  /**
   * Generate text from a prompt
   *
   * @param prompt - Input text
   * @param options - Generation options
   * @param onToken - Optional callback for streaming tokens
   * @returns Promise with generated text and stats
   */
  async generate(
    prompt: string,
    options: GenerateOptions = {},
    onToken?: TokenCallback
  ): Promise<GenerateResult> {
    if (this.state === 'generating') {
      throw new Error('LocalAIService: Generation already in progress. Cancel first.');
    }

    if (this.state !== 'ready') {
      throw new Error('LocalAIService: Model not ready. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      this.state = 'generating';
      this.currentPromise = { resolve, reject };
      this.tokenCallback = onToken ?? null;

      this.postMessage({
        type: 'generate',
        prompt,
        options,
      });
    });
  }

  /**
   * Cancel ongoing generation
   */
  cancel(): void {
    if (this.state !== 'generating') {
      console.warn('LocalAIService: No generation in progress');
      return;
    }

    this.postMessage({ type: 'cancel' });
    this.currentPromise?.reject(new Error('Generation cancelled by user'));
    this.currentPromise = null;
    this.tokenCallback = null;
    this.state = 'ready';
  }

  /**
   * Unload the model and terminate the worker
   */
  unload(): void {
    if (this.worker) {
      this.postMessage({ type: 'unload' });
      this.worker.terminate();
      this.worker = null;
    }

    this.state = 'idle';
    this.currentPromise = null;
    this.progressCallback = null;
    this.tokenCallback = null;
  }

  /**
   * Get current worker state
   */
  getState(): WorkerState {
    return this.state;
  }

  /**
   * Check if model is ready for inference
   */
  isReady(): boolean {
    return this.state === 'ready';
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const message = event.data;

    switch (message.type) {
      case 'load-progress':
        this.progressCallback?.(
          message.progress,
          message.stage,
          message.downloadSpeed,
          message.modelName,
          message.modelSize
        );
        break;

      case 'ready':
        Sentry.addBreadcrumb({
          category: 'local-ai.service',
          message: 'Worker ready - model loaded',
          level: 'info',
          data: { stage: 'worker-ready' },
        });

        this.state = 'ready';
        this.currentPromise?.resolve(undefined);
        this.currentPromise = null;
        this.progressCallback = null;
        break;

      case 'token':
        this.tokenCallback?.(message.text);
        break;

      case 'complete':
        this.state = 'ready';
        this.currentPromise?.resolve({
          text: message.fullText,
          stats: message.stats,
        });
        this.currentPromise = null;
        this.tokenCallback = null;
        break;

      case 'error': {
        this.state = 'error';
        const error = new Error(message.message);
        if (message.stack) {
          error.stack = message.stack;
        }

        console.error('[LocalAIService] CRITICAL - Error message from worker:', message.message);
        console.error('[LocalAIService] Worker error stack:', message.stack);

        Sentry.captureException(error, {
          tags: { component: 'local-ai-service', operation: 'worker-message' },
          extra: {
            stage: 'worker-message-error',
            errorMessage: message.message,
          },
        });

        this.currentPromise?.reject(error);
        this.currentPromise = null;
        this.progressCallback = null;
        this.tokenCallback = null;
        break;
      }

      default:
        console.warn('LocalAIService: Unknown worker message type:', message);
    }
  }

  /**
   * Post message to worker (type-safe)
   */
  private postMessage(message: WorkerRequest): void {
    if (!this.worker) {
      throw new Error('LocalAIService: Worker not initialized');
    }
    this.worker.postMessage(message);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance for convenient access
 * (Can also instantiate manually if multiple instances needed)
 */
export const localAIService = new LocalAIService();
