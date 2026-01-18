/**
 * Feature Flag System
 *
 * Provides runtime feature toggles using Capacitor Preferences for persistence.
 * Flags survive app restarts and updates.
 */

import { Preferences } from '@capacitor/preferences';

const FEATURE_FLAGS_KEY = 'feature_flags';

/**
 * Known feature flags in the app
 */
export interface FeatureFlags {
  /** Enable ACP (Agent Client Protocol) experimental feature */
  enableACP: boolean;
  /** Enable Local AI experimental feature */
  enableLocalAI: boolean;
}

/**
 * Default values for all flags (OFF by default for experimental features)
 */
const DEFAULT_FLAGS: FeatureFlags = {
  enableACP: false,
  enableLocalAI: false,
};

/**
 * In-memory cache of feature flags
 */
let flagsCache: FeatureFlags | null = null;

/**
 * Initialize feature flags by loading from storage
 * Should be called once at app startup
 */
export async function initializeFeatureFlags(): Promise<FeatureFlags> {
  try {
    const result = await Preferences.get({ key: FEATURE_FLAGS_KEY });

    if (result.value) {
      const stored = JSON.parse(result.value) as Partial<FeatureFlags>;
      // Merge with defaults to handle new flags added in updates
      flagsCache = { ...DEFAULT_FLAGS, ...stored };
    } else {
      // First time - use defaults
      flagsCache = { ...DEFAULT_FLAGS };
      await saveFeatureFlags(flagsCache);
    }

    console.log('[FeatureFlags] Initialized:', flagsCache);
    return flagsCache;
  } catch (error) {
    console.error('[FeatureFlags] Failed to initialize, using defaults:', error);
    flagsCache = { ...DEFAULT_FLAGS };
    return flagsCache;
  }
}

/**
 * Get all feature flags
 * Returns cached flags if available, otherwise loads from storage
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  if (flagsCache) {
    return flagsCache;
  }

  return await initializeFeatureFlags();
}

/**
 * Get a single feature flag value
 */
export async function getFeatureFlag<K extends keyof FeatureFlags>(
  flag: K
): Promise<FeatureFlags[K]> {
  const flags = await getFeatureFlags();
  return flags[flag];
}

/**
 * Set a single feature flag value and persist to storage
 */
export async function setFeatureFlag<K extends keyof FeatureFlags>(
  flag: K,
  value: FeatureFlags[K]
): Promise<void> {
  const flags = await getFeatureFlags();
  flags[flag] = value;
  flagsCache = flags;

  await saveFeatureFlags(flags);
  console.log(`[FeatureFlags] Updated ${flag}:`, value);
}

/**
 * Set multiple feature flags at once
 */
export async function setFeatureFlags(updates: Partial<FeatureFlags>): Promise<void> {
  const flags = await getFeatureFlags();
  Object.assign(flags, updates);
  flagsCache = flags;

  await saveFeatureFlags(flags);
  console.log('[FeatureFlags] Bulk update:', updates);
}

/**
 * Reset all flags to defaults
 */
export async function resetFeatureFlags(): Promise<void> {
  flagsCache = { ...DEFAULT_FLAGS };
  await saveFeatureFlags(flagsCache);
  console.log('[FeatureFlags] Reset to defaults');
}

/**
 * Save flags to storage
 */
async function saveFeatureFlags(flags: FeatureFlags): Promise<void> {
  try {
    await Preferences.set({
      key: FEATURE_FLAGS_KEY,
      value: JSON.stringify(flags),
    });
  } catch (error) {
    console.error('[FeatureFlags] Failed to save:', error);
    throw error;
  }
}

/**
 * Clear cache (for testing purposes)
 */
export function clearFeatureFlagsCache(): void {
  flagsCache = null;
}
