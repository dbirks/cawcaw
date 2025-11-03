import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import {
  Brain,
  Bug,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Edit,
  Info,
  Lock,
  Mic,
  Monitor,
  Moon,
  Network,
  Palette,
  Plus,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/hooks/useTheme';
import { type DebugLogEntry, debugLogger } from '@/services/debugLogger';
import { mcpManager } from '@/services/mcpManager';
import type { MCPOAuthDiscovery, MCPServerConfig, MCPServerStatus } from '@/types/mcp';

interface SettingsProps {
  onClose: () => void;
}

// Available AI models
const AVAILABLE_MODELS = [
  // OpenAI Models
  { value: 'gpt-4o-2024-11-20', label: 'GPT-4o', provider: 'openai' },
  { value: 'gpt-4o', label: 'GPT-4o (latest)', provider: 'openai' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { value: 'gpt-4-turbo-2024-04-09', label: 'GPT-4 Turbo', provider: 'openai' },
  { value: 'gpt-4.5-preview', label: 'GPT-4.5 Preview', provider: 'openai' },
  { value: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai' },
  { value: 'o4-mini', label: 'o4-mini', provider: 'openai' },
  { value: 'o3', label: 'o3', provider: 'openai' },
  { value: 'o3-mini', label: 'o3-mini', provider: 'openai' },

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
  {
    value: 'claude-opus-4-20250514',
    label: 'Claude Opus 4',
    provider: 'anthropic',
  },
] as const;

// Available STT (Speech-to-Text) models
const AVAILABLE_STT_MODELS = [
  { value: 'whisper-1', label: 'whisper-1' },
  { value: 'gpt-4o-mini-transcribe', label: 'gpt-4o-mini-transcribe' },
  { value: 'gpt-4o-transcribe', label: 'gpt-4o-transcribe' },
] as const;

export default function Settings({ onClose }: SettingsProps) {
  // MCP state
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Map<string, MCPServerStatus>>(new Map());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('llm');

  // Debug logs state
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [debugFilter, setDebugFilter] = useState<'all' | 'oauth' | 'mcp' | 'general'>('all');
  const debugFilterId = useId();

  // API Key state
  const [apiKey, setApiKey] = useState<string>('');
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>('');
  const [isUpdatingAnthropicKey, setIsUpdatingAnthropicKey] = useState(false);

  // Provider and model state
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'anthropic'>('openai');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
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
  const providerSelectId = useId();
  const modelSelectId = useId();
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

      // Load provider and model preferences
      const providerResult = await SecureStoragePlugin.get({ key: 'selected_provider' });
      if (providerResult?.value) {
        setSelectedProvider(providerResult.value as 'openai' | 'anthropic');
      }

      const modelResult = await SecureStoragePlugin.get({ key: 'selected_model' });
      if (modelResult?.value) {
        setSelectedModel(modelResult.value);
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
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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

  const handleProviderChange = async (provider: 'openai' | 'anthropic') => {
    setSelectedProvider(provider);
    try {
      await SecureStoragePlugin.set({ key: 'selected_provider', value: provider });
    } catch (error) {
      console.error('Failed to save provider preference:', error);
    }
  };

  const handleModelChange = async (model: string) => {
    setSelectedModel(model);
    try {
      await SecureStoragePlugin.set({ key: 'selected_model', value: model });
    } catch (error) {
      console.error('Failed to save model preference:', error);
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
    if (debugFilter === 'all') return debugLogs;
    return debugLogs.filter((log) => log.category === debugFilter);
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

  if (isLoading) {
    return (
      <div className="h-dvh bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Settings</h1>
            <Button variant="outline" onClick={onClose}>
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
        {/* Header with safe area */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 pt-4 pb-4 safe-top safe-x">
          <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
          <Button variant="outline" onClick={onClose} size="sm" className="sm:size-default">
            <X className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Close</span>
          </Button>
        </div>

        {/* Settings Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger
              value="llm"
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">LLM Provider</span>
              <span className="sm:hidden">LLM</span>
            </TabsTrigger>
            <TabsTrigger
              value="audio"
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Speech & Audio</span>
              <span className="sm:hidden">Audio</span>
            </TabsTrigger>
            <TabsTrigger
              value="tools"
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Tools & MCP</span>
              <span className="sm:hidden">MCP</span>
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Appearance</span>
              <span className="sm:hidden">Theme</span>
            </TabsTrigger>
            <TabsTrigger
              value="debug"
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <Bug className="h-4 w-4" />
              <span className="hidden sm:inline">Debug</span>
              <span className="sm:hidden">Debug</span>
            </TabsTrigger>
          </TabsList>

          {/* LLM Provider Tab */}
          <TabsContent value="llm" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="pr-4 safe-x safe-bottom">
                  <Card>
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
                            href="https://console.anthropic.com"
                            className="text-[#C15F3C] hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Anthropic Console
                          </a>
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Provider Selection */}
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>Provider & Model Selection</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Provider Selection */}
                      <div>
                        <label
                          htmlFor={providerSelectId}
                          className="text-sm font-medium mb-2 block"
                        >
                          AI Provider
                        </label>
                        <select
                          id={providerSelectId}
                          value={selectedProvider}
                          onChange={(e) =>
                            handleProviderChange(e.target.value as 'openai' | 'anthropic')
                          }
                          className="w-full p-2 border rounded-md bg-background"
                        >
                          <option value="openai">OpenAI</option>
                          <option value="anthropic">Anthropic (Claude)</option>
                        </select>
                      </div>

                      {/* Model Selection with Provider Grouping */}
                      <div>
                        <label htmlFor={modelSelectId} className="text-sm font-medium mb-2 block">
                          Chat Model
                        </label>
                        <select
                          id={modelSelectId}
                          value={selectedModel}
                          onChange={(e) => handleModelChange(e.target.value)}
                          className="w-full p-2 border rounded-md bg-background"
                        >
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
                      </div>

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

                  {/* Security Notice */}
                  <p className="text-xs text-muted-foreground mt-4">
                    Your API keys are stored securely on your device and never sent to our servers.
                  </p>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Speech & Audio Tab */}
          <TabsContent value="audio" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="pr-4 safe-x safe-bottom">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mic className="h-5 w-5" />
                        Speech-to-Text (STT) Configuration
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
                          Choose which OpenAI model to use for converting speech to text. GPT-4o
                          Mini Transcribe is recommended for best balance of speed, accuracy, and
                          cost.
                        </p>
                      </div>

                      {/* Model Comparison Info */}
                      <div className="border rounded-md p-4 bg-muted/30 space-y-3">
                        <h4 className="text-sm font-medium">Model Comparison</h4>
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground">
                              GPT-4o Transcribe (Premium)
                            </span>
                            <span>
                              • Best accuracy and error rates
                              <br />• Excellent for accents, noise, and complex speech
                              <br />• Cost: $0.006/minute ($6 per 1M audio tokens)
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground">
                              GPT-4o Mini Transcribe (Recommended)
                            </span>
                            <span>
                              • Great accuracy at half the cost
                              <br />• Ideal for most use cases
                              <br />• Cost: $0.003/minute ($3 per 1M audio tokens)
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground">Whisper-1 (Legacy)</span>
                            <span>
                              • Original OpenAI speech model from 2022
                              <br />• Good for clean audio
                              <br />• Cost: $0.006/minute (same as GPT-4o Transcribe)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Note about API Keys */}
                      <p className="text-xs text-muted-foreground border-t pt-4">
                        <strong>Note:</strong> Voice transcription always uses your OpenAI API key,
                        even if you have Anthropic selected as your chat provider. Make sure you
                        have an OpenAI API key configured in the LLM Provider tab.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="flex-1 flex flex-col overflow-hidden">
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
          </TabsContent>

          {/* Tools & MCP Tab */}
          <TabsContent value="tools" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="space-y-6 pr-4 safe-x safe-bottom">
                  {/* Configured Servers */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">Configured Servers</h2>
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
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAddDialog(false)}
                                className="h-8 w-8 p-0 rounded-full"
                              >
                                <X className="h-4 w-4" />
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
                                          <Wifi className="h-4 w-4 text-green-500" />
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
                                                  {connectionTestResult.tools.map((tool, index) => (
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
                                                  ))}
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
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowEditDialog(false)}
                                className="h-8 w-8 p-0 rounded-full"
                              >
                                <X className="h-4 w-4" />
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
                    <div className="space-y-4">
                      {servers.length === 0 ? (
                        <Card className="border-dashed">
                          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                            <SettingsIcon className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No MCP Servers Configured</h3>
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
                              <CardContent className="p-3 sm:p-4">
                                <div className="flex flex-col gap-3 sm:gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="mb-3">
                                      <h3 className="font-medium mb-2">{server.name}</h3>
                                      <div className="flex flex-wrap gap-2">
                                        {status?.connected ? (
                                          <Badge variant="default" className="bg-green-500 text-xs">
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
                                            <Badge variant="destructive" className="text-xs">
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
                                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 border-t border-border/50">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-muted-foreground">Enabled</span>
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
          </TabsContent>

          {/* Debug Tab */}
          <TabsContent value="debug" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="pr-4 safe-x safe-bottom">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bug className="h-5 w-5" />
                        Debug Logs
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        View OAuth authentication and MCP server connection logs for troubleshooting
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Debug Controls */}
                      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                        <div className="flex items-center gap-2">
                          <label htmlFor={debugFilterId} className="text-sm font-medium">
                            Filter:
                          </label>
                          <select
                            id={debugFilterId}
                            value={debugFilter}
                            onChange={(e) => setDebugFilter(e.target.value as typeof debugFilter)}
                            className="px-2 py-1 text-sm border rounded bg-background"
                          >
                            <option value="all">All Logs</option>
                            <option value="oauth">OAuth Only</option>
                            <option value="mcp">MCP Only</option>
                            <option value="general">General Only</option>
                          </select>
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

                      {/* Debug Log Display */}
                      <div className="bg-muted/30 rounded-md p-3 min-h-[300px] max-h-[500px] overflow-y-auto font-mono text-xs">
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
                                      log.category === 'oauth'
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                                        : log.category === 'mcp'
                                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
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

                      {/* Debug Info */}
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Total logs: {debugLogs.length}</div>
                        <div>Filtered logs: {getFilteredLogs().length}</div>
                        <div>
                          Categories: OAuth authentication, MCP server connections, general app logs
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
