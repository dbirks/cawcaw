import * as Sentry from '@sentry/react';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import {
  AlertTriangle,
  BookOpen,
  Brain,
  Bug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit,
  Github,
  Hammer,
  HardDrive,
  Info,
  Lock,
  Mic,
  Monitor,
  Moon,
  Network,
  Palette,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Sun,
  TestTube,
  Trash2,
  Unlock,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { AnthropicIcon } from '@/components/icons/AnthropicIcon';
import { OpenAIIcon } from '@/components/icons/OpenAIIcon';
import { LocalAIProgressCard } from '@/components/LocalAIProgressCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/hooks/useTheme';
import { acpManager } from '@/services/acpManager';
import { type DebugLogEntry, debugLogger } from '@/services/debugLogger';
import { getLocalAICapability } from '@/services/localAICapabilities';
import { localAIService } from '@/services/localAIService';
import { mcpManager } from '@/services/mcpManager';
import type { ACPServerConfig, ACPServerStatus } from '@/types/acp';
import type { MCPOAuthDiscovery, MCPServerConfig, MCPServerStatus } from '@/types/mcp';
import {
  clearModelCache,
  getModelCacheStatus,
  getStorageEstimate,
} from '@/utils/modelCacheManager';
import type { CachedFileInfo, StorageAnalysis } from '@/utils/storageAnalysis';
import {
  analyzeStorage,
  cleanupOrphanedFiles,
  clearAllStorage,
  clearLegacyCache,
  deleteFile,
} from '@/utils/storageAnalysis';
import { webgpuProbe } from '@/utils/webgpuProbe';

interface SettingsProps {
  onClose: () => void;
}

// Available AI models
const AVAILABLE_MODELS = [
  // OpenAI Models
  { value: 'gpt-4o', label: 'gpt-4o', provider: 'openai' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini', provider: 'openai' },
  { value: 'gpt-4.1', label: 'gpt-4.1', provider: 'openai' },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini', provider: 'openai' },
  { value: 'o4-mini', label: 'o4-mini', provider: 'openai' },
  { value: 'o3', label: 'o3', provider: 'openai' },
  { value: 'o3-mini', label: 'o3-mini', provider: 'openai' },
  { value: 'gpt-4o-search-preview', label: 'gpt-4o (Web Search)', provider: 'openai' },
  { value: 'gpt-4o-mini-search-preview', label: 'gpt-4o-mini (Web Search)', provider: 'openai' },
  { value: 'gpt-5', label: 'gpt-5', provider: 'openai' },
  { value: 'gpt-5-mini', label: 'gpt-5-mini', provider: 'openai' },
  { value: 'gpt-5-nano', label: 'gpt-5-nano', provider: 'openai' },

  // Anthropic Models - Claude 4.5 Series
  {
    value: 'claude-sonnet-4-5-20250929',
    label: 'Claude Sonnet 4.5',
    provider: 'anthropic',
  },
  {
    value: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    provider: 'anthropic',
  },

  // Anthropic Models - Claude 4 Series
  {
    value: 'claude-opus-4-1-20250805',
    label: 'Claude Opus 4.1',
    provider: 'anthropic',
  },
  {
    value: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    provider: 'anthropic',
  },
] as const;

// Available STT (Speech-to-Text) models
const AVAILABLE_STT_MODELS = [
  { value: 'whisper-1', label: 'whisper-1' },
  { value: 'gpt-4o-mini-transcribe', label: 'gpt-4o-mini-transcribe' },
  { value: 'gpt-4o-transcribe', label: 'gpt-4o-transcribe' },
] as const;

// Settings navigation
type SettingsView = 'list' | 'llm' | 'audio' | 'tools' | 'acp' | 'appearance' | 'debug' | 'about';

const SETTINGS_ITEMS = [
  {
    id: 'llm' as const,
    label: 'LLM Provider',
    icon: Brain,
    description: 'Configure OpenAI and Anthropic API keys',
  },
  {
    id: 'audio' as const,
    label: 'Audio Transcription',
    icon: Mic,
    description: 'Speech to text settings',
  },
  {
    id: 'tools' as const,
    label: 'MCP Servers',
    icon: Wrench,
    description: 'Manage Model Context Protocol servers',
  },
  {
    id: 'acp' as const,
    label: 'ACP Agents',
    icon: Network,
    description: 'Connect to AI coding agents',
  },
  {
    id: 'appearance' as const,
    label: 'Appearance',
    icon: Palette,
    description: 'Theme and display preferences',
  },
  {
    id: 'debug' as const,
    label: 'Debug',
    icon: Bug,
    description: 'View logs and troubleshoot',
  },
  {
    id: 'about' as const,
    label: 'About',
    icon: Info,
    description: 'Version numbers and repository link',
  },
] as const;

export default function Settings({ onClose }: SettingsProps) {
  // MCP state
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Map<string, MCPServerStatus>>(new Map());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<SettingsView>('list');

  // ACP state
  const [acpServers, setAcpServers] = useState<ACPServerConfig[]>([]);
  const [acpServerStatuses, setAcpServerStatuses] = useState<Map<string, ACPServerStatus>>(
    new Map()
  );
  const [showAcpAddDialog, setShowAcpAddDialog] = useState(false);
  const [showAcpEditDialog, setShowAcpEditDialog] = useState(false);
  const [editingAcpServerId, setEditingAcpServerId] = useState<string | null>(null);

  // Debug logs state
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [debugFilter, setDebugFilter] = useState<
    'all' | 'oauth' | 'mcp' | 'general' | 'audio' | 'chat'
  >('all');
  const [debugLevelFilter, setDebugLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>(
    'all'
  );
  const debugFilterId = useId();
  const debugLevelFilterId = useId();

  // WebGPU test state
  const [isTestingWebGPU, setIsTestingWebGPU] = useState(false);
  const [webgpuTestResult, setWebgpuTestResult] = useState<string | null>(null);

  // Local AI test state
  const [isTestingLocalAI, setIsTestingLocalAI] = useState(false);
  const [localAITestResult, setLocalAITestResult] = useState<string | null>(null);

  // Model cache state
  const [cacheStatus, setCacheStatus] = useState<{
    isCached: boolean;
    cacheSize?: number;
    estimatedSize?: string;
  } | null>(null);
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState<{
    usage: number;
    quota: number;
    usageFormatted: string;
    quotaFormatted: string;
    freeFormatted: string;
    percentage: number;
    isEstimate: boolean;
  } | null>(null);

  // Model download progress state
  const [downloadProgress, setDownloadProgress] = useState<{
    progress: number;
    stage: string;
  } | null>(null);

  // Storage analysis state
  const [storageAnalysis, setStorageAnalysis] = useState<StorageAnalysis | null>(null);
  const [isAnalyzingStorage, setIsAnalyzingStorage] = useState(false);
  const [isCleaningStorage, setIsCleaningStorage] = useState(false);

  // API Key state
  const [apiKey, setApiKey] = useState<string>('');
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>('');
  const [isUpdatingAnthropicKey, setIsUpdatingAnthropicKey] = useState(false);

  // Provider and model state
  const [titleModel, setTitleModel] = useState<string>('same');
  const [sttModel, setSttModel] = useState<string>('gpt-4o-mini-transcribe');

  // Theme management
  const { themePreference, updateThemePreference } = useTheme();

  // New server form state
  const [newServer, setNewServer] = useState({
    name: '',
    url: '',
    transportType: 'http-streamable' as 'http-streamable' | 'sse',
    description: '',
    enabled: true,
  });

  // Edit server form state
  const [editServer, setEditServer] = useState({
    name: '',
    url: '',
    transportType: 'http-streamable' as 'http-streamable' | 'sse',
    description: '',
    enabled: true,
  });

  // ACP form state
  const [newAcpServer, setNewAcpServer] = useState({
    name: '',
    url: '',
    description: '',
    enabled: true,
  });

  const [editAcpServer, setEditAcpServer] = useState({
    name: '',
    url: '',
    description: '',
    enabled: true,
  });

  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean;
    requiresAuth: boolean;
    error?: string;
    tools?: Array<{ name: string; description: string }>;
    oauthDiscovery?: MCPOAuthDiscovery;
    detailedError?: {
      message: string;
      httpStatus?: number;
      httpStatusText?: string;
      responseHeaders?: Record<string, string>;
      responseBody?: string;
      networkError?: boolean;
      jsonRpcError?: {
        code: number;
        message: string;
        data?: unknown;
      };
      timestamp: string;
      duration?: number;
    };
  } | null>(null);

  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Generate unique IDs for form elements
  const apiKeyId = useId();
  const anthropicApiKeyId = useId();
  const titleModelSelectId = useId();
  const sttModelSelectId = useId();
  const serverNameId = useId();
  const serverUrlId = useId();
  const transportTypeId = useId();
  const serverDescriptionId = useId();
  const serverEnabledId = useId();
  const editServerNameId = useId();
  const editServerUrlId = useId();
  const editTransportTypeId = useId();
  const editServerDescriptionId = useId();
  const editServerEnabledId = useId();
  const acpServerNameId = useId();
  const acpServerUrlId = useId();
  const acpServerDescriptionId = useId();
  const acpServerEnabledId = useId();
  const editAcpServerNameId = useId();
  const editAcpServerUrlId = useId();
  const editAcpServerDescriptionId = useId();
  const editAcpServerEnabledId = useId();

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [oauthStatuses, setOAuthStatuses] = useState<Map<string, boolean>>(new Map());

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);

      // Clean up demo servers first
      await mcpManager.cleanupDemoServers();

      // Load MCP servers
      const configs = await mcpManager.loadConfigurations();

      setServers(configs);
      setServerStatuses(mcpManager.getServerStatuses());

      // Load current API keys
      const result = await SecureStoragePlugin.get({ key: 'openai_api_key' });
      if (result?.value) {
        setApiKey(result.value);
      }

      const anthropicResult = await SecureStoragePlugin.get({ key: 'anthropic_api_key' });
      if (anthropicResult?.value) {
        setAnthropicApiKey(anthropicResult.value);
      }

      const titleModelResult = await SecureStoragePlugin.get({ key: 'title_model' });
      if (titleModelResult?.value) {
        setTitleModel(titleModelResult.value);
      }

      // Load STT model preference
      const sttModelResult = await SecureStoragePlugin.get({ key: 'stt_model' });
      if (sttModelResult?.value) {
        setSttModel(sttModelResult.value);
      }

      // Load OAuth statuses for servers that require or support OAuth
      const oauthStatusMap = new Map<string, boolean>();
      for (const server of configs) {
        if (server.requiresAuth || server.oauthDiscovery) {
          const hasValidTokens = await mcpManager.hasValidOAuthTokens(server.id);
          oauthStatusMap.set(server.id, hasValidTokens);
        }
      }
      setOAuthStatuses(oauthStatusMap);

      // Load ACP servers
      await acpManager.initialize();
      const acpConfigs = await acpManager.loadConfigurations();
      setAcpServers(acpConfigs);
      setAcpServerStatuses(new Map(acpManager.getAllServerStatuses().map((s) => [s.id, s])));

      // Automatically connect to enabled ACP servers
      try {
        await acpManager.connectToEnabledServers();
        debugLogger.info('mcp', 'Connected to enabled ACP servers on startup');
      } catch (error) {
        debugLogger.warn('mcp', 'Failed to connect to some ACP servers:', error);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Load cache status when LLM or debug view is opened
  // biome-ignore lint/correctness/useExhaustiveDependencies: handleRefreshCacheStatus is stable
  useEffect(() => {
    if (currentView === 'llm' || currentView === 'debug') {
      handleRefreshCacheStatus();
    }
  }, [currentView]);

  // Subscribe to debug logs
  useEffect(() => {
    const unsubscribe = debugLogger.subscribe((logs) => {
      setDebugLogs(logs);
    });
    return unsubscribe;
  }, []);

  // Listen for OAuth completion events to refresh UI
  useEffect(() => {
    const handleOAuthCompletion = () => {
      debugLogger.info('general', '🔄 OAuth completion detected, refreshing settings UI');
      loadSettings();
    };

    window.addEventListener('oauth-completed', handleOAuthCompletion);
    return () => window.removeEventListener('oauth-completed', handleOAuthCompletion);
  }, [loadSettings]);

  const handleApiKeyChange = async (newValue: string) => {
    setApiKey(newValue);

    if (newValue.trim()) {
      setIsUpdatingKey(true);
      try {
        await SecureStoragePlugin.set({ key: 'openai_api_key', value: newValue.trim() });
      } catch (error) {
        console.error('Failed to save API key:', error);
      } finally {
        setIsUpdatingKey(false);
      }
    }
  };

  const handleClearApiKey = async () => {
    if (
      confirm(
        "Are you sure you want to remove your API key? You'll need to re-enter it to use the chat."
      )
    ) {
      try {
        await SecureStoragePlugin.remove({ key: 'openai_api_key' });
        setApiKey('');
      } catch (error) {
        console.error('Failed to clear API key:', error);
        alert('❌ Failed to clear API key');
      }
    }
  };

  const handleAnthropicApiKeyChange = async (newValue: string) => {
    setAnthropicApiKey(newValue);

    if (newValue.trim()) {
      setIsUpdatingAnthropicKey(true);
      try {
        await SecureStoragePlugin.set({ key: 'anthropic_api_key', value: newValue.trim() });
      } catch (error) {
        console.error('Failed to save Anthropic API key:', error);
      } finally {
        setIsUpdatingAnthropicKey(false);
      }
    }
  };

  const handleClearAnthropicApiKey = async () => {
    if (
      confirm(
        "Are you sure you want to remove your Anthropic API key? You'll need to re-enter it to use Claude models."
      )
    ) {
      try {
        await SecureStoragePlugin.remove({ key: 'anthropic_api_key' });
        setAnthropicApiKey('');
      } catch (error) {
        console.error('Failed to clear Anthropic API key:', error);
        alert('❌ Failed to clear Anthropic API key');
      }
    }
  };

  const handleTitleModelChange = async (model: string) => {
    setTitleModel(model);
    try {
      await SecureStoragePlugin.set({ key: 'title_model', value: model });
    } catch (error) {
      console.error('Failed to save title model preference:', error);
    }
  };

  const handleSttModelChange = async (model: string) => {
    setSttModel(model);
    try {
      await SecureStoragePlugin.set({ key: 'stt_model', value: model });
    } catch (error) {
      console.error('Failed to save STT model preference:', error);
    }
  };

  // Debug Functions
  const getFilteredLogs = () => {
    let filtered = debugLogs;

    // Filter by category
    if (debugFilter !== 'all') {
      filtered = filtered.filter((log) => log.category === debugFilter);
    }

    // Filter by level
    if (debugLevelFilter !== 'all') {
      filtered = filtered.filter((log) => log.level === debugLevelFilter);
    }

    return filtered;
  };

  const handleCopyLogs = async () => {
    const filteredLogs = getFilteredLogs();
    const logText = filteredLogs.map((log) => debugLogger.formatLogEntry(log)).join('\n\n');

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(logText);
        alert('Debug logs copied to clipboard!');
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = logText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Debug logs copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to copy logs:', error);
      alert('Failed to copy logs to clipboard');
    }
  };

  const handleClearLogs = () => {
    debugLogger.clearLogs();
  };

  const handleTestWebGPU = async () => {
    setIsTestingWebGPU(true);
    setWebgpuTestResult(null);
    try {
      const result = await webgpuProbe();

      // Format device limits
      const limitsSection = result.maxBufferSize
        ? `
GPU Limits:
  Max Buffer Size: ${(result.maxBufferSize / 1024 / 1024).toFixed(0)} MB
  Max Storage Buffer: ${result.maxStorageBufferBindingSize ? `${(result.maxStorageBufferBindingSize / 1024 / 1024).toFixed(0)} MB` : 'N/A'}
  Max Compute Workgroup Storage: ${result.maxComputeWorkgroupStorageSize ? `${result.maxComputeWorkgroupStorageSize} bytes` : 'N/A'}
  Max Compute Invocations: ${result.maxComputeInvocationsPerWorkgroup ?? 'N/A'}
`
        : '';

      const resultMessage = `
WebGPU Extended Diagnostics:
━━━━━━━━━━━━━━━━━━━━━━━━━━

Device Information:
  Platform: ${result.platform}
  OS Version: ${result.osVersion}
  Model: ${result.deviceModel}
  Secure Context: ${result.isSecureContext ? '✓ Yes' : '✗ No'}

Capability Tests:
  ${result.hasNavigatorGpu ? '✓' : '✗'} Navigator GPU: ${result.hasNavigatorGpu ? 'Available' : 'Not Available'}
  ${result.hasAdapter ? '✓' : '✗'} Adapter: ${result.hasAdapter ? 'Available' : 'Not Available'}
  ${result.canCreateDevice ? '✓' : '✗'} Device Creation: ${result.canCreateDevice ? 'Success' : 'Failed'}
  ${result.canRunComputePass ? '✓' : '✗'} Compute Pass: ${result.canRunComputePass ? 'Success' : 'Failed'}
${limitsSection}
${result.adapterError ? `\nAdapter Error: ${result.adapterError}` : ''}
${result.deviceError ? `Device Error: ${result.deviceError}` : ''}
${result.computePassError ? `Compute Pass Error: ${result.computePassError}` : ''}

Timestamp: ${new Date(result.timestamp).toLocaleString()}

✓ Results logged to Sentry for remote monitoring
${result.canRunComputePass ? '\n🎉 Local AI (WebGPU) READY!' : '\n⚠️  Local AI unavailable - use OpenAI/Claude'}
      `.trim();
      setWebgpuTestResult(resultMessage);
      alert(resultMessage);
    } catch (error) {
      const errorMessage = `Failed to run WebGPU test: ${error instanceof Error ? error.message : String(error)}`;
      setWebgpuTestResult(errorMessage);
      alert(errorMessage);
    } finally {
      setIsTestingWebGPU(false);
    }
  };

  const handleRefreshCacheStatus = async () => {
    setIsLoadingCache(true);
    try {
      const status = await getModelCacheStatus();
      setCacheStatus(status);

      // Also fetch storage estimate
      const estimate = await getStorageEstimate();
      setStorageEstimate(estimate);
    } catch (error) {
      console.error('Failed to check cache status:', error);
    } finally {
      setIsLoadingCache(false);
    }
  };

  const handleClearCache = async () => {
    if (
      !confirm(
        'Are you sure you want to clear the local AI model cache? The model will need to be downloaded again (~150-250MB) on next use.'
      )
    ) {
      return;
    }

    setIsClearingCache(true);
    try {
      // Unload the model if it's currently loaded
      if (localAIService.isReady()) {
        localAIService.unload();
      }

      await clearModelCache();
      alert('✅ Model cache cleared successfully!');

      // Refresh cache status
      await handleRefreshCacheStatus();

      // Refresh storage analysis if available
      if (storageAnalysis) {
        await handleAnalyzeStorage();
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert(
        `❌ Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleAnalyzeStorage = async () => {
    setIsAnalyzingStorage(true);
    try {
      const analysis = await analyzeStorage();
      setStorageAnalysis(analysis);
      console.log('[Settings] Storage analysis:', analysis);
    } catch (error) {
      console.error('Failed to analyze storage:', error);
      alert(
        `❌ Failed to analyze storage: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsAnalyzingStorage(false);
    }
  };

  const handleCleanupOrphans = async () => {
    if (!storageAnalysis || storageAnalysis.orphanedFiles.length === 0) {
      return;
    }

    if (
      !confirm(
        `Remove ${storageAnalysis.orphanedFiles.length} orphaned files (${storageAnalysis.orphanedSizeFormatted})? These are incomplete downloads or corrupted files.`
      )
    ) {
      return;
    }

    setIsCleaningStorage(true);
    try {
      const deletedCount = await cleanupOrphanedFiles();
      alert(`✅ Cleaned up ${deletedCount} orphaned files!`);
      await handleAnalyzeStorage();
      await handleRefreshCacheStatus();
    } catch (error) {
      console.error('Failed to cleanup orphaned files:', error);
      alert(`❌ Failed to cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const handleClearLegacyCache = async () => {
    if (!storageAnalysis || storageAnalysis.breakdown.legacyCache === 0) {
      return;
    }

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
    };

    if (
      !confirm(
        `Clear legacy cache (${storageAnalysis.breakdownFormatted.legacyCache})? This removes old cached data from a previous app version.`
      )
    ) {
      return;
    }

    setIsCleaningStorage(true);
    try {
      const clearedSize = await clearLegacyCache();
      alert(`✅ Cleared ${formatBytes(clearedSize)} of legacy cache!`);
      await handleAnalyzeStorage();
      await handleRefreshCacheStatus();
    } catch (error) {
      console.error('Failed to clear legacy cache:', error);
      alert(
        `❌ Failed to clear legacy cache: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const handleClearAllStorage = async () => {
    if (!storageAnalysis) {
      return;
    }

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
    };

    if (
      !confirm(
        `Clear ALL cached data (${storageAnalysis.breakdownFormatted.total})? This includes model files, orphaned files, and legacy cache. Models will need to be re-downloaded.`
      )
    ) {
      return;
    }

    setIsCleaningStorage(true);
    try {
      if (localAIService.isReady()) {
        localAIService.unload();
      }
      const clearedSize = await clearAllStorage();
      alert(`✅ Cleared ${formatBytes(clearedSize)} of storage!`);
      await handleAnalyzeStorage();
      await handleRefreshCacheStatus();
    } catch (error) {
      console.error('Failed to clear all storage:', error);
      alert(
        `❌ Failed to clear storage: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const handleDeleteFile = async (file: CachedFileInfo) => {
    if (
      !confirm(
        `Delete cached file "${file.name}" (${file.sizeFormatted})? It will be re-downloaded when needed.`
      )
    ) {
      return;
    }

    setIsCleaningStorage(true);
    try {
      const deleted = await deleteFile(file.url);
      if (deleted) {
        alert(`✅ Deleted ${file.name}!`);
        await handleAnalyzeStorage();
        await handleRefreshCacheStatus();
      } else {
        alert('❌ File not found or already deleted');
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert(
        `❌ Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const handlePredownloadModel = async () => {
    if (
      !confirm(
        'Download the local AI model now (~150-250MB)? This will make the model available for offline use.'
      )
    ) {
      return;
    }

    try {
      setIsLoadingCache(true);
      setDownloadProgress({ progress: 0, stage: 'initializing' });

      Sentry.addBreadcrumb({
        category: 'local-ai.ui',
        message: 'User initiated model download',
        level: 'info',
        data: {
          modelId: 'onnx-community/gemma-3-270m-it-ONNX',
          dtype: 'q4f16',
          device: 'webgpu',
          stage: 'download-initiated',
        },
      });

      await localAIService.initialize(
        {
          modelId: 'onnx-community/gemma-3-270m-it-ONNX',
          device: 'webgpu',
          dtype: 'q4f16',
        },
        (progress, stage) => {
          // Debug logging for progress state updates
          console.log('[Settings Progress Debug] State update:', {
            progress,
            progressPercent: Math.round(progress * 100),
            stage,
            timestamp: Date.now(),
          });

          // Update progress state for UI
          setDownloadProgress({ progress, stage });

          // Validate progress is in expected 0-1 range
          const progressPercent = Math.round(progress * 100);
          if (progress < 0 || progress > 1) {
            debugLogger.warn(
              'general',
              `⚠️ Invalid progress value: ${progress} (expected 0-1 range)`
            );
          }

          debugLogger.info('general', `📊 Model download: ${stage} - ${progressPercent}%`);
        }
      );

      // Download complete - refresh cache status and clear progress
      setDownloadProgress(null);
      await handleRefreshCacheStatus();

      Sentry.addBreadcrumb({
        category: 'local-ai.ui',
        message: 'Model download completed successfully',
        level: 'info',
        data: {
          stage: 'download-success',
        },
      });

      // Success - UI will show updated cache status (no alert to avoid dismissing Settings modal)
    } catch (error) {
      console.error('Failed to download model:', error);

      Sentry.captureException(error, {
        tags: { component: 'local-ai-ui' },
        extra: {
          stage: 'download-handler',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      setDownloadProgress(null);
      alert(
        `❌ Failed to download model: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoadingCache(false);
    }
  };

  const handleTestLocalAI = async () => {
    setIsTestingLocalAI(true);
    setLocalAITestResult(null);
    try {
      const capability = await getLocalAICapability(true); // Force refresh

      const resultMessage = `
Local AI Capability Check:
━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: ${capability.available ? '✓ Available' : '✗ Unavailable'}
Reason: ${capability.reason}

Capability Details:
  ${capability.details.hasWebGPU ? '✓' : '✗'} WebGPU API: ${capability.details.hasWebGPU ? 'Available' : 'Not Available'}
  ${capability.details.hasAdapter ? '✓' : '✗'} GPU Adapter: ${capability.details.hasAdapter ? 'Available' : 'Not Available'}
  ${capability.details.canCreateDevice ? '✓' : '✗'} Device Creation: ${capability.details.canCreateDevice ? 'Success' : 'Failed'}
  ${capability.details.canRunComputePass ? '✓' : '✗'} Compute Pass: ${capability.details.canRunComputePass ? 'Success' : 'Failed'}

${capability.available ? 'Local AI (Gemma 3 270M) is available for offline inference!' : 'Local AI is not available. Use OpenAI or Anthropic instead.'}
      `.trim();

      setLocalAITestResult(resultMessage);
    } catch (error) {
      const errorMessage = `Failed to test Local AI: ${error instanceof Error ? error.message : String(error)}`;
      setLocalAITestResult(errorMessage);
      alert(errorMessage);
    } finally {
      setIsTestingLocalAI(false);
    }
  };

  // OAuth Functions
  const handleOAuthAuthenticate = async (serverId: string) => {
    try {
      debugLogger.info('oauth', '🚀 Starting OAuth authentication for server', { serverId });

      // Find server config for debugging
      const serverConfig = servers.find((s) => s.id === serverId);
      debugLogger.info('oauth', '📋 Server config found', serverConfig);

      if (!serverConfig) {
        debugLogger.error('oauth', `❌ Server configuration not found for ID: ${serverId}`);
        throw new Error(`Server configuration not found for ID: ${serverId}`);
      }

      debugLogger.info('oauth', '🔍 Calling mcpManager.startOAuthFlow...');
      const authUrl = await mcpManager.startOAuthFlow(serverId);
      debugLogger.info('oauth', '✅ OAuth URL generated', { authUrl });

      // Open OAuth URL in system browser
      if (typeof window !== 'undefined' && 'open' in window) {
        debugLogger.info('oauth', '🌐 Opening OAuth URL in browser...');
        window.open(authUrl, '_blank', 'noopener,noreferrer');
      } else {
        // Fallback - copy URL to clipboard
        debugLogger.info('oauth', '📋 Fallback: copying OAuth URL to clipboard...');
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(authUrl);
          alert('OAuth URL copied to clipboard. Please open it in your browser.');
        } else {
          alert(`Please open this URL in your browser: ${authUrl}`);
        }
      }
    } catch (error) {
      debugLogger.error('oauth', '❌ Failed to start OAuth flow', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        serverId,
      });
      alert(
        `Failed to start OAuth authentication: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleOAuthDisconnect = async (serverId: string) => {
    if (confirm('Are you sure you want to disconnect OAuth authentication for this server?')) {
      try {
        await mcpManager.clearOAuthTokens(serverId);
        await loadSettings(); // Refresh the UI
      } catch (error) {
        console.error('Failed to clear OAuth tokens:', error);
        alert('Failed to disconnect OAuth authentication.');
      }
    }
  };

  // MCP Server Functions
  const handleAddServer = async () => {
    if (!newServer.name.trim() || !newServer.url.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // Use test result to determine if OAuth is required and include discovery info
      const serverConfig = {
        ...newServer,
        requiresAuth: connectionTestResult?.requiresAuth || false,
        oauthDiscovery: connectionTestResult?.oauthDiscovery,
      };

      await mcpManager.addServer(serverConfig);
      setNewServer({
        name: '',
        url: '',
        transportType: 'http-streamable',
        description: '',
        enabled: true,
      });
      setConnectionTestResult(null);
      setShowErrorDetails(false);
      setShowAddDialog(false);
      await loadSettings();
    } catch (error) {
      console.error('Failed to add server:', error);
      alert('Failed to add server. Please check the configuration.');
    }
  };

  const handleEditServer = async () => {
    if (!editServer.name.trim() || !editServer.url.trim() || !editingServerId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await mcpManager.updateServer(editingServerId, {
        name: editServer.name,
        url: editServer.url,
        transportType: editServer.transportType,
        description: editServer.description,
        enabled: editServer.enabled,
      });

      setShowEditDialog(false);
      setEditingServerId(null);
      setEditServer({
        name: '',
        url: '',
        transportType: 'http-streamable',
        description: '',
        enabled: true,
      });
      await loadSettings();
    } catch (error) {
      console.error('Failed to update server:', error);
      alert('Failed to update server. Please check the configuration.');
    }
  };

  const handleStartEditServer = (server: MCPServerConfig) => {
    if (server.readonly) {
      alert('This server configuration is readonly and cannot be edited.');
      return;
    }

    setEditingServerId(server.id);
    setEditServer({
      name: server.name,
      url: server.url,
      transportType: server.transportType,
      description: server.description || '',
      enabled: server.enabled,
    });
    setShowEditDialog(true);
  };

  const handleCancelEdit = () => {
    setShowEditDialog(false);
    setEditingServerId(null);
    setEditServer({
      name: '',
      url: '',
      transportType: 'http-streamable',
      description: '',
      enabled: true,
    });
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    try {
      await mcpManager.updateServer(serverId, { enabled });
      await loadSettings();
    } catch (error) {
      console.error('Failed to update server:', error);
    }
  };

  const handleRemoveServer = async (serverId: string) => {
    if (confirm('Are you sure you want to remove this server?')) {
      try {
        await mcpManager.removeServer(serverId);
        await loadSettings();
      } catch (error) {
        console.error('Failed to remove server:', error);
      }
    }
  };

  const handleTestConnection = async () => {
    if (!newServer.url.trim()) {
      alert('Please enter a server URL');
      return;
    }

    setIsTestingConnection(true);
    try {
      const result = await mcpManager.testServerWithOAuthDiscovery(newServer);
      setConnectionTestResult({
        success: result.connectionSuccess,
        requiresAuth: result.requiresAuth,
        error: result.error,
        tools: result.tools,
        oauthDiscovery: result.oauthDiscovery,
        detailedError: result.detailedError,
      });
      setShowErrorDetails(false); // Reset expanded state
    } catch (error) {
      console.error('Test connection error:', error);
      setConnectionTestResult({
        success: false,
        requiresAuth: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
        detailedError: {
          message: error instanceof Error ? error.message : 'Connection test failed',
          timestamp: new Date().toISOString(),
          networkError: true,
        },
      });
      setShowErrorDetails(false); // Reset expanded state
    } finally {
      setIsTestingConnection(false);
    }
  };

  // ACP Server Functions
  const handleAddAcpServer = async () => {
    if (!newAcpServer.name.trim() || !newAcpServer.url.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      debugLogger.info('mcp', 'Adding new ACP server:', newAcpServer);

      // Test connection and discover agent card before adding
      const testResult = await acpManager.testConnection(newAcpServer);

      const serverConfig = {
        ...newAcpServer,
        agentCard: testResult.agentCard,
        requiresAuth: testResult.requiresAuth,
        oauthDiscovery: testResult.oauthDiscovery,
      };

      const addedServer = await acpManager.addServer(serverConfig);

      debugLogger.info('mcp', `ACP server added: ${addedServer.id}`, {
        success: testResult.success,
        requiresAuth: testResult.requiresAuth,
      });

      // Try to connect if enabled and connection test was successful
      if (addedServer.enabled && testResult.success && !testResult.requiresAuth) {
        try {
          await acpManager.connectToServer(addedServer.id);
          debugLogger.info('mcp', `Auto-connected to new ACP server: ${addedServer.name}`);
        } catch (error) {
          debugLogger.warn(
            'mcp',
            `Failed to auto-connect to new server: ${addedServer.name}`,
            error
          );
          // Don't fail the add operation if connection fails
        }
      }

      setNewAcpServer({
        name: '',
        url: '',
        description: '',
        enabled: true,
      });
      setShowAcpAddDialog(false);
      await loadSettings();

      if (testResult.requiresAuth) {
        alert(
          `Server added successfully!\n\nOAuth authentication is required to connect.\nClick the OAuth button (🔓) to authenticate.`
        );
      } else if (testResult.success) {
        alert('Server added and connected successfully!');
      } else {
        alert(
          `Server added, but connection test failed.\n\nError: ${testResult.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      console.error('Failed to add ACP server:', error);
      debugLogger.error('mcp', 'Failed to add ACP server:', error);
      alert(
        `Failed to add server: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check the URL and try again.`
      );
    }
  };

  const handleUpdateAcpServer = async () => {
    if (!editAcpServer.name.trim() || !editAcpServer.url.trim() || !editingAcpServerId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await acpManager.updateServer(editingAcpServerId, {
        name: editAcpServer.name,
        url: editAcpServer.url,
        description: editAcpServer.description,
        enabled: editAcpServer.enabled,
      });

      setShowAcpEditDialog(false);
      setEditingAcpServerId(null);
      setEditAcpServer({
        name: '',
        url: '',
        description: '',
        enabled: true,
      });
      await loadSettings();
    } catch (error) {
      console.error('Failed to update ACP server:', error);
      alert('Failed to update server. Please check the configuration.');
    }
  };

  const handleStartEditAcpServer = (server: ACPServerConfig) => {
    setEditingAcpServerId(server.id);
    setEditAcpServer({
      name: server.name,
      url: server.url,
      description: server.description || '',
      enabled: server.enabled,
    });
    setShowAcpEditDialog(true);
  };

  const handleCancelAcpEdit = () => {
    setShowAcpEditDialog(false);
    setEditingAcpServerId(null);
    setEditAcpServer({
      name: '',
      url: '',
      description: '',
      enabled: true,
    });
  };

  const handleToggleAcpServer = async (serverId: string, enabled: boolean) => {
    try {
      await acpManager.updateServer(serverId, { enabled });

      // If enabling the server, try to connect automatically
      if (enabled) {
        try {
          await acpManager.connectToServer(serverId);
          debugLogger.info('mcp', `Auto-connected to ACP server: ${serverId}`);
        } catch (error) {
          debugLogger.warn('mcp', `Failed to auto-connect to ACP server: ${serverId}`, error);
          // Don't fail the toggle operation if connection fails
        }
      }

      await loadSettings();
    } catch (error) {
      console.error('Failed to update ACP server:', error);
      alert('Failed to toggle server. Please try again.');
    }
  };

  const handleRemoveAcpServer = async (serverId: string) => {
    if (confirm('Are you sure you want to remove this ACP agent?')) {
      try {
        await acpManager.removeServer(serverId);
        await loadSettings();
      } catch (error) {
        console.error('Failed to remove ACP server:', error);
      }
    }
  };

  const handleTestAcpConnection = async (serverId: string) => {
    try {
      const server = acpServers.find((s) => s.id === serverId);
      if (!server) {
        alert('Server not found');
        return;
      }

      debugLogger.info('mcp', `Testing ACP connection to: ${server.name}`, { url: server.url });

      const result = await acpManager.testConnection(server);

      if (result.success) {
        // Update server with discovered agent card info
        if (result.agentCard) {
          await acpManager.updateServer(serverId, {
            agentCard: result.agentCard,
          });
          debugLogger.info('mcp', `Agent card discovered for ${server.name}:`, result.agentCard);
        }

        const latencyInfo = result.latency ? ` (${result.latency}ms)` : '';
        const agentInfo = result.agentCard
          ? `\n\nAgent: ${result.agentCard.name} v${result.agentCard.version}`
          : '';

        alert(`Connection successful!${latencyInfo}${agentInfo}`);
      } else if (result.requiresAuth) {
        // Update server to mark it as requiring auth
        await acpManager.updateServer(serverId, {
          requiresAuth: true,
          oauthDiscovery: result.oauthDiscovery,
        });

        alert(
          `Connection requires OAuth authentication.\n\nClick the OAuth button (🔓) to authenticate.`
        );
      } else {
        alert(`Connection failed: ${result.error || 'Unknown error'}`);
      }

      await loadSettings();
    } catch (error) {
      console.error('Failed to test ACP connection:', error);
      debugLogger.error('mcp', 'ACP connection test error:', error);
      alert(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAcpOAuthStart = async (serverId: string) => {
    try {
      debugLogger.info('oauth', '🚀 Starting ACP OAuth authentication', { serverId });

      const authUrl = await acpManager.startOAuthFlow(serverId);
      debugLogger.info('oauth', '✅ ACP OAuth URL generated', { authUrl });

      // Open OAuth URL in system browser
      if (typeof window !== 'undefined' && 'open' in window) {
        debugLogger.info('oauth', '🌐 Opening ACP OAuth URL in browser...');
        window.open(authUrl, '_blank', 'noopener,noreferrer');
      } else {
        // Fallback - copy URL to clipboard
        debugLogger.info('oauth', '📋 Fallback: copying ACP OAuth URL to clipboard...');
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(authUrl);
          alert('OAuth URL copied to clipboard. Please open it in your browser.');
        } else {
          alert(`Please open this URL in your browser: ${authUrl}`);
        }
      }
    } catch (error) {
      debugLogger.error('oauth', '❌ Failed to start ACP OAuth flow', {
        error: error instanceof Error ? error.message : 'Unknown error',
        serverId,
      });
      alert(
        `Failed to start OAuth authentication: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  if (isLoading) {
    return (
      <div className="h-dvh bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Settings</h1>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
          <div className="text-center py-8">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-background">
      <div className="max-w-4xl mx-auto flex flex-col h-full">
        {/* Header with back button for detail views */}
        <div className="flex items-center gap-3 mb-4 sm:mb-6 pt-4 pb-4 safe-top safe-x">
          {currentView !== 'list' && (
            <Button
              variant="ghost"
              onClick={() => setCurrentView('list')}
              className="h-14 w-14 p-0"
            >
              <ChevronLeft className="size-8" />
            </Button>
          )}
          <h1 className="text-xl sm:text-2xl font-bold flex-1">
            {currentView === 'list'
              ? 'Settings'
              : SETTINGS_ITEMS.find((item) => item.id === currentView)?.label || 'Settings'}
          </h1>
          <Button type="button" variant="ghost" onClick={onClose} className="h-14 w-14 p-0">
            <X className="size-8" />
          </Button>
        </div>

        {/* Content Area */}
        {currentView === 'list' ? (
          // List View - Show all settings categories
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-2 pr-4 safe-x safe-bottom">
                {SETTINGS_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCurrentView(item.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                    >
                      <Icon className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-sm text-muted-foreground">{item.description}</div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        ) : (
          // Detail View - Show content for selected setting
          <div className="flex-1 flex flex-col overflow-hidden">
            {currentView === 'llm' && (
              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="pr-4 safe-x safe-bottom">
                    <Card className="border-slate-500/20 bg-slate-500/5">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <OpenAIIcon size={20} />
                          OpenAI Configuration
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* API Key */}
                        <div>
                          <label htmlFor={apiKeyId} className="text-sm font-medium mb-2 block">
                            OpenAI API Key
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                              <Input
                                id={apiKeyId}
                                type="password"
                                placeholder="sk-..."
                                value={apiKey}
                                onChange={(e) => handleApiKeyChange(e.target.value)}
                                className="pr-8"
                              />
                              {isUpdatingKey && (
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              onClick={handleClearApiKey}
                              disabled={!apiKey.trim()}
                              size="sm"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Get your API key from{' '}
                            <a
                              href="https://platform.openai.com/api-keys"
                              className="text-blue-500 hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              OpenAI Platform
                            </a>
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Anthropic Configuration Card */}
                    <Card className="mt-6 border-[#C15F3C]/20 bg-[#C15F3C]/5">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AnthropicIcon size={20} className="text-[#C15F3C]" />
                          Anthropic Configuration
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* API Key */}
                        <div>
                          <label
                            htmlFor={anthropicApiKeyId}
                            className="text-sm font-medium mb-2 block"
                          >
                            Anthropic API Key
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                              <Input
                                id={anthropicApiKeyId}
                                type="password"
                                placeholder="sk-ant-..."
                                value={anthropicApiKey}
                                onChange={(e) => handleAnthropicApiKeyChange(e.target.value)}
                                className="pr-8"
                              />
                              {isUpdatingAnthropicKey && (
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              onClick={handleClearAnthropicApiKey}
                              disabled={!anthropicApiKey.trim()}
                              size="sm"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Get your API key from{' '}
                            <a
                              href="https://platform.claude.com"
                              className="text-[#C15F3C] hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Claude Console
                            </a>
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Title Generation */}
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>Title Generation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {/* Title Generation Model Selection */}
                        <div>
                          <label
                            htmlFor={titleModelSelectId}
                            className="text-sm font-medium mb-2 block"
                          >
                            Title Generation Model
                          </label>
                          <select
                            id={titleModelSelectId}
                            value={titleModel}
                            onChange={(e) => handleTitleModelChange(e.target.value)}
                            className="w-full p-2 border rounded-md bg-background"
                          >
                            <option value="same">Use same model as chat</option>
                            <optgroup label="OpenAI Models">
                              {AVAILABLE_MODELS.filter((m) => m.provider === 'openai').map(
                                (model) => (
                                  <option key={model.value} value={model.value}>
                                    {model.label}
                                  </option>
                                )
                              )}
                            </optgroup>
                            <optgroup label="Anthropic Models">
                              {AVAILABLE_MODELS.filter((m) => m.provider === 'anthropic').map(
                                (model) => (
                                  <option key={model.value} value={model.value}>
                                    {model.label}
                                  </option>
                                )
                              )}
                            </optgroup>
                          </select>
                          <p className="text-xs text-muted-foreground mt-2">
                            Choose a lightweight model for generating conversation titles (optional)
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Local AI Model Cache Management Section */}
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Monitor className="h-5 w-5" />
                          Local AI Model Cache
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Manage the cached Gemma 3 270M model (~150-250MB). Cached models are
                          available for offline use.
                        </p>

                        {/* Cache Status */}
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Cache Status:</span>
                            {isLoadingCache ? (
                              <span className="text-sm text-muted-foreground">Checking...</span>
                            ) : cacheStatus ? (
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={cacheStatus.isCached ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {cacheStatus.isCached ? 'Cached' : 'Not Downloaded'}
                                </Badge>
                                {cacheStatus.isCached && cacheStatus.estimatedSize && (
                                  <span className="text-sm text-muted-foreground">
                                    ({cacheStatus.estimatedSize})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Unknown</span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRefreshCacheStatus}
                            disabled={isLoadingCache}
                          >
                            Refresh
                          </Button>
                        </div>

                        {/* Download Progress */}
                        {downloadProgress && (
                          <LocalAIProgressCard
                            progress={downloadProgress.progress}
                            stage={downloadProgress.stage}
                          />
                        )}

                        {/* Cache Actions */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            variant="outline"
                            onClick={handlePredownloadModel}
                            disabled={isLoadingCache || (cacheStatus?.isCached ?? false)}
                            className="w-full sm:w-auto"
                          >
                            {isLoadingCache ? 'Downloading...' : 'Download Model'}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleClearCache}
                            disabled={isClearingCache || !(cacheStatus?.isCached ?? false)}
                            className="w-full sm:w-auto"
                          >
                            {isClearingCache ? 'Clearing...' : 'Clear Cache'}
                          </Button>
                        </div>

                        {/* Storage Usage Display */}
                        {storageEstimate && (
                          <div className="space-y-2 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                Browser Storage{storageEstimate.isEstimate ? ' (estimated)' : ''}:
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {storageEstimate.usageFormatted} used,{' '}
                                {storageEstimate.freeFormatted} free
                              </span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${Math.min(storageEstimate.percentage, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {storageEstimate.percentage.toFixed(1)}% used of{' '}
                              {storageEstimate.quotaFormatted} quota
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Storage Analysis Section */}
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <HardDrive className="h-5 w-5" />
                          Storage Management
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Analyze storage usage, detect orphaned files from failed downloads, and
                          manage cached data.
                        </p>

                        {/* Analyze Button */}
                        {!storageAnalysis && (
                          <Button
                            variant="outline"
                            onClick={handleAnalyzeStorage}
                            disabled={isAnalyzingStorage}
                            className="w-full"
                          >
                            {isAnalyzingStorage ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Analyzing Storage...
                              </>
                            ) : (
                              <>
                                <HardDrive className="h-4 w-4 mr-2" />
                                Analyze Storage
                              </>
                            )}
                          </Button>
                        )}

                        {/* Storage Analysis Results */}
                        {storageAnalysis && (
                          <div className="space-y-3">
                            {/* Total Usage Summary */}
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                              <span className="text-sm font-medium">Total App Storage:</span>
                              <span className="text-sm font-mono">
                                {storageAnalysis.breakdownFormatted.total}
                              </span>
                            </div>

                            {/* Breakdown */}
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between text-muted-foreground">
                                <span>Model Cache (Filesystem):</span>
                                <span className="font-mono">
                                  {storageAnalysis.breakdownFormatted.filesystemData}
                                </span>
                              </div>
                              {storageAnalysis.breakdown.legacyCache > 0 && (
                                <div className="flex justify-between text-yellow-600 dark:text-yellow-400">
                                  <span>Legacy Cache (Browser):</span>
                                  <span className="font-mono">
                                    {storageAnalysis.breakdownFormatted.legacyCache}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* File List */}
                            {storageAnalysis.files.length > 0 && (
                              <div className="space-y-2 pt-3 border-t">
                                <span className="text-sm font-medium">Cached Files:</span>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {storageAnalysis.files.map((file) => (
                                    <div
                                      key={file.url}
                                      className="flex items-center justify-between p-2 bg-muted rounded text-xs"
                                    >
                                      <div className="flex-1 min-w-0 mr-2">
                                        <div className="truncate font-medium">{file.name}</div>
                                        <div className="text-muted-foreground">
                                          {file.sizeFormatted} • {file.lastModified}
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteFile(file)}
                                        disabled={isCleaningStorage}
                                        className="shrink-0"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Orphaned Files Warning */}
                            {storageAnalysis.orphanedFiles.length > 0 && (
                              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded space-y-2">
                                <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span className="font-medium">
                                    Found {storageAnalysis.orphanedFiles.length} orphaned files (
                                    {storageAnalysis.orphanedSizeFormatted})
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  These are incomplete downloads or corrupted files without
                                  metadata. Safe to delete.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCleanupOrphans}
                                  disabled={isCleaningStorage}
                                  className="w-full"
                                >
                                  {isCleaningStorage ? 'Cleaning...' : 'Clean Up Orphaned Files'}
                                </Button>
                              </div>
                            )}

                            {/* Legacy Cache Warning */}
                            {storageAnalysis.breakdown.legacyCache > 0 && (
                              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded space-y-2">
                                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                                  <Info className="h-4 w-4" />
                                  <span className="font-medium">
                                    Legacy cache detected (
                                    {storageAnalysis.breakdownFormatted.legacyCache})
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Old cached data from previous app version. Safe to delete.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleClearLegacyCache}
                                  disabled={isCleaningStorage}
                                  className="w-full"
                                >
                                  {isCleaningStorage ? 'Clearing...' : 'Clear Legacy Cache'}
                                </Button>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-3 border-t">
                              <Button
                                variant="outline"
                                onClick={handleAnalyzeStorage}
                                disabled={isAnalyzingStorage}
                                className="flex-1"
                              >
                                {isAnalyzingStorage ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Analyzing...
                                  </>
                                ) : (
                                  'Refresh'
                                )}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={handleClearAllStorage}
                                disabled={
                                  isCleaningStorage || storageAnalysis.breakdown.total === 0
                                }
                                className="flex-1"
                              >
                                {isCleaningStorage ? 'Clearing...' : 'Clear All'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Security Notice */}
                    <p className="text-xs text-muted-foreground mt-4">
                      Your API keys are stored securely on your device and never sent to our
                      servers.
                    </p>
                  </div>
                </ScrollArea>
              </div>
            )}

            {currentView === 'audio' && (
              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="pr-4 safe-x safe-bottom">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Mic className="h-5 w-5" />
                          Speech to Text Settings
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Configure the model used for voice transcription when using the microphone
                          button
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* STT Model Selection */}
                        <div>
                          <label
                            htmlFor={sttModelSelectId}
                            className="text-sm font-medium mb-2 block"
                          >
                            Transcription Model
                          </label>
                          <select
                            id={sttModelSelectId}
                            value={sttModel}
                            onChange={(e) => handleSttModelChange(e.target.value)}
                            className="w-full p-2 border rounded-md bg-background"
                          >
                            {AVAILABLE_STT_MODELS.map((model) => (
                              <option key={model.value} value={model.value}>
                                {model.label}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-muted-foreground mt-2">
                            Choose which OpenAI model to use for converting speech to text.
                          </p>
                        </div>

                        {/* Note about API Keys */}
                        <p className="text-xs text-muted-foreground border-t pt-4">
                          <strong>Note:</strong> Voice transcription always uses your OpenAI API
                          key, even if you have Anthropic selected as your chat provider. Make sure
                          you have an OpenAI API key configured in the LLM Provider tab.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </div>
            )}

            {currentView === 'appearance' && (
              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="pr-4 safe-x safe-bottom">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Palette className="h-5 w-5" />
                          Theme Settings
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Theme Selection */}
                        <div>
                          <h4 className="text-sm font-medium mb-3">Choose your theme</h4>
                          <div className="grid grid-cols-1 gap-3">
                            {/* System Theme Option */}
                            <button
                              type="button"
                              onClick={() => updateThemePreference('system')}
                              className={`flex items-center justify-between p-4 rounded-lg border transition-colors hover:bg-muted/50 ${
                                themePreference === 'system'
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Monitor className="h-5 w-5" />
                                <div className="text-left">
                                  <div className="font-medium">System</div>
                                  <div className="text-sm text-muted-foreground">
                                    Follow device theme preference
                                  </div>
                                </div>
                              </div>
                              <div
                                className={`w-4 h-4 rounded-full border-2 ${
                                  themePreference === 'system'
                                    ? 'border-primary bg-primary'
                                    : 'border-border'
                                }`}
                              />
                            </button>

                            {/* Light Theme Option */}
                            <button
                              type="button"
                              onClick={() => updateThemePreference('light')}
                              className={`flex items-center justify-between p-4 rounded-lg border transition-colors hover:bg-muted/50 ${
                                themePreference === 'light'
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Sun className="h-5 w-5" />
                                <div className="text-left">
                                  <div className="font-medium">Light</div>
                                  <div className="text-sm text-muted-foreground">
                                    Always use light theme
                                  </div>
                                </div>
                              </div>
                              <div
                                className={`w-4 h-4 rounded-full border-2 ${
                                  themePreference === 'light'
                                    ? 'border-primary bg-primary'
                                    : 'border-border'
                                }`}
                              />
                            </button>

                            {/* Dark Theme Option */}
                            <button
                              type="button"
                              onClick={() => updateThemePreference('dark')}
                              className={`flex items-center justify-between p-4 rounded-lg border transition-colors hover:bg-muted/50 ${
                                themePreference === 'dark'
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Moon className="h-5 w-5" />
                                <div className="text-left">
                                  <div className="font-medium">Dark</div>
                                  <div className="text-sm text-muted-foreground">
                                    Always use dark theme
                                  </div>
                                </div>
                              </div>
                              <div
                                className={`w-4 h-4 rounded-full border-2 ${
                                  themePreference === 'dark'
                                    ? 'border-primary bg-primary'
                                    : 'border-border'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </div>
            )}

            {currentView === 'tools' && (
              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="space-y-3 pr-4 safe-x safe-bottom">
                    {/* Configured Servers */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold">Configured Servers</h2>
                        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                          <DialogTrigger asChild>
                            <Button>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Server
                            </Button>
                          </DialogTrigger>
                          <DialogContent
                            className="w-full h-full max-w-full max-h-full sm:max-w-lg sm:max-h-[90vh] sm:h-auto overflow-hidden flex flex-col m-0 sm:m-6 rounded-none sm:rounded-lg border-0 sm:border"
                            showCloseButton={false}
                          >
                            <DialogHeader className="p-4 sm:p-6 pb-0 sm:pb-0 safe-top safe-x">
                              <div className="flex items-center justify-between">
                                <DialogTitle>Add MCP Server</DialogTitle>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setShowAddDialog(false)}
                                  className="h-10 w-10 p-0 rounded-full"
                                >
                                  <X className="h-6 w-6" />
                                  <span className="sr-only">Close</span>
                                </Button>
                              </div>
                            </DialogHeader>
                            <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 safe-x">
                              <div className="space-y-4 py-4 pb-6">
                                <div>
                                  <label htmlFor={serverNameId} className="text-sm font-medium">
                                    Name *
                                  </label>
                                  <Input
                                    id={serverNameId}
                                    value={newServer.name}
                                    onChange={(e) =>
                                      setNewServer({ ...newServer, name: e.target.value })
                                    }
                                    placeholder="My MCP Server"
                                  />
                                </div>
                                <div>
                                  <label htmlFor={serverUrlId} className="text-sm font-medium">
                                    URL *
                                  </label>
                                  <Input
                                    id={serverUrlId}
                                    value={newServer.url}
                                    onChange={(e) =>
                                      setNewServer({ ...newServer, url: e.target.value })
                                    }
                                    placeholder="https://example.com/mcp"
                                  />
                                </div>
                                <div>
                                  <label htmlFor={transportTypeId} className="text-sm font-medium">
                                    Transport Type
                                  </label>
                                  <select
                                    id={transportTypeId}
                                    value={newServer.transportType}
                                    onChange={(e) =>
                                      setNewServer({
                                        ...newServer,
                                        transportType: e.target.value as 'http-streamable' | 'sse',
                                      })
                                    }
                                    className="w-full p-2 border rounded-md"
                                  >
                                    <option value="http-streamable">
                                      HTTP Streamable (Recommended)
                                    </option>
                                    <option value="sse">SSE (Server-Sent Events)</option>
                                  </select>
                                </div>
                                <div>
                                  <label
                                    htmlFor={serverDescriptionId}
                                    className="text-sm font-medium"
                                  >
                                    Description
                                  </label>
                                  <Textarea
                                    id={serverDescriptionId}
                                    value={newServer.description}
                                    onChange={(e) =>
                                      setNewServer({ ...newServer, description: e.target.value })
                                    }
                                    placeholder="Optional description..."
                                    rows={2}
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    id={serverEnabledId}
                                    checked={newServer.enabled}
                                    onCheckedChange={(enabled) =>
                                      setNewServer({ ...newServer, enabled })
                                    }
                                  />
                                  <label htmlFor={serverEnabledId} className="text-sm">
                                    Enable server
                                  </label>
                                </div>

                                {/* Connection Test Results */}
                                {connectionTestResult && (
                                  <div className="pt-4 border-t">
                                    <Card className="bg-muted/30">
                                      <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          {connectionTestResult.success ? (
                                            <Wifi className="h-4 w-4 text-emerald-600" />
                                          ) : (
                                            <WifiOff className="h-4 w-4 text-red-500" />
                                          )}
                                          <span className="text-sm font-medium">
                                            {connectionTestResult.success
                                              ? 'Connection Successful'
                                              : 'Connection Failed'}
                                          </span>
                                        </div>

                                        {connectionTestResult.success && (
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                              {connectionTestResult.requiresAuth ? (
                                                <>
                                                  <Lock className="h-3 w-3" />
                                                  <span>
                                                    OAuth authentication required (auto-configured)
                                                  </span>
                                                </>
                                              ) : (
                                                <>
                                                  <Unlock className="h-3 w-3" />
                                                  <span>No authentication required</span>
                                                </>
                                              )}
                                            </div>

                                            {connectionTestResult.tools &&
                                              connectionTestResult.tools.length > 0 && (
                                                <div className="border-t border-border/50 pt-2">
                                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                                    <Wrench className="h-3 w-3" />
                                                    <span>
                                                      Available Tools (
                                                      {connectionTestResult.tools.length})
                                                    </span>
                                                  </div>
                                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                                    {connectionTestResult.tools.map(
                                                      (tool, index) => (
                                                        <div
                                                          key={index}
                                                          className="flex items-start gap-2 text-xs p-2 bg-muted/20 rounded"
                                                        >
                                                          <div className="flex-1 min-w-0">
                                                            <div className="font-mono font-medium text-foreground truncate">
                                                              {tool.name}
                                                            </div>
                                                            <div className="text-muted-foreground break-words">
                                                              {tool.description}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      )
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                          </div>
                                        )}

                                        {!connectionTestResult.success &&
                                          connectionTestResult.error && (
                                            <div className="mt-2 space-y-2">
                                              <p className="text-xs text-red-600">
                                                {connectionTestResult.error}
                                              </p>

                                              {connectionTestResult.detailedError && (
                                                <div className="border-t border-border/50 pt-2">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setShowErrorDetails(!showErrorDetails)
                                                    }
                                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                  >
                                                    {showErrorDetails ? (
                                                      <ChevronDown className="h-3 w-3" />
                                                    ) : (
                                                      <ChevronRight className="h-3 w-3" />
                                                    )}
                                                    <Info className="h-3 w-3" />
                                                    Error Details
                                                  </button>

                                                  {showErrorDetails && (
                                                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded text-xs space-y-1">
                                                      <div className="font-mono text-red-700 dark:text-red-300">
                                                        {connectionTestResult.detailedError.message}
                                                      </div>

                                                      {connectionTestResult.detailedError
                                                        .httpStatus && (
                                                        <div className="flex items-center gap-2">
                                                          <Network className="h-3 w-3 text-muted-foreground" />
                                                          <span className="text-muted-foreground">
                                                            HTTP Status:
                                                          </span>
                                                          <span className="font-mono">
                                                            {
                                                              connectionTestResult.detailedError
                                                                .httpStatus
                                                            }{' '}
                                                            {
                                                              connectionTestResult.detailedError
                                                                .httpStatusText
                                                            }
                                                          </span>
                                                        </div>
                                                      )}

                                                      {connectionTestResult.detailedError
                                                        .jsonRpcError && (
                                                        <div className="space-y-1">
                                                          <div className="flex items-center gap-2">
                                                            <span className="text-muted-foreground">
                                                              JSON-RPC Error:
                                                            </span>
                                                          </div>
                                                          <div className="pl-4 space-y-1">
                                                            <div className="font-mono text-xs">
                                                              Code:{' '}
                                                              {
                                                                connectionTestResult.detailedError
                                                                  .jsonRpcError.code
                                                              }
                                                            </div>
                                                            <div className="font-mono text-xs">
                                                              Message:{' '}
                                                              {
                                                                connectionTestResult.detailedError
                                                                  .jsonRpcError.message
                                                              }
                                                            </div>
                                                            {connectionTestResult.detailedError
                                                              .jsonRpcError.data != null && (
                                                              <div className="font-mono text-xs">
                                                                Data:{' '}
                                                                {JSON.stringify(
                                                                  connectionTestResult.detailedError
                                                                    .jsonRpcError.data,
                                                                  null,
                                                                  2
                                                                ) || 'null'}
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                      )}

                                                      {connectionTestResult.detailedError
                                                        .responseBody && (
                                                        <div className="space-y-1">
                                                          <span className="text-muted-foreground">
                                                            Response:
                                                          </span>
                                                          <pre className="font-mono text-xs bg-muted/50 p-1 rounded overflow-x-auto max-w-full">
                                                            {connectionTestResult.detailedError
                                                              .responseBody.length > 200
                                                              ? `${connectionTestResult.detailedError.responseBody.substring(0, 200)}...`
                                                              : connectionTestResult.detailedError
                                                                  .responseBody}
                                                          </pre>
                                                        </div>
                                                      )}

                                                      {connectionTestResult.detailedError
                                                        .responseHeaders &&
                                                        Object.keys(
                                                          connectionTestResult.detailedError
                                                            .responseHeaders
                                                        ).length > 0 && (
                                                          <div className="space-y-1">
                                                            <span className="text-muted-foreground">
                                                              Headers:
                                                            </span>
                                                            <div className="pl-2 space-y-1">
                                                              {Object.entries(
                                                                connectionTestResult.detailedError
                                                                  .responseHeaders
                                                              ).map(([key, value]) => (
                                                                <div
                                                                  key={key}
                                                                  className="font-mono text-xs"
                                                                >
                                                                  <span className="text-muted-foreground">
                                                                    {key}:
                                                                  </span>{' '}
                                                                  {value}
                                                                </div>
                                                              ))}
                                                            </div>
                                                          </div>
                                                        )}

                                                      <div className="flex items-center gap-4 pt-1 border-t border-border/30">
                                                        <div className="flex items-center gap-1">
                                                          <Clock className="h-3 w-3 text-muted-foreground" />
                                                          <span className="text-muted-foreground">
                                                            Duration:
                                                          </span>
                                                          <span className="font-mono">
                                                            {connectionTestResult.detailedError
                                                              .duration || 0}
                                                            ms
                                                          </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                          <span className="text-muted-foreground">
                                                            Time:
                                                          </span>
                                                          <span className="font-mono text-xs">
                                                            {new Date(
                                                              connectionTestResult.detailedError
                                                                .timestamp
                                                            ).toLocaleTimeString()}
                                                          </span>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                      </CardContent>
                                    </Card>
                                  </div>
                                )}
                              </div>
                            </ScrollArea>

                            {/* Dialog Footer with Action Buttons */}
                            <div className="border-t p-4 sm:p-6 pt-4 sm:pt-6 bg-background safe-bottom safe-x">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={handleTestConnection}
                                  disabled={isTestingConnection || !newServer.url.trim()}
                                  className="flex-1"
                                >
                                  <TestTube className="h-4 w-4 mr-2" />
                                  {isTestingConnection ? 'Testing...' : 'Test Connection'}
                                </Button>
                                <Button onClick={handleAddServer} className="flex-1">
                                  Add Server
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Edit Server Dialog */}
                        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                          <DialogContent
                            className="w-full h-full max-w-full max-h-full sm:max-w-lg sm:max-h-[90vh] sm:h-auto overflow-hidden flex flex-col m-0 sm:m-6 rounded-none sm:rounded-lg border-0 sm:border"
                            showCloseButton={false}
                          >
                            <DialogHeader className="p-4 sm:p-6 pb-0 sm:pb-0 safe-top safe-x">
                              <div className="flex items-center justify-between">
                                <DialogTitle>Edit MCP Server</DialogTitle>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setShowEditDialog(false)}
                                  className="h-14 w-14 p-0"
                                >
                                  <X className="size-8" />
                                  <span className="sr-only">Close</span>
                                </Button>
                              </div>
                            </DialogHeader>
                            <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 safe-x">
                              <div className="space-y-4 py-4 pb-6">
                                <div>
                                  <label htmlFor={editServerNameId} className="text-sm font-medium">
                                    Name *
                                  </label>
                                  <Input
                                    id={editServerNameId}
                                    value={editServer.name}
                                    onChange={(e) =>
                                      setEditServer({ ...editServer, name: e.target.value })
                                    }
                                    placeholder="My MCP Server"
                                  />
                                </div>
                                <div>
                                  <label htmlFor={editServerUrlId} className="text-sm font-medium">
                                    URL *
                                  </label>
                                  <Input
                                    id={editServerUrlId}
                                    value={editServer.url}
                                    onChange={(e) =>
                                      setEditServer({ ...editServer, url: e.target.value })
                                    }
                                    placeholder="https://example.com/mcp"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={editTransportTypeId}
                                    className="text-sm font-medium"
                                  >
                                    Transport Type
                                  </label>
                                  <select
                                    id={editTransportTypeId}
                                    value={editServer.transportType}
                                    onChange={(e) =>
                                      setEditServer({
                                        ...editServer,
                                        transportType: e.target.value as 'http-streamable' | 'sse',
                                      })
                                    }
                                    className="w-full p-2 border rounded-md"
                                  >
                                    <option value="http-streamable">
                                      HTTP Streamable (Recommended)
                                    </option>
                                    <option value="sse">SSE (Server-Sent Events)</option>
                                  </select>
                                </div>
                                <div>
                                  <label
                                    htmlFor={editServerDescriptionId}
                                    className="text-sm font-medium"
                                  >
                                    Description
                                  </label>
                                  <Textarea
                                    id={editServerDescriptionId}
                                    value={editServer.description}
                                    onChange={(e) =>
                                      setEditServer({ ...editServer, description: e.target.value })
                                    }
                                    placeholder="Optional description..."
                                    rows={2}
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    id={editServerEnabledId}
                                    checked={editServer.enabled}
                                    onCheckedChange={(enabled) =>
                                      setEditServer({ ...editServer, enabled })
                                    }
                                  />
                                  <label htmlFor={editServerEnabledId} className="text-sm">
                                    Enable server
                                  </label>
                                </div>
                              </div>
                            </ScrollArea>

                            {/* Dialog Footer with Action Buttons */}
                            <div className="border-t p-4 sm:p-6 pt-4 sm:pt-6 bg-background safe-bottom safe-x">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                                <Button onClick={handleEditServer} className="flex-1">
                                  Save Changes
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>

                      {/* Server List */}
                      <div className="space-y-3">
                        {servers.length === 0 ? (
                          <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                              <SettingsIcon className="h-12 w-12 text-muted-foreground mb-4" />
                              <h3 className="text-lg font-medium mb-2">
                                No MCP Servers Configured
                              </h3>
                              <p className="text-muted-foreground mb-4">
                                Add your first MCP server to enhance your AI conversations with
                                external tools and data.
                              </p>
                              <Button onClick={() => setShowAddDialog(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Your First Server
                              </Button>
                            </CardContent>
                          </Card>
                        ) : (
                          servers.map((server) => {
                            const status = serverStatuses.get(server.id);
                            return (
                              <Card key={server.id}>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-lg flex items-center">
                                    {server.name}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 sm:p-4 pt-0">
                                  <div className="flex flex-col gap-3 sm:gap-4">
                                    <div className="flex flex-row gap-3 justify-between items-start">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground mb-2 break-all">
                                          {server.url}
                                        </p>
                                        {server.description && (
                                          <p className="text-sm text-muted-foreground mb-2">
                                            {server.description}
                                          </p>
                                        )}
                                        {status?.toolCount !== undefined && (
                                          <p className="text-xs text-muted-foreground">
                                            {status.toolCount} tools available
                                          </p>
                                        )}
                                        {status?.error && (
                                          <p className="text-xs text-red-500 mt-1 break-words">
                                            Error: {status.error}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex flex-col gap-2 items-end">
                                        {status?.connected ? (
                                          <Badge
                                            variant="default"
                                            className="bg-emerald-600 text-xs"
                                          >
                                            <Wifi className="h-3 w-3 mr-1" />
                                            Connected
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-xs">
                                            <WifiOff className="h-3 w-3 mr-1" />
                                            Disconnected
                                          </Badge>
                                        )}
                                        <Badge variant="outline" className="text-xs">
                                          {server.transportType === 'http-streamable'
                                            ? 'HTTP-STREAMABLE'
                                            : server.transportType.toUpperCase()}
                                        </Badge>
                                        {(server.requiresAuth || server.oauthDiscovery) &&
                                          (oauthStatuses.get(server.id) ? (
                                            <Badge
                                              variant="default"
                                              className="bg-blue-500 text-xs"
                                            >
                                              <Unlock className="h-3 w-3 mr-1" />
                                              OAuth Connected
                                            </Badge>
                                          ) : server.requiresAuth ? (
                                            <Badge
                                              variant="destructive"
                                              className="text-xs bg-transparent"
                                            >
                                              <Lock className="h-3 w-3 mr-1" />
                                              OAuth Required
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs">
                                              <Unlock className="h-3 w-3 mr-1" />
                                              OAuth Available
                                            </Badge>
                                          ))}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 border-t border-border/50">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">
                                          Enabled
                                        </span>
                                        <Switch
                                          checked={server.enabled}
                                          onCheckedChange={(enabled) =>
                                            handleToggleServer(server.id, enabled)
                                          }
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {(server.requiresAuth || server.oauthDiscovery) &&
                                          (oauthStatuses.get(server.id) ? (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleOAuthDisconnect(server.id)}
                                              className="px-3 py-2"
                                              title="Disconnect OAuth Authentication"
                                            >
                                              <Lock className="h-4 w-4" />
                                            </Button>
                                          ) : (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleOAuthAuthenticate(server.id)}
                                              className="px-3 py-2"
                                              title={
                                                server.requiresAuth
                                                  ? 'OAuth Authentication Required'
                                                  : 'Connect with OAuth (Optional)'
                                              }
                                            >
                                              <Unlock className="h-4 w-4" />
                                            </Button>
                                          ))}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleStartEditServer(server)}
                                          disabled={server.readonly}
                                          className="px-3 py-2"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleRemoveServer(server.id)}
                                          className="px-3 py-2"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            )}

            {currentView === 'acp' && (
              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="space-y-3 pr-4 safe-x safe-bottom">
                    {/* Configured ACP Agents */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold">Configured Agents</h2>
                        <Dialog open={showAcpAddDialog} onOpenChange={setShowAcpAddDialog}>
                          <DialogTrigger asChild>
                            <Button>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Agent
                            </Button>
                          </DialogTrigger>
                          <DialogContent
                            className="w-full h-full max-w-full max-h-full sm:max-w-lg sm:max-h-[90vh] sm:h-auto overflow-hidden flex flex-col m-0 sm:m-6 rounded-none sm:rounded-lg border-0 sm:border"
                            showCloseButton={false}
                          >
                            <DialogHeader className="p-4 sm:p-6 pb-0 sm:pb-0 safe-top safe-x">
                              <div className="flex items-center justify-between">
                                <DialogTitle>Add ACP Agent</DialogTitle>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setShowAcpAddDialog(false)}
                                  className="h-10 w-10 p-0 rounded-full"
                                >
                                  <X className="h-6 w-6" />
                                  <span className="sr-only">Close</span>
                                </Button>
                              </div>
                            </DialogHeader>
                            <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 safe-x">
                              <div className="space-y-4 py-4 pb-6">
                                <div>
                                  <label htmlFor={acpServerNameId} className="text-sm font-medium">
                                    Name *
                                  </label>
                                  <Input
                                    id={acpServerNameId}
                                    value={newAcpServer.name}
                                    onChange={(e) =>
                                      setNewAcpServer({ ...newAcpServer, name: e.target.value })
                                    }
                                    placeholder="My Coding Agent"
                                  />
                                </div>
                                <div>
                                  <label htmlFor={acpServerUrlId} className="text-sm font-medium">
                                    URL *
                                  </label>
                                  <Input
                                    id={acpServerUrlId}
                                    value={newAcpServer.url}
                                    onChange={(e) =>
                                      setNewAcpServer({ ...newAcpServer, url: e.target.value })
                                    }
                                    placeholder="https://agent.example.com"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={acpServerDescriptionId}
                                    className="text-sm font-medium"
                                  >
                                    Description
                                  </label>
                                  <Textarea
                                    id={acpServerDescriptionId}
                                    value={newAcpServer.description}
                                    onChange={(e) =>
                                      setNewAcpServer({
                                        ...newAcpServer,
                                        description: e.target.value,
                                      })
                                    }
                                    placeholder="Optional description..."
                                    rows={2}
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    id={acpServerEnabledId}
                                    checked={newAcpServer.enabled}
                                    onCheckedChange={(enabled) =>
                                      setNewAcpServer({ ...newAcpServer, enabled })
                                    }
                                  />
                                  <label htmlFor={acpServerEnabledId} className="text-sm">
                                    Enable agent
                                  </label>
                                </div>
                              </div>
                            </ScrollArea>

                            {/* Dialog Footer with Action Buttons */}
                            <div className="border-t p-4 sm:p-6 pt-4 sm:pt-6 bg-background safe-bottom safe-x">
                              <div className="flex gap-2">
                                <Button onClick={handleAddAcpServer} className="flex-1">
                                  Add Agent
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Edit ACP Agent Dialog */}
                        <Dialog open={showAcpEditDialog} onOpenChange={setShowAcpEditDialog}>
                          <DialogContent
                            className="w-full h-full max-w-full max-h-full sm:max-w-lg sm:max-h-[90vh] sm:h-auto overflow-hidden flex flex-col m-0 sm:m-6 rounded-none sm:rounded-lg border-0 sm:border"
                            showCloseButton={false}
                          >
                            <DialogHeader className="p-4 sm:p-6 pb-0 sm:pb-0 safe-top safe-x">
                              <div className="flex items-center justify-between">
                                <DialogTitle>Edit ACP Agent</DialogTitle>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setShowAcpEditDialog(false)}
                                  className="h-14 w-14 p-0"
                                >
                                  <X className="size-8" />
                                  <span className="sr-only">Close</span>
                                </Button>
                              </div>
                            </DialogHeader>
                            <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 safe-x">
                              <div className="space-y-4 py-4 pb-6">
                                <div>
                                  <label
                                    htmlFor={editAcpServerNameId}
                                    className="text-sm font-medium"
                                  >
                                    Name *
                                  </label>
                                  <Input
                                    id={editAcpServerNameId}
                                    value={editAcpServer.name}
                                    onChange={(e) =>
                                      setEditAcpServer({ ...editAcpServer, name: e.target.value })
                                    }
                                    placeholder="My Coding Agent"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={editAcpServerUrlId}
                                    className="text-sm font-medium"
                                  >
                                    URL *
                                  </label>
                                  <Input
                                    id={editAcpServerUrlId}
                                    value={editAcpServer.url}
                                    onChange={(e) =>
                                      setEditAcpServer({ ...editAcpServer, url: e.target.value })
                                    }
                                    placeholder="https://agent.example.com"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={editAcpServerDescriptionId}
                                    className="text-sm font-medium"
                                  >
                                    Description
                                  </label>
                                  <Textarea
                                    id={editAcpServerDescriptionId}
                                    value={editAcpServer.description}
                                    onChange={(e) =>
                                      setEditAcpServer({
                                        ...editAcpServer,
                                        description: e.target.value,
                                      })
                                    }
                                    placeholder="Optional description..."
                                    rows={2}
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    id={editAcpServerEnabledId}
                                    checked={editAcpServer.enabled}
                                    onCheckedChange={(enabled) =>
                                      setEditAcpServer({ ...editAcpServer, enabled })
                                    }
                                  />
                                  <label htmlFor={editAcpServerEnabledId} className="text-sm">
                                    Enable agent
                                  </label>
                                </div>
                              </div>
                            </ScrollArea>

                            {/* Dialog Footer with Action Buttons */}
                            <div className="border-t p-4 sm:p-6 pt-4 sm:pt-6 bg-background safe-bottom safe-x">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={handleCancelAcpEdit}
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                                <Button onClick={handleUpdateAcpServer} className="flex-1">
                                  Save Changes
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>

                      {/* ACP Agent List */}
                      <div className="space-y-3">
                        {acpServers.length === 0 ? (
                          <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                              <Network className="h-12 w-12 text-muted-foreground mb-4" />
                              <h3 className="text-lg font-medium mb-2">No ACP Agents Configured</h3>
                              <p className="text-muted-foreground mb-4">
                                Add your first ACP agent to connect to AI coding assistants.
                              </p>
                              <Button onClick={() => setShowAcpAddDialog(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Your First Agent
                              </Button>
                            </CardContent>
                          </Card>
                        ) : (
                          acpServers.map((server) => {
                            const status = acpServerStatuses.get(server.id);
                            return (
                              <Card key={server.id}>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-lg flex items-center">
                                    {server.name}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 sm:p-4 pt-0">
                                  <div className="flex flex-col gap-3 sm:gap-4">
                                    <div className="flex flex-row gap-3 justify-between items-start">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground mb-2 break-all">
                                          {server.url}
                                        </p>
                                        {server.description && (
                                          <p className="text-sm text-muted-foreground mb-2">
                                            {server.description}
                                          </p>
                                        )}
                                        {status?.error && (
                                          <p className="text-xs text-red-500 mt-1 break-words">
                                            Error: {status.error}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex flex-col gap-2 items-end">
                                        {status?.connected ? (
                                          <Badge
                                            variant="default"
                                            className="bg-emerald-600 text-xs"
                                          >
                                            <Wifi className="h-3 w-3 mr-1" />
                                            Connected
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-xs">
                                            <WifiOff className="h-3 w-3 mr-1" />
                                            Disconnected
                                          </Badge>
                                        )}
                                        {server.requiresAuth && (
                                          <Badge
                                            variant="destructive"
                                            className="text-xs bg-transparent"
                                          >
                                            <Lock className="h-3 w-3 mr-1" />
                                            OAuth Required
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 border-t border-border/50">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">
                                          Enabled
                                        </span>
                                        <Switch
                                          checked={server.enabled}
                                          onCheckedChange={(enabled) =>
                                            handleToggleAcpServer(server.id, enabled)
                                          }
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleTestAcpConnection(server.id)}
                                          className="px-3 py-2"
                                          title="Test Connection"
                                        >
                                          <TestTube className="h-4 w-4" />
                                        </Button>
                                        {server.requiresAuth && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleAcpOAuthStart(server.id)}
                                            className="px-3 py-2"
                                            title="Connect with OAuth"
                                          >
                                            <Unlock className="h-4 w-4" />
                                          </Button>
                                        )}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleStartEditAcpServer(server)}
                                          className="px-3 py-2"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleRemoveAcpServer(server.id)}
                                          className="px-3 py-2"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            )}

            {currentView === 'debug' && (
              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="pr-4 safe-x safe-bottom space-y-4">
                    {/* Header */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Bug className="h-5 w-5" />
                        <h2 className="text-lg font-semibold">Debug Logs</h2>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        View OAuth authentication and MCP server connection logs for troubleshooting
                      </p>
                    </div>

                    {/* Debug Controls */}
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                          <label htmlFor={debugFilterId} className="text-sm font-medium">
                            Category:
                          </label>
                          <select
                            id={debugFilterId}
                            value={debugFilter}
                            onChange={(e) => setDebugFilter(e.target.value as typeof debugFilter)}
                            className="px-2 py-1 text-sm border rounded bg-background"
                          >
                            <option value="all">All</option>
                            <option value="chat">Chat</option>
                            <option value="audio">Audio</option>
                            <option value="oauth">OAuth</option>
                            <option value="mcp">MCP</option>
                            <option value="general">General</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor={debugLevelFilterId} className="text-sm font-medium">
                            Level:
                          </label>
                          <select
                            id={debugLevelFilterId}
                            value={debugLevelFilter}
                            onChange={(e) =>
                              setDebugLevelFilter(e.target.value as typeof debugLevelFilter)
                            }
                            className="px-2 py-1 text-sm border rounded bg-background"
                          >
                            <option value="all">All</option>
                            <option value="info">Info</option>
                            <option value="warn">Warn</option>
                            <option value="error">Error</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyLogs}
                          className="flex items-center gap-1"
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearLogs}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-4 w-4" />
                          Clear
                        </Button>
                      </div>
                    </div>

                    {/* WebGPU Test Section */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TestTube className="h-5 w-5" />
                          WebGPU Support Test
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Test WebGPU availability on this device. Results are logged to Sentry for
                          remote monitoring and debugging.
                        </p>
                        <Button
                          onClick={handleTestWebGPU}
                          disabled={isTestingWebGPU}
                          className="w-full sm:w-auto"
                        >
                          {isTestingWebGPU ? 'Testing...' : 'Test WebGPU Support'}
                        </Button>
                        {webgpuTestResult && (
                          <div className="mt-3 p-3 bg-muted/30 rounded-md font-mono text-xs whitespace-pre-wrap">
                            {webgpuTestResult}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Local AI Capability Test Section */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="h-5 w-5" />
                          Local AI Capability
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Check if Gemma 3 270M local AI is available on this device. Requires
                          WebGPU support for on-device inference.
                        </p>
                        <Button
                          onClick={handleTestLocalAI}
                          disabled={isTestingLocalAI}
                          className="w-full sm:w-auto"
                        >
                          {isTestingLocalAI ? 'Testing...' : 'Test Local AI'}
                        </Button>
                        {localAITestResult && (
                          <div className="mt-3 p-3 bg-muted/30 rounded-md font-mono text-xs whitespace-pre-wrap">
                            {localAITestResult}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Debug Log Display */}
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Debug Logs</h3>
                      <div className="bg-muted/30 rounded-md p-3 font-mono text-xs">
                        {getFilteredLogs().length === 0 ? (
                          <div className="text-muted-foreground text-center py-8">
                            {debugFilter === 'all'
                              ? 'No debug logs yet. Try OAuth authentication or MCP server operations to see logs here.'
                              : `No ${debugFilter} logs found.`}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {getFilteredLogs().map((log, index) => (
                              <div
                                key={`${log.timestamp}-${index}`}
                                className={`p-2 rounded border-l-2 ${
                                  log.level === 'error'
                                    ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20'
                                    : log.level === 'warn'
                                      ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20'
                                      : 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-muted-foreground">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                                      log.level === 'error'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                        : log.level === 'warn'
                                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                    }`}
                                  >
                                    {log.level.toUpperCase()}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                                      log.category === 'chat'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                        : log.category === 'audio'
                                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                                          : log.category === 'oauth'
                                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                                            : log.category === 'mcp'
                                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                              : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
                                    }`}
                                  >
                                    {log.category.toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-foreground whitespace-pre-wrap break-all">
                                  {log.message}
                                </div>
                                {log.data != null && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                      Show data
                                    </summary>
                                    <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-all">
                                      {typeof log.data === 'string'
                                        ? log.data
                                        : JSON.stringify(log.data, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Debug Info Footer */}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Total logs: {debugLogs.length}</div>
                      <div>Filtered logs: {getFilteredLogs().length}</div>
                      <div>
                        Categories: Audio transcription, OAuth authentication, MCP server
                        connections, general app logs
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            )}

            {currentView === 'about' && (
              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="pr-4 safe-x safe-bottom space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Info className="h-5 w-5" />
                          App Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* App Name */}
                        <div>
                          <h3 className="text-lg font-semibold">cawcaw</h3>
                          <hr className="mt-2" />
                        </div>

                        {/* Version Info */}
                        <div className="space-y-2 border-t pt-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Version:</span>
                            <span className="font-mono">{__APP_VERSION__}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Build:</span>
                            <span className="font-mono text-xs">{__BUILD_NUMBER__}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Commit:</span>
                            <span className="font-mono text-xs">{__COMMIT_HASH__}</span>
                          </div>
                        </div>

                        {/* GitHub Link */}
                        <div className="border-t pt-4">
                          <a
                            href="https://github.com/dbirks/cawcaw"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-blue-500 hover:underline"
                          >
                            <Github className="h-5 w-5" />
                            <span>View on GitHub</span>
                          </a>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Built With Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Hammer className="h-5 w-5" />
                          Built With
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">powered by:</p>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href="https://sdk.vercel.ai/docs/introduction"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-sm text-blue-600 dark:text-blue-400 transition-colors"
                          >
                            Vercel AI SDK
                          </a>
                          <a
                            href="https://ai-sdk.dev/elements/overview"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-sm text-blue-600 dark:text-blue-400 transition-colors"
                          >
                            AI Elements
                          </a>
                          <a
                            href="https://ui.shadcn.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-sm text-blue-600 dark:text-blue-400 transition-colors"
                          >
                            shadcn/ui
                          </a>
                          <a
                            href="https://vite.dev/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-sm text-blue-600 dark:text-blue-400 transition-colors"
                          >
                            Vite
                          </a>
                          <a
                            href="https://capacitorjs.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-sm text-blue-600 dark:text-blue-400 transition-colors"
                          >
                            Capacitor
                          </a>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Help Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BookOpen className="h-5 w-5" />
                          To learn more
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          If you encounter any issues or find bugs, please visit the{' '}
                          <a
                            href="https://github.com/dbirks/cawcaw"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            GitHub repository
                          </a>{' '}
                          and submit a ticket in{' '}
                          <a
                            href="https://github.com/dbirks/cawcaw/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Issues
                          </a>
                          . The{' '}
                          <a
                            href="https://github.com/dbirks/cawcaw#readme"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            README
                          </a>{' '}
                          has more information about the app and instructions on how to build it
                          locally if you want to.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
