import * as Sentry from '@sentry/react';

// Extend Navigator interface to include WebGPU
interface NavigatorGPU extends Navigator {
  gpu?: GPU;
}

interface GPU {
  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
}

interface GPURequestAdapterOptions {
  powerPreference?: 'low-power' | 'high-performance';
}

interface GPUAdapter {
  features: Set<string>;
  limits: {
    maxTextureDimension1D?: number;
    maxTextureDimension2D?: number;
    maxTextureDimension3D?: number;
    maxTextureArrayLayers?: number;
    maxBindGroups?: number;
    maxDynamicUniformBuffersPerPipelineLayout?: number;
    maxDynamicStorageBuffersPerPipelineLayout?: number;
    maxSampledTexturesPerShaderStage?: number;
    maxSamplersPerShaderStage?: number;
    maxStorageBuffersPerShaderStage?: number;
    maxStorageTexturesPerShaderStage?: number;
    maxUniformBuffersPerShaderStage?: number;
    maxUniformBufferBindingSize?: number;
    maxStorageBufferBindingSize?: number;
    maxVertexBuffers?: number;
    maxVertexAttributes?: number;
    maxVertexBufferArrayStride?: number;
    maxInterStageShaderComponents?: number;
    maxComputeWorkgroupStorageSize?: number;
    maxComputeInvocationsPerWorkgroup?: number;
    maxComputeWorkgroupSizeX?: number;
    maxComputeWorkgroupSizeY?: number;
    maxComputeWorkgroupSizeZ?: number;
    maxComputeWorkgroupsPerDimension?: number;
    maxBufferSize?: number;
  };
  requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
}

interface GPUDeviceDescriptor {
  requiredFeatures?: string[];
  requiredLimits?: Record<string, number>;
}

interface GPUDevice {
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createCommandEncoder(): GPUCommandEncoder;
  queue: GPUQueue;
  destroy(): void;
}

interface GPUBufferDescriptor {
  size: number;
  usage: number;
  mappedAtCreation?: boolean;
}

interface GPUBuffer {
  getMappedRange(): ArrayBuffer;
  unmap(): void;
  destroy(): void;
}

interface GPUCommandEncoder {
  finish(): GPUCommandBuffer;
}

interface GPUCommandBuffer {
  // Minimal interface for command buffer
  readonly executionTime?: number;
}

interface GPUQueue {
  submit(commandBuffers: GPUCommandBuffer[]): void;
  onSubmittedWorkDone(): Promise<void>;
}

// Buffer usage flags (from WebGPU spec)
const GPUBufferUsage = {
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  INDIRECT: 0x0100,
  QUERY_RESOLVE: 0x0200,
};

interface ExtendedWebGPUProbeResult {
  // Basic detection
  userAgent: string;
  hasNavigatorGpu: boolean;
  hasAdapter: boolean;
  adapterError: string | null;
  isSecureContext: boolean;
  timestamp: string;

  // Enhanced diagnostics (Phase 0)
  canCreateDevice: boolean;
  deviceError: string | null;
  canRunComputePass: boolean;
  computePassError: string | null;

  // Adapter limits
  maxBufferSize: number | null;
  maxStorageBufferBindingSize: number | null;
  maxComputeWorkgroupStorageSize: number | null;
  maxComputeInvocationsPerWorkgroup: number | null;

  // Device info (from user agent for now)
  platform: string;
  osVersion: string;
  deviceModel: string;
}

/**
 * Parse device info from user agent string
 */
function parseDeviceInfo(userAgent: string): {
  platform: string;
  osVersion: string;
  deviceModel: string;
} {
  // iOS detection
  const iosMatch = userAgent.match(/iPhone OS ([\d_]+)/);
  if (iosMatch) {
    return {
      platform: 'iOS',
      osVersion: iosMatch[1].replace(/_/g, '.'),
      deviceModel: 'iPhone',
    };
  }

  // Android detection
  const androidMatch = userAgent.match(/Android ([\d.]+)/);
  if (androidMatch) {
    return {
      platform: 'Android',
      osVersion: androidMatch[1],
      deviceModel: 'Android Device',
    };
  }

  // Desktop fallback
  return {
    platform: 'Unknown',
    osVersion: 'Unknown',
    deviceModel: 'Unknown',
  };
}

/**
 * Test if WebGPU can actually run a compute pass (not just exist)
 */
async function testComputePass(adapter: GPUAdapter): Promise<{
  success: boolean;
  error: string | null;
}> {
  let device: GPUDevice | null = null;

  try {
    // Request device
    device = await adapter.requestDevice();

    // Create a simple buffer write test
    const buffer = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    // Write test data
    const arrayBuffer = buffer.getMappedRange();
    new Uint32Array(arrayBuffer)[0] = 42;
    buffer.unmap();

    // Submit a command (minimal GPU operation)
    const commandEncoder = device.createCommandEncoder();
    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);

    // Wait for completion
    await device.queue.onSubmittedWorkDone();

    // Clean up
    buffer.destroy();

    return { success: true, error: null };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    // Always destroy device to free resources
    if (device) {
      device.destroy();
    }
  }
}

