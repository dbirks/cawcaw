import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { mcpOAuthManager } from '@/services/mcpOAuth';
import type {
  MCPManagerConfig,
  MCPOAuthDiscovery,
  MCPOAuthTokens,
  MCPServerConfig,
  MCPServerStatus,
  MCPToolDefinition,
  MCPToolInfo,
  MCPToolResult,
} from '@/types/mcp';

const MCP_STORAGE_KEY = 'mcp_server_configs';

// Interface for MCP client (both real and mock)
interface MCPClient {
  listTools(): Promise<Record<string, MCPToolDefinition>>;
  callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>;
  close(): Promise<void>;
}

// HTTP/Streamable HTTP MCP client implementation
class HTTPMCPClient implements MCPClient {
  private baseUrl: string;
  private transport: 'http-streamable' | 'sse';
  private oauthConfig?: MCPOAuthTokens;

  constructor(baseUrl: string, transport: 'http-streamable' | 'sse', oauthConfig?: MCPOAuthTokens) {
    this.baseUrl = baseUrl;
    this.transport = transport;
    this.oauthConfig = oauthConfig;
  }

  async listTools(): Promise<Record<string, MCPToolDefinition>> {
    try {
      // Use proper MCP protocol endpoints
      const endpoint =
        this.transport === 'http-streamable'
          ? `${this.baseUrl}/mcp` // Streamable HTTP uses single /mcp endpoint
          : `${this.baseUrl}/messages`; // SSE transport uses /messages for requests
          
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add OAuth authorization header if available
      if (this.oauthConfig?.accessToken) {
        headers.Authorization = `Bearer ${this.oauthConfig.accessToken}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/list',
          params: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'MCP server error');
      }

      const tools: Record<string, MCPToolDefinition> = {};
      if (data.result?.tools) {
        for (const tool of data.result.tools) {
          tools[tool.name] = {
            description: tool.description,
            inputSchema: tool.inputSchema,
          };
        }
      }

      return tools;
    } catch (error) {
      console.error(`Failed to list tools from ${this.baseUrl}:`, error);
      throw error;
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    try {
      // Use proper MCP protocol endpoints
      const endpoint =
        this.transport === 'http-streamable'
          ? `${this.baseUrl}/mcp` // Streamable HTTP uses single /mcp endpoint
          : `${this.baseUrl}/messages`; // SSE transport uses /messages for requests
          
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add OAuth authorization header if available
      if (this.oauthConfig?.accessToken) {
        headers.Authorization = `Bearer ${this.oauthConfig.accessToken}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name,
            arguments: args,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'Tool call failed');
      }

      return data.result;
    } catch (error) {
      console.error(`Failed to call tool ${name}:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    // HTTP clients don't need explicit closing
  }

  // Test basic MCP server connectivity
  async testConnection(): Promise<boolean> {
    try {
      // For SSE transport, first try to check if the /mcp endpoint exists
      if (this.transport === 'sse') {
        const sseEndpoint = `${this.baseUrl}/mcp`;
        const headers: Record<string, string> = {};
        
        if (this.oauthConfig?.accessToken) {
          headers.Authorization = `Bearer ${this.oauthConfig.accessToken}`;
        }
        
        // Try a GET request to /mcp to see if SSE endpoint exists
        const sseResponse = await fetch(sseEndpoint, {
          method: 'GET',
          headers,
        });
        
        // For SSE, a successful response or 400 (bad request without proper SSE headers) indicates server exists
        if (sseResponse.ok || sseResponse.status === 400) {
          return true;
        }
      }
      
      // Try the standard tools/list request
      await this.listTools();
      return true;
    } catch (error) {
      console.error(`MCP connection test failed for ${this.baseUrl}:`, error);
      return false;
    }
  }
}

class MCPManager {
  private clients: Map<string, MCPClient> = new Map();
  private serverConfigs: MCPServerConfig[] = [];
  private serverStatuses: Map<string, MCPServerStatus> = new Map();

  constructor() {
    // Initialize with empty server configurations
    this.initializeWithDefaultServers();
  }

  private initializeWithDefaultServers() {
    this.serverConfigs = [];
  }

  // Load server configurations from secure storage
  async loadConfigurations(): Promise<MCPServerConfig[]> {
    try {
      const result = await SecureStoragePlugin.get({ key: MCP_STORAGE_KEY });
      if (result?.value) {
        const config: MCPManagerConfig = JSON.parse(result.value);
        const userServers = config.servers || [];

        // Merge with default servers, preserving user-added servers
        const defaultServers = this.serverConfigs;
        const allServers: MCPServerConfig[] = [];

        // Add default servers first
        for (const defaultServer of defaultServers) {
          const userOverride = userServers.find((s) => s.id === defaultServer.id);
          if (userOverride) {
            // Keep user's enabled/disabled state but preserve readonly flag
            allServers.push({ ...defaultServer, enabled: userOverride.enabled });
          } else {
            allServers.push(defaultServer);
          }
        }

        // Add user's custom servers, filtering out demo tools and test servers
        for (const userServer of userServers) {
          if (!defaultServers.find((s) => s.id === userServer.id)) {
            // Skip demo tools and test servers
            const isDemoServer = userServer.name?.includes('Demo Tools') || 
                               userServer.name?.includes('Everything Test Server') ||
                               userServer.url?.includes('built-in://demo') ||
                               userServer.url?.includes('@modelcontextprotocol/server-everything');
            
            if (!isDemoServer) {
              allServers.push(userServer);
            }
          }
        }

        this.serverConfigs = allServers;
        return this.serverConfigs;
      }
    } catch (error) {
      console.error('Failed to load MCP configurations:', error);
    }
    return this.serverConfigs;
  }

  // Clean up demo servers from storage
  async cleanupDemoServers(): Promise<void> {
    try {
      const result = await SecureStoragePlugin.get({ key: MCP_STORAGE_KEY });
      if (result?.value) {
        const config: MCPManagerConfig = JSON.parse(result.value);
        const userServers = config.servers || [];
        
        // Filter out demo servers
        const cleanedServers = userServers.filter(server => {
          const isDemoServer = server.name?.includes('Demo Tools') || 
                             server.name?.includes('Everything Test Server') ||
                             server.url?.includes('built-in://demo') ||
                             server.url?.includes('@modelcontextprotocol/server-everything');
          return !isDemoServer;
        });
        
        // Save cleaned configuration
        const cleanedConfig: MCPManagerConfig = {
          ...config,
          servers: cleanedServers
        };
        
        await SecureStoragePlugin.set({
          key: MCP_STORAGE_KEY,
          value: JSON.stringify(cleanedConfig),
        });
        
        this.serverConfigs = cleanedServers;
      }
    } catch (error) {
      console.error('Failed to cleanup demo servers:', error);
    }
  }

  // Save server configurations to secure storage
  async saveConfigurations(): Promise<void> {
    try {
      const config: MCPManagerConfig = {
        servers: this.serverConfigs,
        enabledServers: this.serverConfigs.filter((s) => s.enabled).map((s) => s.id),
      };
      await SecureStoragePlugin.set({
        key: MCP_STORAGE_KEY,
        value: JSON.stringify(config),
      });
    } catch (error) {
      console.error('Failed to save MCP configurations:', error);
      throw error;
    }
  }

  // Add a new server configuration
  async addServer(config: Omit<MCPServerConfig, 'id' | 'createdAt'>): Promise<MCPServerConfig> {
    const newConfig: MCPServerConfig = {
      ...config,
      id: `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      readonly: false,
    };

    this.serverConfigs.push(newConfig);
    await this.saveConfigurations();

    // Test connection if enabled
    if (newConfig.enabled) {
      await this.connectToServer(newConfig.id);
    }

    return newConfig;
  }

