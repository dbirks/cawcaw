/**
 * Filesystem Cache Implementation
 *
 * Provides a Cache API-like interface using Capacitor Filesystem for persistent storage.
 * Model files are stored in iOS Application Support directory (Directory.Library) which
 * persists across app updates but is NOT backed up to iCloud, unlike Cache API which
 * can be cleared by the system.
 *
 * Directory structure:
 * Library/transformers-cache/
 *   ├── metadata.json (URL to filename mapping + headers)
 *   └── files/
 *       ├── <hash1>.bin (cached file 1)
 *       ├── <hash2>.bin (cached file 2)
 *       └── ...
 *
 * Migration: On first run after update, existing cache is copied from Data → Library.
 * Backup: metadata.json is backed up to Preferences for redundancy.
 */

import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import * as Sentry from '@sentry/react';

// ============================================================================
// Constants
// ============================================================================

const CACHE_DIR = 'transformers-cache';
const FILES_DIR = `${CACHE_DIR}/files`;
const METADATA_FILE = `${CACHE_DIR}/metadata.json`;
const METADATA_BACKUP_KEY = 'cache-metadata-backup';
const MIGRATION_COMPLETE_KEY = 'cache-migration-complete';

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
 * Filesystem readiness flag - ensures Capacitor is initialized before cache operations
 */
let filesystemReady = false;

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
 * Ensure filesystem is ready and perform one-time migration if needed
 */
