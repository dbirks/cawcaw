import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import {
  Brain,
  Key,
  Lock,
  Monitor,
  Moon,
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
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('llm');

  // API Key state
  const [currentApiKey, setCurrentApiKey] = useState<string>('');
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);

  // Theme management
  const { themePreference, currentTheme, updateThemePreference } = useTheme();

  // New server form state
  const [newServer, setNewServer] = useState({
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
  } | null>(null);

  // Generate unique IDs for form elements
  const currentApiKeyId = useId();
  const updateApiKeyId = useId();
  const serverNameId = useId();
  const serverUrlId = useId();
  const transportTypeId = useId();
  const serverDescriptionId = useId();
  const serverEnabledId = useId();

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [oauthStatuses, setOAuthStatuses] = useState<Map<string, boolean>>(new Map());

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);

      // Load MCP servers
      const configs = await mcpManager.loadConfigurations();
      setServers(configs);
      setServerStatuses(mcpManager.getServerStatuses());

      // Load current API key (masked)
      const result = await SecureStoragePlugin.get({ key: 'openai_api_key' });
      if (result?.value) {
        setCurrentApiKey(`sk-...${result.value.slice(-6)}`);
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

  const handleUpdateApiKey = async () => {
    if (!tempApiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    setIsUpdatingKey(true);
    try {
      await SecureStoragePlugin.set({ key: 'openai_api_key', value: tempApiKey });
      setCurrentApiKey(`sk-...${tempApiKey.slice(-6)}`);
      setTempApiKey('');
      alert('✅ API key updated successfully');
    } catch (error) {
      console.error('Failed to update API key:', error);
      alert('❌ Failed to update API key');
    } finally {
      setIsUpdatingKey(false);
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
        setCurrentApiKey('');
        alert('✅ API key cleared');
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
      setShowAddDialog(false);
      await loadSettings();
    } catch (error) {
      console.error('Failed to add server:', error);
      alert('Failed to add server. Please check the configuration.');
    }
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
        error: result.error
      });
    } catch (error) {
      console.error('Test connection error:', error);
      setConnectionTestResult({
        success: false,
        requiresAuth: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      });
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
    <div className="h-dvh bg-background p-4">
      <div className="max-w-4xl mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="llm" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              LLM Provider
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Tools & MCP
            </TabsTrigger>
          </TabsList>

          {/* LLM Provider Tab */}
          <TabsContent value="llm" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="pr-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        OpenAI Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Current API Key */}
                      <div>
                        <label htmlFor={currentApiKeyId} className="text-sm font-medium mb-2 block">
                          Current API Key
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            id={currentApiKeyId}
                            value={currentApiKey || 'Not configured'}
                            readOnly
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            onClick={handleClearApiKey}
                            disabled={!currentApiKey}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Update API Key */}
                      <div>
                        <label htmlFor={updateApiKeyId} className="text-sm font-medium mb-2 block">
                          Update API Key
                        </label>
                        <div className="space-y-3">
                          <Input
                            id={updateApiKeyId}
                            type="password"
                            placeholder="sk-..."
                            value={tempApiKey}
                            onChange={(e) => setTempApiKey(e.target.value)}
                          />
                          <Button
                            onClick={handleUpdateApiKey}
                            disabled={!tempApiKey.trim() || isUpdatingKey}
                            className="w-full"
                          >
                            <Key className="h-4 w-4 mr-2" />
                            {isUpdatingKey ? 'Updating...' : 'Update API Key'}
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
                <div className="pr-4">
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

                      {/* Current Theme Status */}
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Current Theme</h4>
                        <div className="flex items-center gap-2 text-sm">
                          {currentTheme === 'dark' ? (
                            <Moon className="h-4 w-4" />
                          ) : (
                            <Sun className="h-4 w-4" />
                          )}
                          <span className="capitalize">{currentTheme} mode is active</span>
                          {themePreference === 'system' && (
                            <Badge variant="outline" className="ml-2">
                              Auto
                            </Badge>
                          )}
                        </div>
                        {themePreference === 'system' && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Theme automatically switches based on your device settings
                          </p>
                        )}
                      </div>

                      {/* Theme Preview */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium">Preview</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {/* Light Preview */}
                          <div className="p-3 rounded-lg border bg-white text-black">
                            <div className="text-xs font-medium mb-1">Light Theme</div>
                            <div className="text-xs text-gray-600">Clean and bright interface</div>
                            <div className="mt-2 h-2 bg-blue-500 rounded-full w-3/4"></div>
                          </div>

                          {/* Dark Preview */}
                          <div className="p-3 rounded-lg border bg-gray-900 text-white">
                            <div className="text-xs font-medium mb-1">Dark Theme</div>
                            <div className="text-xs text-gray-300">Easy on the eyes</div>
                            <div className="mt-2 h-2 bg-blue-400 rounded-full w-3/4"></div>
                          </div>
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
                <div className="space-y-6 pr-4">
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
                        <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
                          <DialogHeader>
                            <DialogTitle>Add MCP Server</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="flex-1 pr-4">
                            <div className="space-y-4">
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
                                          {connectionTestResult.success ? 'Connection Successful' : 'Connection Failed'}
                                        </span>
                                      </div>
                                      
                                      {connectionTestResult.success && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          {connectionTestResult.requiresAuth ? (
                                            <>
                                              <Lock className="h-3 w-3" />
                                              <span>OAuth authentication required (auto-configured)</span>
                                            </>
                                          ) : (
                                            <>
                                              <Unlock className="h-3 w-3" />
                                              <span>No authentication required</span>
                                            </>
                                          )}
                                        </div>
                                      )}
                                      
                                      {!connectionTestResult.success && connectionTestResult.error && (
                                        <p className="text-xs text-red-600 mt-1">
                                          {connectionTestResult.error}
                                        </p>
                                      )}
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
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
                          </ScrollArea>
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
                              <CardContent className="p-4">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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
                                            <Badge variant="default" className="bg-blue-500 text-xs">
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
                                  <div className="flex items-center justify-end gap-2 flex-shrink-0">
                                    {server.requiresAuth &&
                                      (oauthStatuses.get(server.id) ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleOAuthDisconnect(server.id)}
                                        >
                                          <Lock className="h-4 w-4" />
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleOAuthAuthenticate(server.id)}
                                        >
                                          <Unlock className="h-4 w-4" />
                                        </Button>
                                      ))}
                                    <Switch
                                      checked={server.enabled}
                                      onCheckedChange={(enabled) =>
                                        handleToggleServer(server.id, enabled)
                                      }
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRemoveServer(server.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
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
