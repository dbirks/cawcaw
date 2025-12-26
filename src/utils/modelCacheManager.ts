/**
 * Model Cache Manager
 *
 * Utilities for managing Transformers.js model cache using Capacitor Filesystem.
 * Provides functions to check cache status, get cache size, and clear cache.
 *
 * Uses Capacitor Filesystem for persistent storage that survives app updates,
 * replacing the previous Cache API implementation which was cleared by iOS.
 */

import * as filesystemCache from './filesystemCache';

/**
 * Cache status information
 */
export interface CacheStatus {
  isCached: boolean;
  cacheSize?: number; // in bytes
  estimatedSize?: string; // human-readable (e.g., "150 MB")
}

/**
 * Check if the Gemma 3 270M model is cached
 */
export async function isModelCached(
  modelId = 'onnx-community/gemma-3-270m-it-ONNX'
): Promise<boolean> {
  try {
    // Get all cached URLs from filesystem
    const cachedUrls = await filesystemCache.listCached();

    // Check if any cached entry contains the model ID
    return cachedUrls.some((url) => url.includes(modelId));
  } catch (error) {
    console.error('Failed to check model cache:', error);
    return false;
  }
}

/**
 * Get approximate cache size for the model
 * Note: This calculates the TOTAL size of all cached transformers.js files,
 * not just the specific model, since files may be cached with different URL patterns
 */
export async function getModelCacheSize(
  _modelId = 'onnx-community/gemma-3-270m-it-ONNX'
): Promise<number> {
  try {
    // Get total cache size from filesystem
    return await filesystemCache.getCacheSize();
  } catch (error) {
    console.error('Failed to get cache size:', error);
    return 0;
  }
}

/**
 * Get cache status for the model
 */
export async function getModelCacheStatus(
  modelId = 'onnx-community/gemma-3-270m-it-ONNX'
): Promise<CacheStatus> {
  const isCached = await isModelCached(modelId);

  if (!isCached) {
    return { isCached: false };
  }

  const cacheSize = await getModelCacheSize(modelId);
  const estimatedSize = formatBytes(cacheSize);

  return {
    isCached: true,
    cacheSize,
    estimatedSize,
  };
}

/**
 * Clear the model cache
 * Note: This clears ALL transformers.js cache entries, not just the specific model
 */
export async function clearModelCache(
  _modelId = 'onnx-community/gemma-3-270m-it-ONNX'
): Promise<void> {
  try {
    await filesystemCache.clearCache();
  } catch (error) {
    console.error('Failed to clear model cache:', error);
    throw error;
  }
}

/**
 * Get estimated storage usage and quota
 *
 * Note: This API returns browser estimates, not exact values.
 * Values may differ from actual usage and vary by browser/platform.
 */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  usageFormatted: string;
  quotaFormatted: string;
  freeFormatted: string;
  percentage: number;
  isEstimate: boolean;
}> {
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const free = Math.max(0, quota - usage);
      const percentage = quota > 0 ? (usage / quota) * 100 : 0;

      return {
        usage,
        quota,
        usageFormatted: formatBytes(usage),
        quotaFormatted: formatBytes(quota),
        freeFormatted: formatBytes(free),
        percentage,
        isEstimate: true,
      };
    }
  } catch (error) {
    console.error('Failed to get storage estimate:', error);
  }

  return {
    usage: 0,
    quota: 0,
    usageFormatted: 'Unknown',
    quotaFormatted: 'Unknown',
    freeFormatted: 'Unknown',
    percentage: 0,
    isEstimate: false,
  };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}