async function ensureFilesystemReady(): Promise<void> {
  if (filesystemReady) {
    return;
  }

  try {
    console.log('[FilesystemCache] Initializing filesystem...');

    Sentry.addBreadcrumb({
      category: 'local-ai.cache',
      message: 'Initializing filesystem',
      level: 'info',
      data: { stage: 'filesystem-init' },
    });

    // Ensure cache directory exists in Library
    console.log('[FilesystemCache] Ensuring cache directory exists...');
    await ensureCacheDirectory();
    console.log('[FilesystemCache] Cache directory ready');

    // Check if migration from Data → Library is needed
    const migrationComplete = await Preferences.get({ key: MIGRATION_COMPLETE_KEY });
    const migrationCount = await Preferences.get({ key: 'MIGRATION_RUN_COUNT' });
    const currentCount = migrationCount.value ? parseInt(migrationCount.value, 10) : 0;

    if (!migrationComplete.value) {
      if (currentCount > 1) {
        // CRITICAL: Migration running multiple times (Preferences not persisting)
        Sentry.captureException(new Error('Cache migration running repeatedly'), {
          tags: { component: 'local-ai-cache', operation: 'repeated-migration' },
          extra: { migrationCount: currentCount },
        });
      }

      await Preferences.set({
        key: 'MIGRATION_RUN_COUNT',
        value: (currentCount + 1).toString(),
      });

      console.log('[FilesystemCache] Migration not complete, starting migration...');
      Sentry.addBreadcrumb({
        category: 'local-ai.cache',
        message: 'Starting migration from Data to Library',
        level: 'info',
        data: { stage: 'migration-start' },
      });
      await migrateFromDataToLibrary();
      await Preferences.set({ key: MIGRATION_COMPLETE_KEY, value: 'true' });
      console.log('[FilesystemCache] Migration complete');
      Sentry.addBreadcrumb({
        category: 'local-ai.cache',
        message: 'Migration complete',
        level: 'info',
        data: { stage: 'migration-complete' },
      });
    } else {
      console.log('[FilesystemCache] Migration already complete, skipping');
    }

    filesystemReady = true;
    console.log('[FilesystemCache] Filesystem ready');

    Sentry.addBreadcrumb({
      category: 'local-ai.cache',
      message: 'Filesystem initialization complete',
      level: 'info',
      data: { stage: 'filesystem-ready' },
    });
  } catch (error) {
    console.error('[FilesystemCache] CRITICAL - Filesystem initialization failed:', error);
    console.error('[FilesystemCache] Filesystem init error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    Sentry.captureException(error, {
      tags: { component: 'local-ai-cache', operation: 'filesystem-init' },
      extra: {
        stage: 'filesystem-initialization',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}

/**
 * Migrate cache from Directory.Data to Directory.Library (one-time operation)
 */
async function migrateFromDataToLibrary(): Promise<void> {
  console.log('[FilesystemCache] Checking for migration from Data → Library...');

  Sentry.addBreadcrumb({
    category: 'local-ai.cache',
    message: 'Starting cache migration from Data to Library',
    level: 'info',
  });

  try {
    // Try to read metadata from old Data directory
    const oldMetadata = await Filesystem.readFile({
      path: METADATA_FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });

    console.log('[FilesystemCache] Found cache in Data directory, migrating...');

    // Parse metadata
    let data: string;
    if (typeof oldMetadata.data === 'string') {
      data = oldMetadata.data;
    } else {
      data = await oldMetadata.data.text();
    }
    const metadata: CacheMetadata = JSON.parse(data);

    // Copy each cached file from Data → Library
    let migratedCount = 0;
    for (const entry of Object.values(metadata.entries)) {
      try {
        const oldPath = `${FILES_DIR}/${entry.filename}`;

        // Read from Data directory
        const fileData = await Filesystem.readFile({
          path: oldPath,
          directory: Directory.Data,
        });

        // Write to Library directory
        await Filesystem.writeFile({
          path: oldPath,
          directory: Directory.Library,
          data: fileData.data,
          recursive: true,
        });

        migratedCount++;
        console.log(`[FilesystemCache] Migrated file: ${entry.filename}`);
      } catch (error) {
        console.error(`[FilesystemCache] Failed to migrate ${entry.filename}:`, error);
      }
    }

    // Write metadata to Library directory
    await Filesystem.writeFile({
      path: METADATA_FILE,
      directory: Directory.Library,
      data: JSON.stringify(metadata, null, 2),
      encoding: Encoding.UTF8,
      recursive: true,
    });

    // Backup metadata to Preferences
    await Preferences.set({ key: METADATA_BACKUP_KEY, value: JSON.stringify(metadata) });

    console.log(`[FilesystemCache] Migration complete: ${migratedCount} files migrated`);

    Sentry.captureMessage('Cache migration completed', {
      level: 'info',
      tags: { component: 'local-ai-cache', operation: 'migration-complete' },
      extra: {
        migratedEntries: migratedCount,
        from: 'Directory.Data',
        to: 'Directory.Library',
      },
    });

    // Optional: Delete old cache from Data directory to free space
    try {
      await Filesystem.rmdir({
        path: CACHE_DIR,
        directory: Directory.Data,
        recursive: true,
      });
      console.log('[FilesystemCache] Cleaned up old cache from Data directory');
    } catch (error) {
      console.warn('[FilesystemCache] Failed to clean up old cache:', error);
    }
  } catch (_error) {
    // No cache in Data directory, this is normal for fresh installs
    console.log('[FilesystemCache] No cache found in Data directory, skipping migration');
  }
}

/**
 * Read metadata file, with Preferences backup fallback
 */
async function readMetadata(): Promise<CacheMetadata> {
  try {
    const result = await Filesystem.readFile({
      path: METADATA_FILE,
      directory: Directory.Library,
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
    const parsed = JSON.parse(data);
    const entryCount = Object.keys(parsed.entries).length;

    // Log successful metadata read
    Sentry.captureMessage('Cache metadata read from filesystem', {
      level: 'info',
      tags: { component: 'local-ai-cache', operation: 'metadata-read-filesystem' },
      extra: {
        entryCount,
        metadataSize: data.length,
        hasBackup: true,
      },
    });

    return parsed;
  } catch (_error) {
    console.log('[FilesystemCache] Failed to read metadata from filesystem, trying backup...');

    // Try to restore from Preferences backup
    try {
      const backup = await Preferences.get({ key: METADATA_BACKUP_KEY });
      if (backup.value) {
        console.log('[FilesystemCache] Restored metadata from Preferences backup');
        const parsed = JSON.parse(backup.value);
        const entryCount = Object.keys(parsed.entries).length;

        // CRITICAL: Metadata restored from backup (filesystem failed)
        Sentry.captureMessage('Cache metadata restored from Preferences backup', {
          level: 'warning',
          tags: { component: 'local-ai-cache', operation: 'metadata-read-backup' },
          extra: {
            entryCount,
            reason: 'filesystem-read-failed',
          },
        });

        return parsed;
      }
    } catch (backupError) {
      console.error('[FilesystemCache] Failed to restore from backup:', backupError);
    }

    // Both filesystem and backup failed, return empty metadata
    console.log('[FilesystemCache] No metadata found, starting fresh');

    // CRITICAL: Check if cache files exist on disk despite missing metadata
    // This would indicate metadata corruption/loss
    try {
      const filesDir = await Filesystem.readdir({
        path: `${CACHE_DIR}/files`,
        directory: Directory.Library,
      });

      if (filesDir.files.length > 0) {
        // CRITICAL: Files exist but metadata is missing!
        Sentry.captureException(new Error('Cache metadata missing but files exist on disk'), {
          tags: { component: 'local-ai-cache', operation: 'metadata-corruption' },
          extra: {
            fileCount: filesDir.files.length,
            files: filesDir.files.slice(0, 10).map((f) => f.name), // First 10 files
          },
        });
        console.error(
          '[FilesystemCache] CRITICAL - Metadata lost but files exist:',
          filesDir.files.length
        );
      }
    } catch (_dirError) {
      // Directory doesn't exist yet, truly empty cache
      console.log('[FilesystemCache] Cache directory empty or does not exist');
    }

    return {
      version: 1,
      entries: {},
    };
  }
}

/**
 * Write metadata file with Preferences backup
 */
async function writeMetadata(metadata: CacheMetadata): Promise<void> {
  try {
    // Write to filesystem (primary storage)
    await Filesystem.writeFile({
      path: METADATA_FILE,
      directory: Directory.Library,
      data: JSON.stringify(metadata, null, 2),
      encoding: Encoding.UTF8,
      recursive: true,
    });

    // Backup to Preferences (redundancy)
    await Preferences.set({ key: METADATA_BACKUP_KEY, value: JSON.stringify(metadata) });

    const entryCount = Object.keys(metadata.entries).length;

    // Log successful metadata write
    Sentry.captureMessage('Cache metadata written successfully', {
      level: 'info',
      tags: { component: 'local-ai-cache', operation: 'metadata-write-success' },
      extra: {
        entryCount,
        metadataSize: JSON.stringify(metadata).length,
      },
    });
  } catch (error) {
    console.error('[FilesystemCache] Failed to write metadata:', error);

    // CRITICAL: Metadata write failure
    Sentry.captureException(error, {
      tags: { component: 'local-ai-cache', operation: 'metadata-write-failure' },
      extra: {
        stage: 'metadata-write',
        entryCount: Object.keys(metadata.entries).length,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

/**
 * Ensure cache directories exist
 */
async function ensureCacheDirectory(): Promise<void> {
  try {
    console.log('[FilesystemCache] Creating cache directory:', {
      path: FILES_DIR,
      directory: Directory.Library,
    });
    await Filesystem.mkdir({
      path: FILES_DIR,
      directory: Directory.Library,
      recursive: true,
    });
    console.log('[FilesystemCache] Cache directory created/verified');
  } catch (error) {
    // Directory may already exist, ignore error
    if (error instanceof Error && !error.message.includes('already exists')) {
      console.error('[FilesystemCache] CRITICAL - Failed to create cache directory:', error);
      console.error('[FilesystemCache] Directory creation error details:', {
        message: error.message,
        stack: error.stack,
        path: FILES_DIR,
      });
      Sentry.captureException(error, {
        tags: { component: 'local-ai-cache', operation: 'directory-creation' },
        extra: {
          stage: 'directory-creation',
          path: FILES_DIR,
          errorMessage: error.message,
        },
      });
      throw error;
    } else {
      console.log('[FilesystemCache] Cache directory already exists');
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
  console.log('[FilesystemCache] isCached START', {
    url,
    platform: Capacitor.getPlatform(),
    isNative: Capacitor.isNativePlatform(),
  });

  // On web, always return false since we only use filesystem on native
  if (!Capacitor.isNativePlatform()) {
    console.log('[FilesystemCache] isCached SKIPPED (web platform)');
    return false;
  }

  try {
    await ensureFilesystemReady();
    const metadata = await readMetadata();
    const result = url in metadata.entries;
    console.log('[FilesystemCache] isCached RESULT', {
      url: url.substring(0, 100), // Truncate for readability
      result,
      totalEntries: Object.keys(metadata.entries).length,
    });
    return result;
  } catch (error) {
    console.error('[FilesystemCache] isCached FAILED', { url, error });
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
    await ensureFilesystemReady();
    const metadata = await readMetadata();
    const entry = metadata.entries[url];

    if (!entry) {
      // CRITICAL: Log cache miss to Sentry
      // This helps diagnose why cache isn't being used
      Sentry.captureMessage('Local AI cache miss', {
        level: 'info',
        tags: {
          component: 'local-ai-cache',
          operation: 'cache-miss',
        },
        extra: {
          url: url.substring(0, 100),
          totalCachedUrls: Object.keys(metadata.entries).length,
        },
      });
      return null;
    }

    console.log('[FilesystemCache] Reading cached file:', {
      url: url.substring(0, 100),
      filename: entry.filename,
      size: entry.size,
    });

    // Read the cached file
    const filePath = `${FILES_DIR}/${entry.filename}`;
    const result = await Filesystem.readFile({
      path: filePath,
      directory: Directory.Library,
    });

    console.log('[FilesystemCache] File read successfully, converting from base64...');

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

    console.log('[FilesystemCache] Cached file decoded successfully:', {
      sizeBytes: bytes.length,
      sizeMB: (bytes.length / 1024 / 1024).toFixed(2),
    });

    // CRITICAL: Explicitly capture cache hit as Sentry event
    // This confirms cache is working and files are being retrieved
    Sentry.captureMessage('Local AI cache hit', {
      level: 'info',
      tags: {
        component: 'local-ai-cache',
        operation: 'cache-hit',
      },
      extra: {
        url: url.substring(0, 100),
        filename: entry.filename,
        sizeBytes: bytes.length,
        sizeMB: (bytes.length / 1024 / 1024).toFixed(2),
      },
    });

    // Create Response with headers
    const headers = objectToHeaders(entry.headers);
    return new Response(bytes.buffer, {
      status: 200,
      statusText: 'OK',
      headers,
    });
  } catch (error) {
    console.error('[FilesystemCache] ERROR - Failed to get cached response:', error);
    console.error('[FilesystemCache] Cache read error details:', {
      url: url.substring(0, 100),
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    Sentry.captureException(error, {
      tags: { component: 'local-ai-cache', operation: 'cache-read' },
      extra: {
        stage: 'cache-read',
        url: url.substring(0, 100),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
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
  console.log('[FilesystemCache] setCached START', {
    url: url.substring(0, 100), // Truncate for readability
    platform: Capacitor.getPlatform(),
    isNative: Capacitor.isNativePlatform(),
  });

  Sentry.addBreadcrumb({
    category: 'local-ai.cache',
    message: 'Starting cache write',
    level: 'info',
    data: {
      url: url.substring(0, 100),
      platform: Capacitor.getPlatform(),
      stage: 'cache-write-init',
    },
  });

  // On web, skip caching since we only use filesystem on native
  if (!Capacitor.isNativePlatform()) {
    console.log('[FilesystemCache] setCached SKIPPED (web platform)');
    return;
  }

  try {
    console.log('[FilesystemCache] Ensuring filesystem ready...');
    await ensureFilesystemReady();

    Sentry.addBreadcrumb({
      category: 'local-ai.cache',
      message: 'Filesystem ready',
      level: 'info',
      data: { stage: 'filesystem-ready' },
    });

    console.log('[FilesystemCache] Cloning response...');
    // Clone response to avoid consuming it
    const clonedResponse = response.clone();

    console.log('[FilesystemCache] Converting to ArrayBuffer...');
    // Get response body as ArrayBuffer
    const arrayBuffer = await clonedResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log('[FilesystemCache] Converting to base64...', {
      sizeBytes: arrayBuffer.byteLength,
      sizeMB: (arrayBuffer.byteLength / 1024 / 1024).toFixed(2),
    });

    Sentry.addBreadcrumb({
      category: 'local-ai.cache',
      message: 'Converting to base64',
      level: 'info',
      data: {
        sizeBytes: arrayBuffer.byteLength,
        sizeMB: (arrayBuffer.byteLength / 1024 / 1024).toFixed(2),
        stage: 'base64-conversion',
      },
    });

    // Convert to base64 for Capacitor Filesystem
    // Note: This increases size by ~33% but is required by Capacitor
    const base64Data = btoa(
      Array.from(uint8Array)
        .map((byte) => String.fromCharCode(byte))
        .join('')
    );

    console.log('[FilesystemCache] Base64 conversion complete', {
      base64SizeMB: (base64Data.length / 1024 / 1024).toFixed(2),
    });

    // Generate filename and prepare entry
    const filename = urlToFilename(url);
    const filePath = `${FILES_DIR}/${filename}`;
    const headers = headersToObject(clonedResponse.headers);

    console.log('[FilesystemCache] Writing file to filesystem...', {
      filename,
      path: filePath,
      directory: Directory.Library,
    });

    Sentry.addBreadcrumb({
      category: 'local-ai.cache',
      message: 'Writing file to filesystem',
      level: 'info',
      data: {
        filename,
        path: filePath,
        base64SizeMB: (base64Data.length / 1024 / 1024).toFixed(2),
        stage: 'filesystem-write-start',
      },
    });

    // Write file to filesystem
    await Filesystem.writeFile({
      path: filePath,
      directory: Directory.Library,
      data: base64Data,
      recursive: true,
    });

    console.log('[FilesystemCache] File written successfully');

    Sentry.addBreadcrumb({
      category: 'local-ai.cache',
      message: 'File written successfully',
      level: 'info',
      data: {
        filename,
        stage: 'filesystem-write-complete',
      },
    });

    console.log('[FilesystemCache] Updating metadata...');
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

    console.log('[FilesystemCache] Metadata updated', {
      totalEntries: Object.keys(metadata.entries).length,
    });

    Sentry.addBreadcrumb({
      category: 'local-ai.cache',
      message: 'Metadata updated',
      level: 'info',
      data: {
        totalEntries: Object.keys(metadata.entries).length,
        stage: 'metadata-updated',
      },
    });

    // Report completion
    if (onProgress) {
      onProgress(1);
    }

    console.log('[FilesystemCache] setCached SUCCESS', {
      url: url.substring(0, 100),
      filename,
      sizeBytes: arrayBuffer.byteLength,
    });

    Sentry.addBreadcrumb({
      category: 'local-ai.cache',
      message: 'Cache write complete',
      level: 'info',
      data: {
        url: url.substring(0, 100),
        filename,
        sizeBytes: arrayBuffer.byteLength,
        stage: 'cache-write-success',
      },
    });

    // CRITICAL: Explicitly capture successful cache write as Sentry event (not just breadcrumb)
    // This ensures cache operations are visible in Sentry even without errors
    Sentry.captureMessage('Local AI cache write successful', {
      level: 'info',
      tags: {
        component: 'local-ai-cache',
        operation: 'cache-write-success',
      },
      extra: {
        url: url.substring(0, 100),
        filename,
        sizeBytes: arrayBuffer.byteLength,
      },
    });
  } catch (error) {
    console.error('[FilesystemCache] setCached FAILED', {
      url: url.substring(0, 100),
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    Sentry.captureException(error, {
      tags: { component: 'local-ai-cache' },
      extra: {
        stage: 'filesystem-cache-write',
        url: url.substring(0, 100),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

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
    await ensureFilesystemReady();
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
    await ensureFilesystemReady();

    // Delete the entire cache directory
    await Filesystem.rmdir({
      path: CACHE_DIR,
      directory: Directory.Library,
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
  console.log('[FilesystemCache] listCached START', {
    platform: Capacitor.getPlatform(),
    isNative: Capacitor.isNativePlatform(),
  });

  // On web, return empty array since we only use filesystem on native
  if (!Capacitor.isNativePlatform()) {
    console.log('[FilesystemCache] listCached SKIPPED (web platform)');
    return [];
  }

  try {
    await ensureFilesystemReady();
    const metadata = await readMetadata();
    const urls = Object.keys(metadata.entries);
    console.log('[FilesystemCache] listCached RESULT', {
      count: urls.length,
      urls: urls.map((url) => url.substring(0, 80)), // Truncate for readability
    });
    return urls;
  } catch (error) {
    console.error('[FilesystemCache] listCached FAILED', { error });
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
    await ensureFilesystemReady();
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