  // Update server configuration
  async updateServer(serverId: string, updates: Partial<MCPServerConfig>): Promise<void> {
    const index = this.serverConfigs.findIndex((s) => s.id === serverId);
    if (index === -1) throw new Error('Server not found');

    const oldConfig = this.serverConfigs[index];

    // Don't allow updates to readonly servers except enabled state
    if (oldConfig.readonly && Object.keys(updates).some((key) => key !== 'enabled')) {
      throw new Error('Cannot modify readonly server configuration');
    }

    this.serverConfigs[index] = { ...oldConfig, ...updates };
    await this.saveConfigurations();

    // Reconnect if enabled status or connection details changed
    if (updates.enabled !== undefined || updates.url || updates.transportType) {
      await this.disconnectFromServer(serverId);
      if (this.serverConfigs[index].enabled) {
        await this.connectToServer(serverId);
      }
    }
  }

  // Remove server configuration
  async removeServer(serverId: string): Promise<void> {
    const config = this.serverConfigs.find((s) => s.id === serverId);
    if (config?.readonly) {
      throw new Error('Cannot remove readonly server');
    }

    await this.disconnectFromServer(serverId);
    this.serverConfigs = this.serverConfigs.filter((s) => s.id !== serverId);
    this.serverStatuses.delete(serverId);
    await this.saveConfigurations();
  }

