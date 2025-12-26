import * as Sentry from '@sentry/react';

// Extend Navigator interface to include WebGPU
interface NavigatorGPU extends Navigator {
  gpu?: GPU;
}

interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
}

type GPUAdapter = {};

interface WebGPUProbeResult {
  userAgent: string;
  hasNavigatorGpu: boolean;
  hasAdapter: boolean;
  adapterError: string | null;
  isSecureContext: boolean;
  timestamp: string;
}

export async function webgpuProbe(): Promise<WebGPUProbeResult> {
  const nav = navigator as NavigatorGPU;
  const hasNavigatorGpu = typeof navigator !== 'undefined' && !!nav.gpu;
  let adapter = null;
  let adapterError = null;

  if (hasNavigatorGpu && nav.gpu) {
    try {
      adapter = await nav.gpu.requestAdapter();
    } catch (e) {
      adapterError = String(e);
    }
  }

  const result: WebGPUProbeResult = {
    userAgent: navigator.userAgent,
    hasNavigatorGpu,
    hasAdapter: !!adapter,
    adapterError,
    isSecureContext: window.isSecureContext,
    timestamp: new Date().toISOString(),
  };

  // Log to Sentry
  Sentry.captureMessage('WebGPU Probe Results', {
    level: 'info',
    tags: {
      webgpu_available: hasNavigatorGpu,
      adapter_available: !!adapter,
      secure_context: window.isSecureContext,
    },
    extra: {
      userAgent: result.userAgent,
      hasNavigatorGpu: result.hasNavigatorGpu,
      hasAdapter: result.hasAdapter,
      adapterError: result.adapterError,
      isSecureContext: result.isSecureContext,
      timestamp: result.timestamp,
    },
  });

  console.log('WebGPU Probe:', result);

  return result;
}
