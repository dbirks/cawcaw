import * as Sentry from '@sentry/react';
import { webgpuProbe } from '@/utils/webgpuProbe';

/**
 * Local AI Availability Result
 */
export interface LocalAICapability {
  available: boolean;
  reason: string;
  details: {
    hasWebGPU: boolean;
    hasAdapter: boolean;
    canCreateDevice: boolean;
    canRunComputePass: boolean;
  };
}

/**
 * Check if local AI (Gemma 3 270M) is available on this device
 *
 * Requirements for local AI:
 * 1. WebGPU API available (navigator.gpu)
 * 2. GPU adapter available
 * 3. Device creation succeeds
 * 4. Compute pass executes successfully
 *
 * @returns {Promise<LocalAICapability>} Capability result with availability and reason
 */
export async function isLocalAIAvailable(): Promise<LocalAICapability> {
  try {
    // Run comprehensive WebGPU probe
    const probe = await webgpuProbe();

    // Build capability result
    const result: LocalAICapability = {
      available: false,
      reason: '',
      details: {
        hasWebGPU: probe.hasNavigatorGpu,
        hasAdapter: probe.hasAdapter,
        canCreateDevice: probe.canCreateDevice,
        canRunComputePass: probe.canRunComputePass,
      },
    };

    // Check each requirement in order
    if (!probe.hasNavigatorGpu) {
      result.reason = 'WebGPU not available (requires modern browser/OS)';
      logCapabilityToSentry(result, probe);
      return result;
    }

    if (!probe.hasAdapter) {
      result.reason = `GPU adapter unavailable: ${probe.adapterError ?? 'Unknown error'}`;
      logCapabilityToSentry(result, probe);
      return result;
    }

    if (!probe.canCreateDevice) {
      result.reason = `GPU device creation failed: ${probe.deviceError ?? 'Unknown error'}`;
      logCapabilityToSentry(result, probe);
      return result;
    }

    if (!probe.canRunComputePass) {
      result.reason = `GPU compute pass failed: ${probe.computePassError ?? 'Unknown error'}`;
      logCapabilityToSentry(result, probe);
      return result;
    }

    // All requirements met!
    result.available = true;
    result.reason = 'Local AI ready (WebGPU accelerated)';
    logCapabilityToSentry(result, probe);
    return result;
  } catch (error) {
    // Unexpected error during capability check
    const errorMessage = error instanceof Error ? error.message : String(error);
    const result: LocalAICapability = {
      available: false,
      reason: `Capability check failed: ${errorMessage}`,
      details: {
        hasWebGPU: false,
        hasAdapter: false,
        canCreateDevice: false,
        canRunComputePass: false,
      },
    };

    Sentry.captureException(error, {
      tags: {
        capability_check: 'local_ai',
        result: 'error',
      },
    });

    return result;
  }
}

/**
 * Log local AI capability to Sentry for remote monitoring
 * This helps track which devices can/cannot run local AI
 */
function logCapabilityToSentry(
  capability: LocalAICapability,
  probe: Awaited<ReturnType<typeof webgpuProbe>>
): void {
  Sentry.captureMessage('Local AI Capability Check', {
    level: capability.available ? 'info' : 'warning',
    tags: {
      local_ai_available: capability.available,
      has_webgpu: capability.details.hasWebGPU,
      has_adapter: capability.details.hasAdapter,
      can_create_device: capability.details.canCreateDevice,
      can_run_compute: capability.details.canRunComputePass,
      platform: probe.platform,
      os_version: probe.osVersion,
    },
    extra: {
      reason: capability.reason,
      userAgent: probe.userAgent,
      platform: probe.platform,
      osVersion: probe.osVersion,
      deviceModel: probe.deviceModel,
      isSecureContext: probe.isSecureContext,
      adapterError: probe.adapterError,
      deviceError: probe.deviceError,
      computePassError: probe.computePassError,
      maxBufferSize: probe.maxBufferSize,
      maxStorageBufferBindingSize: probe.maxStorageBufferBindingSize,
      maxComputeWorkgroupStorageSize: probe.maxComputeWorkgroupStorageSize,
      maxComputeInvocationsPerWorkgroup: probe.maxComputeInvocationsPerWorkgroup,
    },
  });
}

/**
 * Get a human-readable message for local AI availability status
 * Suitable for displaying in Settings UI
 */
export function getLocalAIStatusMessage(capability: LocalAICapability): string {
  if (capability.available) {
    return '✓ Local AI Available (WebGPU accelerated)';
  }

  return `✗ Local AI Unavailable: ${capability.reason}`;
}

/**
 * Check if local AI is available and cache the result
 * Use this for initial app startup capability detection
 */
let cachedCapability: LocalAICapability | null = null;

export async function getLocalAICapability(forceRefresh = false): Promise<LocalAICapability> {
  if (!forceRefresh && cachedCapability) {
    return cachedCapability;
  }

  cachedCapability = await isLocalAIAvailable();
  return cachedCapability;
}