/**
 * Extended WebGPU probe with comprehensive diagnostics
 */
export async function webgpuProbe(): Promise<ExtendedWebGPUProbeResult> {
  const nav = navigator as NavigatorGPU;
  const hasNavigatorGpu = typeof navigator !== 'undefined' && !!nav.gpu;

  // Initialize result with defaults
  const result: ExtendedWebGPUProbeResult = {
    userAgent: navigator.userAgent,
    hasNavigatorGpu,
    hasAdapter: false,
    adapterError: null,
    isSecureContext: window.isSecureContext,
    timestamp: new Date().toISOString(),
    canCreateDevice: false,
    deviceError: null,
    canRunComputePass: false,
    computePassError: null,
    maxBufferSize: null,
    maxStorageBufferBindingSize: null,
    maxComputeWorkgroupStorageSize: null,
    maxComputeInvocationsPerWorkgroup: null,
    ...parseDeviceInfo(navigator.userAgent),
  };

  // Early return if WebGPU not available
  if (!hasNavigatorGpu || !nav.gpu) {
    logToSentry(result);
    console.log('WebGPU Probe:', result);
    return result;
  }

  // Step 1: Request adapter
  let adapter: GPUAdapter | null = null;
  try {
    adapter = await nav.gpu.requestAdapter();
    result.hasAdapter = !!adapter;
  } catch (e) {
    result.adapterError = e instanceof Error ? e.message : String(e);
    logToSentry(result);
    console.log('WebGPU Probe:', result);
    return result;
  }

  if (!adapter) {
    result.adapterError = 'Adapter returned null';
    logToSentry(result);
    console.log('WebGPU Probe:', result);
    return result;
  }

  // Step 2: Extract adapter limits
  try {
    result.maxBufferSize = adapter.limits.maxBufferSize ?? null;
    result.maxStorageBufferBindingSize = adapter.limits.maxStorageBufferBindingSize ?? null;
    result.maxComputeWorkgroupStorageSize = adapter.limits.maxComputeWorkgroupStorageSize ?? null;
    result.maxComputeInvocationsPerWorkgroup =
      adapter.limits.maxComputeInvocationsPerWorkgroup ?? null;
  } catch (e) {
    // Limits reading failed, but continue
    console.warn('Failed to read adapter limits:', e);
  }

  // Step 3: Test device creation
  try {
    const device = await adapter.requestDevice();
    result.canCreateDevice = true;
    device.destroy(); // Clean up immediately
  } catch (e) {
    result.canCreateDevice = false;
    result.deviceError = e instanceof Error ? e.message : String(e);
    logToSentry(result);
    console.log('WebGPU Probe:', result);
    return result;
  }

  // Step 4: Test compute pass
  const computeTest = await testComputePass(adapter);
  result.canRunComputePass = computeTest.success;
  result.computePassError = computeTest.error;

  // Final logging
  logToSentry(result);
  console.log('WebGPU Probe:', result);

  return result;
}

/**
 * Log probe results to Sentry for remote monitoring
 */
function logToSentry(result: ExtendedWebGPUProbeResult): void {
  Sentry.captureMessage('WebGPU Probe Results (Extended)', {
    level: 'info',
    tags: {
      webgpu_available: result.hasNavigatorGpu,
      adapter_available: result.hasAdapter,
      device_available: result.canCreateDevice,
      compute_pass_available: result.canRunComputePass,
      secure_context: result.isSecureContext,
      platform: result.platform,
      os_version: result.osVersion,
    },
    extra: {
      userAgent: result.userAgent,
      hasNavigatorGpu: result.hasNavigatorGpu,
      hasAdapter: result.hasAdapter,
      adapterError: result.adapterError,
      isSecureContext: result.isSecureContext,
      timestamp: result.timestamp,
      canCreateDevice: result.canCreateDevice,
      deviceError: result.deviceError,
      canRunComputePass: result.canRunComputePass,
      computePassError: result.computePassError,
      maxBufferSize: result.maxBufferSize,
      maxStorageBufferBindingSize: result.maxStorageBufferBindingSize,
      maxComputeWorkgroupStorageSize: result.maxComputeWorkgroupStorageSize,
      maxComputeInvocationsPerWorkgroup: result.maxComputeInvocationsPerWorkgroup,
      platform: result.platform,
      osVersion: result.osVersion,
      deviceModel: result.deviceModel,
    },
  });
}