  // Connect to a specific MCP server
  async connectToServer(serverId: string): Promise<void> {
    const config = this.serverConfigs.find((s) => s.id === serverId);
    if (!config || !config.enabled) return;

    try {
      // Disconnect existing client if any
      await this.disconnectFromServer(serverId);

      let oauthTokens: MCPOAuthTokens | undefined;

      // Handle OAuth authentication if required
      if (config.requiresAuth) {
        // Load stored tokens
        oauthTokens = (await mcpOAuthManager.loadOAuthTokens(serverId)) || undefined;

        if (oauthTokens) {
          // Refresh token if needed
          if (oauthTokens.accessToken) {
            oauthTokens = await mcpOAuthManager.refreshTokenIfNeeded(serverId, oauthTokens);
          }

          if (!oauthTokens.accessToken) {
            throw new Error('OAuth authentication required - no valid access token');
          }
        } else {
          throw new Error('OAuth authentication required but no tokens found');
        }
      }

      // Create appropriate MCP client
      const client = new HTTPMCPClient(config.url, config.transportType, oauthTokens);

      // Test the connection by listing tools
      const tools = await client.listTools();

      this.clients.set(serverId, client);
      this.serverStatuses.set(serverId, {
        id: serverId,
        connected: true,
        lastChecked: Date.now(),
        toolCount: Object.keys(tools).length,
      });

      console.log(`Connected to MCP server: ${config.name} (${Object.keys(tools).length} tools)`);
    } catch (error) {
      console.error(`Failed to connect to MCP server ${config.name}:`, error);
      this.serverStatuses.set(serverId, {
        id: serverId,
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        lastChecked: Date.now(),
      });
      throw error;
    }
  }

