// MCP (Model Context Protocol) related types

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  transportType: 'sse' | 'http';
  description?: string;
  createdAt: number;
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
