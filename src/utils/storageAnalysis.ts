/**
 * Storage Analysis Utility
 *
 * Comprehensive storage analysis for the app, including:
 * - Filesystem cache inspection
 * - Orphaned file detection
 * - Legacy Cache API cleanup
 * - Detailed storage breakdown
 *
 * This utility helps diagnose storage issues where unaccounted MB
 * may be consumed by failed downloads or orphaned files.
 */

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import * as filesystemCache from './filesystemCache';

// ============================================================================
// Constants
// ============================================================================

const CACHE_DIR = 'transformers-cache';
const FILES_DIR = `${CACHE_DIR}/files`;
const METADATA_FILE = `${CACHE_DIR}/metadata.json`;

// Legacy Cache API name (if migrating from old implementation)
const LEGACY_CACHE_NAME = 'transformers-cache';

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a cached file
 */
export interface CachedFileInfo {
  url: string;
  name: string;
  filename: string;
  size: number;
  sizeFormatted: string;
  lastModified: string;
  location: 'filesystem' | 'orphaned';
  isOrphaned: boolean;
}

/**
 * Storage breakdown by location
 */
export interface StorageBreakdown {
  filesystemData: number;
  legacyCache: number;
  other: number;
  total: number;
}

/**
 * Comprehensive storage analysis result
 */
export interface StorageAnalysis {
  breakdown: StorageBreakdown;
  breakdownFormatted: {
    filesystemData: string;
    legacyCache: string;
    other: string;
    total: string;
  };
  files: CachedFileInfo[];
  orphanedFiles: CachedFileInfo[];
  orphanedSize: number;
  orphanedSizeFormatted: string;
}

/**
 * Metadata entry for a cached file (matching filesystemCache.ts)
 */
interface CacheEntry {
  url: string;
  filename: string;
  headers: Record<string, string>;
  size: number;
  timestamp: number;
}

/**
 * Metadata file structure (matching filesystemCache.ts)
 */
interface CacheMetadata {
  version: number;
  entries: Record<string, CacheEntry>; // url -> CacheEntry mapping
}

// ============================================================================
// Utility Functions
// ============================================================================

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

/**
 * Format timestamp to human-readable date
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * Get friendly name from URL
 */
function getFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split('/');
    const filename = parts[parts.length - 1];
    return filename || 'Unknown file';
  } catch {
    return 'Unknown file';
  }
}

/**
 * Read metadata file, returning null if doesn't exist
 */
async function readMetadata(): Promise<CacheMetadata | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    const result = await Filesystem.readFile({
      path: METADATA_FILE,
      directory: Directory.Data,
      encoding: 'utf8' as never,
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
  } catch (error) {
    console.error('[StorageAnalysis] Failed to read metadata:', error);
    return null;
  }
}

/**
 * List all files in the cache directory
 */
async function listFilesystemFiles(): Promise<string[]> {
  if (!Capacitor.isNativePlatform()) {
    return [];
  }

  try {
    const result = await Filesystem.readdir({
      path: FILES_DIR,
      directory: Directory.Data,
    });

    return result.files.map((file) => file.name);
  } catch (error) {
    // Directory doesn't exist or is empty
    console.error('[StorageAnalysis] Failed to list files:', error);
    return [];
  }
}

/**
 * Get file size from filesystem
 */
async function getFileSize(filename: string): Promise<number> {
  if (!Capacitor.isNativePlatform()) {
    return 0;
  }

  try {
    const stat = await Filesystem.stat({
      path: `${FILES_DIR}/${filename}`,
      directory: Directory.Data,
    });

    return stat.size;
  } catch (error) {
    console.error(`[StorageAnalysis] Failed to get size for ${filename}:`, error);
    return 0;
  }
}

/**
 * Check legacy Cache API for old cached data
 */
