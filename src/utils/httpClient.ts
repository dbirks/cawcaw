import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Response interface that matches both fetch and CapacitorHttp
export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Headers | Record<string, string>;
  json(): Promise<unknown>;
  text(): Promise<string>;
  ok: boolean;
}

// Request options interface
export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  data?: unknown;
}

// Capacitor HTTP options interface
interface CapacitorHttpOptions {
  url: string;
  method: string;
  headers: Record<string, string>;
  data?: unknown;
}

/**
 * Hybrid HTTP client that uses CapacitorHttp on native platforms
 * and falls back to fetch on web to bypass CORS restrictions
 */
class HybridHttpClient {
  private isNative: boolean;

  constructor() {
    // Check if we're running in a native Capacitor environment
    this.isNative = Capacitor.isNativePlatform();
  }

  /**
   * Make an HTTP request using the appropriate client
   */
  async request(options: HttpRequestOptions): Promise<HttpResponse> {
    if (this.isNative) {
      return this.makeCapacitorRequest(options);
    } else {
      return this.makeFetchRequest(options);
    }
  }

  /**
   * Make request using CapacitorHttp (bypasses CORS on native)
   */
  private async makeCapacitorRequest(options: HttpRequestOptions): Promise<HttpResponse> {
    console.log(`[HybridHttpClient] Using CapacitorHttp for ${options.method} ${options.url}`);

    const capacitorOptions: CapacitorHttpOptions = {
      url: options.url,
      method: options.method,
      headers: options.headers || {},
    };

    // Add body/data based on method
    if (options.body) {
      capacitorOptions.data = JSON.parse(options.body);
    } else if (options.data) {
      capacitorOptions.data = options.data;
    }

    try {
      const response = await CapacitorHttp.request(capacitorOptions);

      // Convert CapacitorHttp response to HttpResponse interface
      return {
        status: response.status,
        statusText: response.status.toString(),
        headers: response.headers || {},
        ok: response.status >= 200 && response.status < 300,
        async json() {
          const data = response.data;

          // Check if response is SSE format (text/event-stream)
          const contentType =
            response.headers?.['content-type'] || response.headers?.['Content-Type'] || '';
          if (contentType.includes('text/event-stream') && typeof data === 'string') {
            // Parse SSE format: extract JSON from "data: {...}" lines
            // SSE format can have multiple events, we want the last complete data payload
            const lines = data.trim().split('\n');
            let lastDataLine: string | null = null;

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                lastDataLine = line.substring(6); // Remove "data: " prefix
              }
            }

            if (lastDataLine) {
              return JSON.parse(lastDataLine);
            }
            throw new Error(`No data line found in SSE response: ${data.substring(0, 200)}`);
          }

          // Regular JSON response
          return typeof data === 'string' ? JSON.parse(data) : data;
        },
        async text() {
          return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        },
      };
    } catch (error) {
      console.error('[HybridHttpClient] CapacitorHttp request failed:', error);
      throw error;
    }
  }

  /**
   * Make request using standard fetch (web fallback)
   */
  private async makeFetchRequest(options: HttpRequestOptions): Promise<HttpResponse> {
    console.log(`[HybridHttpClient] Using fetch for ${options.method} ${options.url}`);

    const fetchOptions: RequestInit = {
      method: options.method,
      headers: options.headers,
    };

    if (options.body) {
      fetchOptions.body = options.body;
    }

    try {
      const response = await fetch(options.url, fetchOptions);

      // Check content type once and read body
      const contentType = response.headers.get('content-type') || '';
      const isSSE = contentType.includes('text/event-stream');
      const responseText = isSSE ? await response.text() : null;

      // Convert fetch Response to HttpResponse interface
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        ok: response.ok,
        async json() {
          // Parse SSE format: extract JSON from "data: {...}" lines
          if (isSSE && responseText) {
            // SSE format can have multiple events, we want the last complete data payload
            const lines = responseText.trim().split('\n');
            let lastDataLine: string | null = null;

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                lastDataLine = line.substring(6); // Remove "data: " prefix
              }
            }

            if (lastDataLine) {
              return JSON.parse(lastDataLine);
            }
            throw new Error(
              `No data line found in SSE response: ${responseText.substring(0, 200)}`
            );
          }

          // Regular JSON response (body not yet consumed)
          return response.json();
        },
        async text() {
          return responseText || response.text();
        },
      };
    } catch (error) {
      console.error('[HybridHttpClient] Fetch request failed:', error);
      throw error;
    }
  }

  /**
   * Convenience methods for common HTTP verbs
   */
  async get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    return this.request({ method: 'GET', url, headers });
  }

  async post(url: string, data?: unknown, headers?: Record<string, string>): Promise<HttpResponse> {
    const body = data ? JSON.stringify(data) : undefined;
    return this.request({ method: 'POST', url, headers, body });
  }

  async put(url: string, data?: unknown, headers?: Record<string, string>): Promise<HttpResponse> {
    const body = data ? JSON.stringify(data) : undefined;
    return this.request({ method: 'PUT', url, headers, body });
  }

  async patch(
    url: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<HttpResponse> {
    const body = data ? JSON.stringify(data) : undefined;
    return this.request({ method: 'PATCH', url, headers, body });
  }

  async delete(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    return this.request({ method: 'DELETE', url, headers });
  }

  /**
   * Check if running on native platform
   */
  isNativePlatform(): boolean {
    return this.isNative;
  }

  /**
   * Get platform information
   */
  getPlatformInfo(): { platform: string; isNative: boolean } {
    return {
      platform: Capacitor.getPlatform(),
      isNative: this.isNative,
    };
  }
}

// Export singleton instance
export const httpClient = new HybridHttpClient();
export default httpClient;
