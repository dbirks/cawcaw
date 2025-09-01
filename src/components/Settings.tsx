import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit,
  Info,
  Lock,
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
import { mcpManager } from '@/services/mcpManager';
import type { MCPServerConfig, MCPServerStatus } from '@/types/mcp';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  // MCP state
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Map<string, MCPServerStatus>>(new Map());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('llm');

  // API Key state
  const [apiKey, setApiKey] = useState<string>('');
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);

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

      // Load current API key
      const result = await SecureStoragePlugin.get({ key: 'openai_api_key' });
      if (result?.value) {
        setApiKey(result.value);
      }

      // Load OAuth statuses for servers that require OAuth
      const oauthStatusMap = new Map<string, boolean>();
      for (const server of configs) {
        if (server.requiresAuth) {
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

  // OAuth Functions
  const handleOAuthAuthenticate = async (serverId: string) => {
    try {
      const authUrl = await mcpManager.startOAuthFlow(serverId);

      // Open OAuth URL in system browser
      if (typeof window !== 'undefined' && 'open' in window) {
        window.open(authUrl, '_blank', 'noopener,noreferrer');
      } else {
        // Fallback - copy URL to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(authUrl);
          alert('OAuth URL copied to clipboard. Please open it in your browser.');
        } else {
          alert(`Please open this URL in your browser: ${authUrl}`);
        }
      }
    } catch (error) {
      console.error('Failed to start OAuth flow:', error);
      alert('Failed to start OAuth authentication. Please check your configuration.');
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
      // Use test result to determine if OAuth is required
      const serverConfig = {
        ...newServer,
        requiresAuth: connectionTestResult?.requiresAuth || false,
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger
              value="llm"
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">LLM Provider</span>
              <span className="sm:hidden">LLM</span>
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
                    <CardContent className="space-y-6">
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
                      </div>

                      {/* Model Info */}
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Current Model</h4>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">GPT-4o Mini</span>
                          <Badge variant="outline">Fast & Cost-effective</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          The fastest and most cost-effective OpenAI model as of 2025
                        </p>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <p>
                          Your API key is stored securely on your device and never sent to our
                          servers.
                        </p>
                        <p>
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
                        <DialogContent className="w-full h-full max-w-full max-h-full sm:max-w-lg sm:max-h-[90vh] sm:h-auto overflow-hidden flex flex-col safe-top safe-bottom safe-x m-0 sm:m-6 rounded-none sm:rounded-lg border-0 sm:border">
                          <DialogHeader className="p-4 sm:p-6 pb-0 sm:pb-0">
                            <DialogTitle>Add MCP Server</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="flex-1 px-4 sm:px-6">
                            <div className="space-y-4 py-4">
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
                          <div className="border-t p-4 sm:p-6 pt-4 sm:pt-6 bg-background">
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
                        <DialogContent className="w-full h-full max-w-full max-h-full sm:max-w-lg sm:max-h-[90vh] sm:h-auto overflow-hidden flex flex-col safe-top safe-bottom safe-x m-0 sm:m-6 rounded-none sm:rounded-lg border-0 sm:border">
                          <DialogHeader className="p-4 sm:p-6 pb-0 sm:pb-0">
                            <DialogTitle>Edit MCP Server</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="flex-1 px-4 sm:px-6">
                            <div className="space-y-4 py-4">
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
                          <div className="border-t p-4 sm:p-6 pt-4 sm:pt-6 bg-background">
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
                                        {server.requiresAuth &&
                                          (oauthStatuses.get(server.id) ? (
                                            <Badge
                                              variant="default"
                                              className="bg-blue-500 text-xs"
                                            >
                                              <Unlock className="h-3 w-3 mr-1" />
                                              OAuth Connected
                                            </Badge>
                                          ) : (
                                            <Badge variant="destructive" className="text-xs">
                                              <Lock className="h-3 w-3 mr-1" />
                                              OAuth Required
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
                                      {server.requiresAuth &&
                                        (oauthStatuses.get(server.id) ? (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOAuthDisconnect(server.id)}
                                            className="px-3 py-2"
                                          >
                                            <Lock className="h-4 w-4" />
                                          </Button>
                                        ) : (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOAuthAuthenticate(server.id)}
                                            className="px-3 py-2"
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
        </Tabs>
      </div>
    </div>
  );
}