async function checkLegacyCache(): Promise<number> {
  try {
    const cache = await caches.open(LEGACY_CACHE_NAME);
    const keys = await cache.keys();

    let totalSize = 0;
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }

    return totalSize;
  } catch (_error) {
    // Cache API not available or no legacy cache
    return 0;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Perform comprehensive storage analysis
 *
 * This function:
 * 1. Reads metadata to see what SHOULD be cached
 * 2. Lists actual files in the filesystem
 * 3. Identifies orphaned files (files without metadata entries)
 * 4. Checks for legacy Cache API data
 * 5. Calculates total storage usage
 *
 * @returns Detailed storage analysis
 */
export async function analyzeStorage(): Promise<StorageAnalysis> {
  console.log('[StorageAnalysis] Starting comprehensive analysis...');

  // Initialize result
  const result: StorageAnalysis = {
    breakdown: {
      filesystemData: 0,
      legacyCache: 0,
      other: 0,
      total: 0,
    },
    breakdownFormatted: {
      filesystemData: '0 B',
      legacyCache: '0 B',
      other: '0 B',
      total: '0 B',
    },
    files: [],
    orphanedFiles: [],
    orphanedSize: 0,
    orphanedSizeFormatted: '0 B',
  };

  // On web, return empty result
  if (!Capacitor.isNativePlatform()) {
    console.log('[StorageAnalysis] Web platform - skipping analysis');
    return result;
  }

  try {
    // 1. Read metadata to get known files
    const metadata = await readMetadata();
    const knownFiles = new Map<string, CacheEntry>();

    if (metadata) {
      for (const [_url, entry] of Object.entries(metadata.entries)) {
        knownFiles.set(entry.filename, entry);
      }
    }

    console.log(`[StorageAnalysis] Found ${knownFiles.size} known files in metadata`);

    // 2. List actual files in filesystem
    const actualFiles = await listFilesystemFiles();
    console.log(`[StorageAnalysis] Found ${actualFiles.length} actual files in filesystem`);

    // 3. Analyze each file
    for (const filename of actualFiles) {
      const entry = knownFiles.get(filename);
      const fileSize = await getFileSize(filename);

      if (entry) {
        // Known file - add to files list
        const fileInfo: CachedFileInfo = {
          url: entry.url,
          name: getFileNameFromUrl(entry.url),
          filename: entry.filename,
          size: entry.size,
          sizeFormatted: formatBytes(entry.size),
          lastModified: formatDate(entry.timestamp),
          location: 'filesystem',
          isOrphaned: false,
        };

        result.files.push(fileInfo);
        result.breakdown.filesystemData += entry.size;
      } else {
        // Orphaned file - file exists but not in metadata
        const fileInfo: CachedFileInfo = {
          url: 'unknown',
          name: filename,
          filename,
          size: fileSize,
          sizeFormatted: formatBytes(fileSize),
          lastModified: 'Unknown',
          location: 'orphaned',
          isOrphaned: true,
        };

        result.orphanedFiles.push(fileInfo);
        result.orphanedSize += fileSize;
        result.breakdown.filesystemData += fileSize; // Still counts toward filesystem total
      }
    }

    console.log(`[StorageAnalysis] Found ${result.orphanedFiles.length} orphaned files`);

    // 4. Check legacy Cache API
    result.breakdown.legacyCache = await checkLegacyCache();
    console.log(
      `[StorageAnalysis] Legacy cache size: ${formatBytes(result.breakdown.legacyCache)}`
    );

    // 5. Calculate totals
    result.breakdown.total =
      result.breakdown.filesystemData + result.breakdown.legacyCache + result.breakdown.other;

    result.orphanedSizeFormatted = formatBytes(result.orphanedSize);

    result.breakdownFormatted = {
      filesystemData: formatBytes(result.breakdown.filesystemData),
      legacyCache: formatBytes(result.breakdown.legacyCache),
      other: formatBytes(result.breakdown.other),
      total: formatBytes(result.breakdown.total),
    };

    console.log('[StorageAnalysis] Analysis complete:', {
      totalFiles: result.files.length,
      orphanedFiles: result.orphanedFiles.length,
      totalSize: result.breakdownFormatted.total,
      orphanedSize: result.orphanedSizeFormatted,
    });

    return result;
  } catch (error) {
    console.error('[StorageAnalysis] Analysis failed:', error);
    return result;
  }
}

/**
 * Clean up orphaned files
 *
 * Removes files that exist in the filesystem but aren't referenced
 * in the metadata. This can happen if:
 * - Download started but failed partway
 * - Metadata write failed after file write
 * - Corruption or manual deletion of metadata
 *
 * @returns Number of files deleted
 */
export async function cleanupOrphanedFiles(): Promise<number> {
  console.log('[StorageAnalysis] Starting orphaned file cleanup...');

  if (!Capacitor.isNativePlatform()) {
    return 0;
  }

  try {
    // Get analysis to find orphaned files
    const analysis = await analyzeStorage();

    if (analysis.orphanedFiles.length === 0) {
      console.log('[StorageAnalysis] No orphaned files to clean up');
      return 0;
    }

    console.log(
      `[StorageAnalysis] Deleting ${analysis.orphanedFiles.length} orphaned files (${analysis.orphanedSizeFormatted})...`
    );

    // Delete each orphaned file
    let deletedCount = 0;
    for (const file of analysis.orphanedFiles) {
      try {
        await Filesystem.deleteFile({
          path: `${FILES_DIR}/${file.filename}`,
          directory: Directory.Data,
        });
        deletedCount++;
        console.log(`[StorageAnalysis] Deleted orphaned file: ${file.filename}`);
      } catch (error) {
        console.error(`[StorageAnalysis] Failed to delete ${file.filename}:`, error);
      }
    }

    console.log(`[StorageAnalysis] Cleanup complete: deleted ${deletedCount} files`);
    return deletedCount;
  } catch (error) {
    console.error('[StorageAnalysis] Cleanup failed:', error);
    return 0;
  }
}

/**
 * Clear legacy Cache API data
 *
 * Removes old cached data from the browser's Cache API if it exists.
 * This may be from a previous implementation that used Cache API
 * instead of Capacitor Filesystem.
 *
 * @returns Size of deleted cache in bytes
 */
export async function clearLegacyCache(): Promise<number> {
  console.log('[StorageAnalysis] Clearing legacy Cache API...');

  try {
    // Check if legacy cache exists
    const cacheSize = await checkLegacyCache();

    if (cacheSize === 0) {
      console.log('[StorageAnalysis] No legacy cache found');
      return 0;
    }

    console.log(`[StorageAnalysis] Deleting legacy cache (${formatBytes(cacheSize)})...`);

    // Delete the legacy cache
    const deleted = await caches.delete(LEGACY_CACHE_NAME);

    if (deleted) {
      console.log('[StorageAnalysis] Legacy cache deleted successfully');
      return cacheSize;
    } else {
      console.warn('[StorageAnalysis] Failed to delete legacy cache');
      return 0;
    }
  } catch (error) {
    console.error('[StorageAnalysis] Legacy cache cleanup failed:', error);
    return 0;
  }
}

/**
 * Delete a specific cached file by URL
 *
 * This removes both the file and its metadata entry.
 *
 * @param url - URL of the file to delete
 * @returns True if deleted, false if not found
 */
export async function deleteFile(url: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    const metadata = await readMetadata();

    if (!metadata) {
      console.warn('[StorageAnalysis] No metadata found');
      return false;
    }

    const entry = metadata.entries[url];

    if (!entry) {
      console.warn(`[StorageAnalysis] File not found in metadata: ${url}`);
      return false;
    }

    // Delete the file
    await Filesystem.deleteFile({
      path: `${FILES_DIR}/${entry.filename}`,
      directory: Directory.Data,
    });

    // Update metadata
    delete metadata.entries[url];
    await Filesystem.writeFile({
      path: METADATA_FILE,
      directory: Directory.Data,
      data: JSON.stringify(metadata, null, 2),
      encoding: 'utf8' as never,
      recursive: true,
    });

    console.log(`[StorageAnalysis] Deleted file: ${entry.filename}`);
    return true;
  } catch (error) {
    console.error(`[StorageAnalysis] Failed to delete file ${url}:`, error);
    return false;
  }
}

/**
 * Clear all cached data (both filesystem and legacy cache)
 *
 * This is a comprehensive cleanup that removes:
 * - All filesystem cache files
 * - Metadata
 * - Legacy Cache API data
 *
 * @returns Total size cleared in bytes
 */
export async function clearAllStorage(): Promise<number> {
  console.log('[StorageAnalysis] Clearing all storage...');

  let totalCleared = 0;

  try {
    // Clear filesystem cache using existing function
    await filesystemCache.clearCache();

    // Get size before clearing (estimate)
    const analysis = await analyzeStorage();
    totalCleared += analysis.breakdown.filesystemData;

    // Clear legacy cache
    const legacySize = await clearLegacyCache();
    totalCleared += legacySize;

    console.log(`[StorageAnalysis] Cleared ${formatBytes(totalCleared)} total`);
    return totalCleared;
  } catch (error) {
    console.error('[StorageAnalysis] Clear all storage failed:', error);
    return totalCleared;
  }
}
