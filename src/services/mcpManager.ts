import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import type { MCPManagerConfig, MCPServerConfig, MCPServerStatus, MCPToolInfo } from '@/types/mcp';

const MCP_STORAGE_KEY = 'mcp_server_configs';

// Simple mock client for built-in tools
interface MockMCPClient {
  listTools(): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

class MCPManager {
  private clients: Map<string, MockMCPClient> = new Map();
  private serverConfigs: MCPServerConfig[] = [];
  private serverStatuses: Map<string, MCPServerStatus> = new Map();

  // Load server configurations from secure storage
  async loadConfigurations(): Promise<MCPServerConfig[]> {
    try {
      const result = await SecureStoragePlugin.get({ key: MCP_STORAGE_KEY });
      if (result?.value) {
        const config: MCPManagerConfig = JSON.parse(result.value);
        this.serverConfigs = config.servers || [];
        return this.serverConfigs;
      }
    } catch (error) {
      console.error('Failed to load MCP configurations:', error);
    }
    return [];
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

      // Handle built-in demo tools
      if (config.url.startsWith('built-in://')) {
        const mockClient: MockMCPClient = {
          async listTools() {
            return {
              calculator: { description: 'Perform basic mathematical calculations' },
              timeInfo: { description: 'Get current time and date information' },
              textAnalyzer: { description: 'Analyze text for word count, character count, etc.' },
            };
          },
          async close() {
            // Mock close
          },
        };

        this.clients.set(serverId, mockClient);
        this.serverStatuses.set(serverId, {
          id: serverId,
          connected: true,
          lastChecked: Date.now(),
          toolCount: 3, // calculator, timeInfo, textAnalyzer
        });
        console.log(`Built-in demo tools enabled: ${config.name}`);
        return;
      }

      // For real MCP servers, throw error since SDK imports are not working in build
      throw new Error('Real MCP servers not supported in this build. Use built-in demo tools.');
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

  // Get all tools from connected servers
  async getAllTools(): Promise<Record<string, unknown>> {
    const allTools: Record<string, unknown> = {};

    for (const [serverId, client] of this.clients) {
      try {
        const serverConfig = this.serverConfigs.find((s) => s.id === serverId);
        if (!serverConfig?.enabled) continue;

        const tools = await client.listTools();
        if (tools) {
          // Prefix tool names with server name to avoid conflicts
          for (const [toolName, toolDef] of Object.entries(tools)) {
            const prefixedName = `${serverConfig.name}_${toolName}`;
            allTools[prefixedName] = {
              ...(typeof toolDef === 'object' && toolDef !== null ? toolDef : {}),
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
              description: (toolDef as Record<string, unknown>).description as string | undefined,
              inputSchema: (toolDef as Record<string, unknown>).inputSchema as
                | Record<string, unknown>
                | undefined,
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
      // Built-in demo tools always work
      if (config.url.startsWith('built-in://')) {
        return true;
      }

      // For real MCP servers, return false since SDK is not available in build
      return false;
    } catch (error) {
      console.error('Test connection failed:', error);
      return false;
    }
  }

  // Get server configurations
  getServerConfigs(): MCPServerConfig[] {
    return [...this.serverConfigs];
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
