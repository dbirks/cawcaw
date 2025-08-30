// MCP (Model Context Protocol) related types

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  transportType: 'sse' | 'http' | 'streamableHttp';
  description?: string;
  createdAt: number;
  readonly?: boolean; // For hardcoded servers
}

export interface MCPToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
  error?: string;
  timestamp: number;
}

export interface MCPServerStatus {
  id: string;
  connected: boolean;
  error?: string;
  lastChecked: number;
  toolCount?: number;
}

export interface MCPManagerConfig {
  servers: MCPServerConfig[];
  enabledServers: string[];
}

// MCP Tool definition for UI display
export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  serverId: string;
  serverName: string;
}

// MCP Tool definition from server
export interface MCPToolDefinition {
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, {
      type: string;
      description?: string;
    }>;
    required?: string[];
  };
  _mcpServerId?: string;
  _mcpServerName?: string;
  _mcpOriginalName?: string;
}

// MCP Tool execution result
export type MCPToolResult = unknown;
