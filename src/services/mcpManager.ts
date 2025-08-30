import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import type { 
  MCPManagerConfig, 
  MCPServerConfig, 
  MCPServerStatus, 
  MCPToolInfo, 
  MCPToolDefinition,
  MCPToolResult 
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
  private transport: 'http' | 'streamableHttp';
  
  constructor(baseUrl: string, transport: 'http' | 'streamableHttp') {
    this.baseUrl = baseUrl;
    this.transport = transport;
  }

  async listTools(): Promise<Record<string, MCPToolDefinition>> {
    try {
      // Use transport for future protocol variations
      const endpoint = this.transport === 'streamableHttp' ? `${this.baseUrl}/tools/list` : `${this.baseUrl}/tools/list`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      // Use transport for future protocol variations
      const endpoint = this.transport === 'streamableHttp' ? `${this.baseUrl}/tools/call` : `${this.baseUrl}/tools/call`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
}

// Built-in demo client
class BuiltInMCPClient implements MCPClient {
  async listTools(): Promise<Record<string, MCPToolDefinition>> {
    return {
      calculator: { 
        description: 'Perform basic mathematical calculations',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Mathematical expression to evaluate' }
          },
          required: ['expression']
        }
      },
      timeInfo: { 
        description: 'Get current time and date information',
        inputSchema: {
          type: 'object',
          properties: {
            timezone: { type: 'string', description: 'Timezone (optional, defaults to local)' }
          }
        }
      },
      textAnalyzer: { 
        description: 'Analyze text for word count, character count, etc.',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to analyze' }
          },
          required: ['text']
        }
      },
    };
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    switch (name) {
      case 'calculator':
        try {
          const expression = String(args.expression);
          const result = Function(`"use strict"; return (${expression.replace(/[^0-9+\-*/.() ]/g, '')})`)();
          return { calculation: expression, result: result.toString() };
        } catch {
          return { calculation: String(args.expression), result: 'Error: Invalid expression' };
        }
      case 'timeInfo': {
        const now = new Date();
        return {
          currentTime: now.toLocaleString(),
          timestamp: now.getTime(),
          timezone: args.timezone || 'local',
        };
      }
      case 'textAnalyzer': {
        const text = String(args.text);
        return {
          text: text,
          wordCount: text.split(/\s+/).filter((word: string) => word.length > 0).length,
          characterCount: text.length,
          characterCountNoSpaces: text.replace(/\s/g, '').length,
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async close(): Promise<void> {
    // Mock close
  }
}

class MCPManager {
  private clients: Map<string, MCPClient> = new Map();
  private serverConfigs: MCPServerConfig[] = [];
  private serverStatuses: Map<string, MCPServerStatus> = new Map();

  constructor() {
    // Initialize with the "Everything" test server
    this.initializeWithDefaultServers();
  }

  private initializeWithDefaultServers() {
    this.serverConfigs = [
      {
        id: 'builtin-demo',
        name: 'Built-in Demo Tools',
        url: 'built-in://demo',
        enabled: true,
        transportType: 'http',
        description: 'Built-in calculator, time info, and text analyzer tools',
        createdAt: Date.now(),
        readonly: true,
      },
      {
        id: 'everything-server',
        name: 'Everything Test Server',
        url: 'npx @modelcontextprotocol/server-everything',
        enabled: false,
        transportType: 'streamableHttp',
        description: 'Official MCP reference server with all protocol features for testing',
        createdAt: Date.now(),
        readonly: true,
      },
    ];
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
          const userOverride = userServers.find(s => s.id === defaultServer.id);
          if (userOverride) {
            // Keep user's enabled/disabled state but preserve readonly flag
            allServers.push({ ...defaultServer, enabled: userOverride.enabled });
          } else {
            allServers.push(defaultServer);
          }
        }
        
        // Add user's custom servers
        for (const userServer of userServers) {
          if (!defaultServers.find(s => s.id === userServer.id)) {
            allServers.push(userServer);
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
    if (oldConfig.readonly && Object.keys(updates).some(key => key !== 'enabled')) {
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
    const config = this.serverConfigs.find(s => s.id === serverId);
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

      let client: MCPClient;

      // Handle built-in demo tools
      if (config.url.startsWith('built-in://')) {
        client = new BuiltInMCPClient();
      } else {
        // For the Everything server and other real MCP servers
        // Note: This is a simplified implementation - in a real app you'd start the server process
        if (config.url.includes('@modelcontextprotocol/server-everything')) {
          // For demo purposes, we'll use a mock endpoint
          // In reality, you'd need to start the server process and get its endpoint
          const mockUrl = 'http://localhost:3001'; // This would be dynamic
          client = new HTTPMCPClient(mockUrl, config.transportType as 'http' | 'streamableHttp');
        } else {
          client = new HTTPMCPClient(config.url, config.transportType as 'http' | 'streamableHttp');
        }
      }

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

  // Test connection to a server
  async testConnection(config: Omit<MCPServerConfig, 'id' | 'createdAt'>): Promise<boolean> {
    try {
      let client: MCPClient;
      
      if (config.url.startsWith('built-in://')) {
        client = new BuiltInMCPClient();
      } else {
        client = new HTTPMCPClient(config.url, config.transportType as 'http' | 'streamableHttp');
      }
      
      await client.listTools();
      await client.close();
      return true;
    } catch (error) {
      console.error('Test connection failed:', error);
      return false;
    }
  }

  // Get server configurations
  getServerConfigs(): MCPServerConfig[] {
    return [...this.serverConfigs];
  }

  // Get enabled server configurations
  getEnabledServerConfigs(): MCPServerConfig[] {
    return this.serverConfigs.filter(s => s.enabled);
  }

  // Get server statuses
  getServerStatuses(): Map<string, MCPServerStatus> {
    return new Map(this.serverStatuses);
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