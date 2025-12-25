/**
 * WebSocket Client for ACP (Agent Client Protocol)
 *
 * Handles WebSocket communication with ACP agents using JSON-RPC 2.0
 * Supports request/response mapping and notification streaming
 */

import { debugLogger } from '@/services/debugLogger';
import type { ACPNotification, ACPRequest, ACPResponse } from '@/types/acp';

/**
 * WebSocket connection states
 */
export type ACPWebSocketState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'closed';

/**
 * Pending request tracking
 */
interface PendingRequest {
  resolve: (value: ACPResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Notification handler type
 */
export type NotificationHandler = (notification: ACPNotification) => void;

/**
 * WebSocket client configuration
 */
export interface ACPWebSocketConfig {
  url: string;
  reconnectDelay?: number; // Initial reconnect delay in ms
  maxReconnectDelay?: number; // Max reconnect delay in ms
  requestTimeout?: number; // Request timeout in ms
  autoReconnect?: boolean; // Enable auto-reconnect
}

/**
 * ACP WebSocket Client
 * Manages WebSocket connection with request/response tracking and notifications
 */
export class ACPWebSocketClient {
  private config: Required<ACPWebSocketConfig>;
  private ws: WebSocket | null = null;
  private state: ACPWebSocketState = 'disconnected';
  private pendingRequests: Map<string | number, PendingRequest> = new Map();
  private notificationHandlers: Set<NotificationHandler> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private requestIdCounter = 0;

  constructor(config: ACPWebSocketConfig) {
    this.config = {
      url: config.url,
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectDelay: config.maxReconnectDelay ?? 30000,
      requestTimeout: config.requestTimeout ?? 30000,
      autoReconnect: config.autoReconnect ?? true,
    };

    debugLogger.info('acp', `WebSocket client created for ${this.config.url}`);
  }

  /**
   * Get current connection state
   */
  getState(): ACPWebSocketState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Generate next request ID
   */
  private nextRequestId(): string {
    return `${Date.now()}_${++this.requestIdCounter}`;
  }

  /**
   * Calculate reconnect delay with exponential backoff
   */
  private getReconnectDelay(): number {
    const delay = Math.min(
      this.config.reconnectDelay * 2 ** this.reconnectAttempts,
      this.config.maxReconnectDelay
    );
    return delay;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.state === 'connecting' || this.isConnected()) {
      debugLogger.warn('acp', 'Already connected or connecting');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.state = 'connecting';
        debugLogger.info('acp', `Connecting to WebSocket: ${this.config.url}`);

        this.ws = new WebSocket(this.config.url);

        // Connection opened
        this.ws.onopen = () => {
          this.state = 'connected';
          this.reconnectAttempts = 0;
          debugLogger.info('acp', 'WebSocket connected');
          resolve();
        };

        // Message received
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        // Connection error
        this.ws.onerror = (error) => {
          debugLogger.error('acp', 'WebSocket error:', error);
          if (this.state === 'connecting') {
            reject(new Error('Failed to connect to WebSocket'));
          }
        };

        // Connection closed
        this.ws.onclose = (event) => {
          debugLogger.info('acp', `WebSocket closed: code=${event.code}, reason=${event.reason}`);
          this.handleDisconnect();
        };
      } catch (error) {
        debugLogger.error('acp', 'WebSocket connection error:', error);
        this.state = 'disconnected';
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Check if it's a response (has id)
      if ('id' in message && message.id !== undefined) {
        this.handleResponse(message as ACPResponse);
      }
      // Check if it's a notification (no id, has method)
      else if ('method' in message) {
        this.handleNotification(message as ACPNotification);
      } else {
        debugLogger.warn('acp', 'Unknown message type:', message);
      }
    } catch (error) {
      debugLogger.error('acp', 'Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle JSON-RPC response
   */
  private handleResponse(response: ACPResponse): void {
    const pending = this.pendingRequests.get(response.id);

    if (!pending) {
      debugLogger.warn('acp', `Received response for unknown request: ${response.id}`);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeout);

    // Remove from pending
    this.pendingRequests.delete(response.id);

    // Resolve or reject based on response
    if (response.error) {
      debugLogger.warn('acp', `Request ${response.id} failed:`, response.error);
      pending.reject(new Error(response.error.message));
    } else {
      debugLogger.info('acp', `Request ${response.id} completed`);
      pending.resolve(response);
    }
  }

  /**
   * Handle JSON-RPC notification
   */
  private handleNotification(notification: ACPNotification): void {
    debugLogger.info('acp', `Notification received: ${notification.method}`);

    // Broadcast to all handlers
    for (const handler of this.notificationHandlers) {
      try {
        handler(notification);
      } catch (error) {
        debugLogger.error('acp', 'Notification handler error:', error);
      }
    }
  }

  /**
   * Handle WebSocket disconnect
   */
  private handleDisconnect(): void {
    const wasConnected = this.state === 'connected';
    this.state = 'disconnected';
    this.ws = null;

    // Reject all pending requests
    for (const [_id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('WebSocket disconnected'));
    }
    this.pendingRequests.clear();

    // Auto-reconnect if enabled and was previously connected
    if (this.config.autoReconnect && wasConnected) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.state = 'reconnecting';
    const delay = this.getReconnectDelay();

    debugLogger.info(
      'acp',
      `Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;

      this.connect().catch((error) => {
        debugLogger.error('acp', 'Reconnect failed:', error);
        // Will schedule another reconnect via handleDisconnect
      });
    }, delay);
  }

  /**
   * Send JSON-RPC request and wait for response
   */
  async send<T = unknown>(method: string, params?: unknown): Promise<ACPResponse<T>> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    const request: ACPRequest = {
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      // Create timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.config.requestTimeout);

      // Store pending request
      this.pendingRequests.set(request.id, {
        resolve: resolve as (value: ACPResponse) => void,
        reject,
        timeout,
      });

      // Send request
      try {
        const message = JSON.stringify(request);
        this.ws?.send(message);
        debugLogger.info('acp', `Sent request: ${method}`, { id: request.id, params });
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(request.id);
        debugLogger.error('acp', `Failed to send request: ${method}`, error);
        reject(error);
      }
    });
  }

  /**
   * Register notification handler
   */
  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.notificationHandlers.delete(handler);
    };
  }

  /**
   * Close WebSocket connection
   */
  close(): void {
    debugLogger.info('acp', 'Closing WebSocket connection');

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Disable auto-reconnect
    this.config.autoReconnect = false;

    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Client closed');
      this.ws = null;
    }

    this.state = 'closed';

    // Reject all pending requests
    for (const [_id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('WebSocket closed'));
    }
    this.pendingRequests.clear();
  }
}
