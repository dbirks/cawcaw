/**
 * Filesystem Cache Implementation
 *
 * Provides a Cache API-like interface using Capacitor Filesystem for persistent storage.
 * Model files are stored in iOS Application Support directory (Directory.Data) which
 * persists across app updates, unlike Cache API which can be cleared by the system.
 *
 * Directory structure:
 * Data/transformers-cache/
 *   ├── metadata.json (URL to filename mapping + headers)
 *   └── files/
 *       ├── <hash1>.bin (cached file 1)
 *       ├── <hash2>.bin (cached file 2)
 *       └── ...
 */

import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

// ============================================================================
// Constants
// ============================================================================

const CACHE_DIR = 'transformers-cache';
const FILES_DIR = `${CACHE_DIR}/files`;
const METADATA_FILE = `${CACHE_DIR}/metadata.json`;

// ============================================================================
// Types
// ============================================================================

/**
 * Metadata entry for a cached file
 */
interface CacheEntry {
  url: string;
  filename: string;
  headers: Record<string, string>;
  size: number;
  timestamp: number;
}

/**
 * Metadata file structure
 */
interface CacheMetadata {
  version: number;
  entries: Record<string, CacheEntry>; // url -> CacheEntry mapping
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Simple hash function to create safe filenames from URLs
 * Uses a deterministic hash to ensure the same URL always maps to the same filename
 */
function urlToFilename(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${Math.abs(hash).toString(36)}.bin`;
}

/**
 * Read metadata file, creating it if it doesn't exist
 */
async function readMetadata(): Promise<CacheMetadata> {
  try {
    const result = await Filesystem.readFile({
      path: METADATA_FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });

    // Handle both string and Blob types
    let data: string;
    if (typeof result.data === 'string') {
      data = result.data;
    } else {
      // If it's a Blob, we need to read it as text
      data = await result.data.text();
    }
    return JSON.parse(data);
  } catch (_error) {
    // File doesn't exist or is corrupted, return empty metadata
    return {
      version: 1,
      entries: {},
    };
  }
}

/**
 * Write metadata file
 */
async function writeMetadata(metadata: CacheMetadata): Promise<void> {
  await Filesystem.writeFile({
    path: METADATA_FILE,
    directory: Directory.Data,
    data: JSON.stringify(metadata, null, 2),
    encoding: Encoding.UTF8,
    recursive: true,
  });
}

/**
 * Ensure cache directories exist
 */
async function ensureCacheDirectory(): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: FILES_DIR,
      directory: Directory.Data,
      recursive: true,
    });
  } catch (error) {
    // Directory may already exist, ignore error
    if (error instanceof Error && !error.message.includes('already exists')) {
      throw error;
    }
  }
}

/**
 * Convert Response headers to plain object
 */
function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Convert plain object to Headers
 */
function objectToHeaders(obj: Record<string, string>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(obj)) {
    headers.set(key, value);
  }
  return headers;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if a URL is cached
 */
export async function isCached(url: string): Promise<boolean> {
  // On web, always return false since we only use filesystem on native
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    const metadata = await readMetadata();
    return url in metadata.entries;
  } catch (error) {
    console.error('Failed to check cache:', error);
    return false;
  }
}

/**
 * Get cached response for URL
 * Returns null if not cached
 */
export async function getCached(url: string): Promise<Response | null> {
  // On web, always return null since we only use filesystem on native
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    const metadata = await readMetadata();
    const entry = metadata.entries[url];

    if (!entry) {
      return null;
    }

    // Read the cached file
    const filePath = `${FILES_DIR}/${entry.filename}`;
    const result = await Filesystem.readFile({
      path: filePath,
      directory: Directory.Data,
    });

    // Convert base64 data to ArrayBuffer
    let base64Data: string;
    if (typeof result.data === 'string') {
      base64Data = result.data;
    } else {
      // If it's a Blob, convert to base64
      const arrayBuffer = await result.data.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      base64Data = btoa(String.fromCharCode(...bytes));
    }

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create Response with headers
    const headers = objectToHeaders(entry.headers);
    return new Response(bytes.buffer, {
      status: 200,
      statusText: 'OK',
      headers,
    });
  } catch (error) {
    console.error('Failed to get cached response:', error);
    return null;
  }
}

/**
 * Store response for URL with progress tracking
 *
 * @param url - URL to cache
 * @param response - Response to cache
 * @param onProgress - Optional callback for download progress (0-1)
 */
export async function setCached(
  url: string,
  response: Response,
  onProgress?: (progress: number) => void
): Promise<void> {
  // On web, skip caching since we only use filesystem on native
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await ensureCacheDirectory();

    // Clone response to avoid consuming it
    const clonedResponse = response.clone();

    // Get response body as ArrayBuffer
    const arrayBuffer = await clonedResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Convert to base64 for Capacitor Filesystem
    // Note: This increases size by ~33% but is required by Capacitor
    const base64Data = btoa(
      Array.from(uint8Array)
        .map((byte) => String.fromCharCode(byte))
        .join('')
    );

    // Generate filename and prepare entry
    const filename = urlToFilename(url);
    const filePath = `${FILES_DIR}/${filename}`;
    const headers = headersToObject(clonedResponse.headers);

    // Write file to filesystem
    await Filesystem.writeFile({
      path: filePath,
      directory: Directory.Data,
      data: base64Data,
      recursive: true,
    });

    // Update metadata
    const metadata = await readMetadata();
    metadata.entries[url] = {
      url,
      filename,
      headers,
      size: arrayBuffer.byteLength, // Store original size, not base64 size
      timestamp: Date.now(),
    };
    await writeMetadata(metadata);

    // Report completion
    if (onProgress) {
      onProgress(1);
    }
  } catch (error) {
    console.error('Failed to cache response:', error);
    throw error;
  }
}

/**
 * Get total cache size in bytes
 */
export async function getCacheSize(): Promise<number> {
  // On web, return 0 since we only use filesystem on native
  if (!Capacitor.isNativePlatform()) {
    return 0;
  }

  try {
    const metadata = await readMetadata();
    let totalSize = 0;

    for (const entry of Object.values(metadata.entries)) {
      totalSize += entry.size;
    }

    return totalSize;
  } catch (error) {
    console.error('Failed to get cache size:', error);
    return 0;
  }
}

/**
 * Clear all cached files
 */
export async function clearCache(): Promise<void> {
  // On web, skip since we only use filesystem on native
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Delete the entire cache directory
    await Filesystem.rmdir({
      path: CACHE_DIR,
      directory: Directory.Data,
      recursive: true,
    });

    // Recreate empty directory structure
    await ensureCacheDirectory();
    await writeMetadata({
      version: 1,
      entries: {},
    });
  } catch (error) {
    console.error('Failed to clear cache:', error);
    throw error;
  }
}

/**
 * List all cached URLs
 */
export async function listCached(): Promise<string[]> {
  // On web, return empty array since we only use filesystem on native
  if (!Capacitor.isNativePlatform()) {
    return [];
  }

  try {
    const metadata = await readMetadata();
    return Object.keys(metadata.entries);
  } catch (error) {
    console.error('Failed to list cached URLs:', error);
    return [];
  }
}

/**
 * Get detailed cache statistics
 */
export async function getCacheStats(): Promise<{
  totalSize: number;
  fileCount: number;
  urls: string[];
}> {
  // On web, return empty stats since we only use filesystem on native
  if (!Capacitor.isNativePlatform()) {
    return {
      totalSize: 0,
      fileCount: 0,
      urls: [],
    };
  }

  try {
    const metadata = await readMetadata();
    const urls = Object.keys(metadata.entries);
    const totalSize = Object.values(metadata.entries).reduce((sum, entry) => sum + entry.size, 0);

    return {
      totalSize,
      fileCount: urls.length,
      urls,
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return {
      totalSize: 0,
      fileCount: 0,
      urls: [],
    };
  }
}