  // Disconnect from a specific MCP server
  async disconnectFromServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.error(`Error closing MCP client for server ${serverId}:`, error);
      }
      this.clients.delete(serverId);
    }

    const status = this.serverStatuses.get(serverId);
    if (status) {
      this.serverStatuses.set(serverId, {
        ...status,
        connected: false,
        lastChecked: Date.now(),
      });
    }
  }

  // Connect to all enabled servers
  async connectToEnabledServers(): Promise<void> {
    const enabledServers = this.serverConfigs.filter((s) => s.enabled);
    const connectionPromises = enabledServers.map((server) =>
      this.connectToServer(server.id).catch((error) => {
        console.error(`Failed to connect to ${server.name}:`, error);
      })
    );

    await Promise.allSettled(connectionPromises);
  }

  // Get tools from enabled servers for AI usage
  async getAllTools(): Promise<Record<string, MCPToolDefinition>> {
    const allTools: Record<string, MCPToolDefinition> = {};

    for (const [serverId, client] of this.clients) {
      try {
        const serverConfig = this.serverConfigs.find((s) => s.id === serverId);
        if (!serverConfig?.enabled) continue;

        const tools = await client.listTools();
        if (tools) {
          // Add tools with server context for the AI to use
          for (const [toolName, toolDef] of Object.entries(tools)) {
            const prefixedName = `${serverConfig.name.replace(/\s+/g, '_')}_${toolName}`;
            allTools[prefixedName] = {
              ...toolDef,
              _mcpServerId: serverId,
              _mcpServerName: serverConfig.name,
              _mcpOriginalName: toolName,
            };
          }
        }
      } catch (error) {
        console.error(`Failed to get tools from server ${serverId}:`, error);
      }
    }

    return allTools;
  }

  // Call a tool from MCP server
  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    // Find which server has this tool
    for (const [serverId, client] of this.clients) {
      try {
        const serverConfig = this.serverConfigs.find((s) => s.id === serverId);
        if (!serverConfig?.enabled) continue;

        const tools = await client.listTools();
        const serverPrefix = `${serverConfig.name.replace(/\s+/g, '_')}_`;

        if (toolName.startsWith(serverPrefix)) {
          const originalToolName = toolName.replace(serverPrefix, '');
          if (originalToolName in tools) {
            return await client.callTool(originalToolName, args);
          }
        }
      } catch (error) {
        console.error(`Failed to call tool ${toolName} from server ${serverId}:`, error);
      }
    }

    throw new Error(`Tool not found: ${toolName}`);
  }

  // Get tool info for UI display
  async getToolsInfo(): Promise<MCPToolInfo[]> {
    const toolsInfo: MCPToolInfo[] = [];

    for (const [serverId, client] of this.clients) {
      try {
        const serverConfig = this.serverConfigs.find((s) => s.id === serverId);
        if (!serverConfig?.enabled) continue;

        const tools = await client.listTools();
        if (tools) {
          for (const [toolName, toolDef] of Object.entries(tools)) {
            toolsInfo.push({
              name: toolName,
              description: toolDef.description,
              inputSchema: toolDef.inputSchema,
              serverId,
              serverName: serverConfig.name,
            });
          }
        }
      } catch (error) {
        console.error(`Failed to get tool info from server ${serverId}:`, error);
      }
    }

    return toolsInfo;
  }

  // Test server and discover OAuth capabilities automatically
  async testServerWithOAuthDiscovery(config: Omit<MCPServerConfig, 'id' | 'createdAt'>): Promise<{
    connectionSuccess: boolean;
    requiresAuth: boolean;
    oauthDiscovery?: MCPOAuthDiscovery;
    error?: string;
  }> {
    try {
      // First test basic connection without OAuth
      const client = new HTTPMCPClient(config.url, config.transportType);

      try {
        const connectionWorked = await client.testConnection();
        await client.close();

        if (connectionWorked) {
          // Basic connection works, now check if OAuth is available as an option
          const oauthTest = await mcpOAuthManager.testOAuthSupport(config.url);

          return {
            connectionSuccess: true,
            requiresAuth: false, // Works without auth, OAuth is optional
            oauthDiscovery: oauthTest.supportsOAuth ? oauthTest.discovery : undefined,
          };
        } else {
          throw new Error('Connection test failed');
        }
      } catch (basicError) {
        // Basic connection failed, check if OAuth might be required
        const oauthTest = await mcpOAuthManager.testOAuthSupport(config.url);

        if (oauthTest.supportsOAuth && oauthTest.discovery) {
          return {
            connectionSuccess: true,
            requiresAuth: true,
            oauthDiscovery: oauthTest.discovery,
          };
        }

        // Neither basic nor OAuth worked
        throw basicError;
      }
    } catch (error) {
      return {
        connectionSuccess: false,
        requiresAuth: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  // Get server configurations
  getServerConfigs(): MCPServerConfig[] {
    return [...this.serverConfigs];
  }

  // Get enabled server configurations
  getEnabledServerConfigs(): MCPServerConfig[] {
    return this.serverConfigs.filter((s) => s.enabled);
  }

  // Get server statuses
  getServerStatuses(): Map<string, MCPServerStatus> {
    return new Map(this.serverStatuses);
  }

  // OAuth authentication methods

  // Start OAuth flow for a server
  async startOAuthFlow(serverId: string): Promise<string> {
    const config = this.serverConfigs.find((s) => s.id === serverId);
    if (!config?.requiresAuth) {
      throw new Error('Server does not require OAuth authentication');
    }

    return await mcpOAuthManager.startOAuthFlow(serverId, config.url);
  }

  // Complete OAuth flow with authorization code
  async completeOAuthFlow(serverId: string, code: string, state: string): Promise<void> {
    const tokens = await mcpOAuthManager.exchangeCodeForToken(serverId, code, state);

    // Try to connect now that we have tokens
    if (tokens.accessToken) {
      await this.connectToServer(serverId);
    }
  }

  // Check if server has valid OAuth tokens
  async hasValidOAuthTokens(serverId: string): Promise<boolean> {
    const storedTokens = await mcpOAuthManager.loadOAuthTokens(serverId);
    return !!storedTokens?.accessToken;
  }

  // Clear OAuth tokens for server
  async clearOAuthTokens(serverId: string): Promise<void> {
    await mcpOAuthManager.clearOAuthTokens(serverId);
    await this.disconnectFromServer(serverId);
  }

  // Cleanup all connections
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.clients.keys()).map((serverId) =>
      this.disconnectFromServer(serverId)
    );
    await Promise.allSettled(cleanupPromises);
  }
}

// Export singleton instance
export const mcpManager = new MCPManager();
