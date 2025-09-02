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
          return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
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

      // Convert fetch Response to HttpResponse interface
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        ok: response.ok,
        async json() {
          return response.json();
        },
        async text() {
          return response.text();
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
