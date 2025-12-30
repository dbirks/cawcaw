/**
 * Feature Flags Context
 *
 * Provides feature flags to all components via React Context.
 * Initialized at app startup and kept in sync with storage.
 */

import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  type FeatureFlags,
  getFeatureFlags,
  initializeFeatureFlags,
  setFeatureFlag as setFeatureFlagUtil,
} from '@/utils/featureFlags';

interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  setFlag: <K extends keyof FeatureFlags>(flag: K, value: FeatureFlags[K]) => Promise<void>;
  loading: boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

/**
 * Feature Flags Provider
 * Wraps the entire app to provide feature flags
 */
export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>({ enableACP: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize feature flags on mount
    const init = async () => {
      try {
        const initialFlags = await initializeFeatureFlags();
        setFlags(initialFlags);
      } catch (error) {
        console.error('[FeatureFlagsProvider] Initialization failed:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const setFlag = async <K extends keyof FeatureFlags>(
    flag: K,
    value: FeatureFlags[K]
  ): Promise<void> => {
    await setFeatureFlagUtil(flag, value);
    // Update local state to trigger re-renders
    const updated = await getFeatureFlags();
    setFlags(updated);
  };

  return (
    <FeatureFlagsContext.Provider value={{ flags, setFlag, loading }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Hook to access feature flags in components
 */
export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);

  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }

  return context;
}

/**
 * Hook to check a single feature flag (convenience)
 */
export function useFeatureFlag<K extends keyof FeatureFlags>(flag: K): FeatureFlags[K] {
  const { flags } = useFeatureFlags();
  return flags[flag];
}
