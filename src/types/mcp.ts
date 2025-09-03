// MCP (Model Context Protocol) related types

export interface MCPOAuthDiscovery {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint?: string;
  supportedGrantTypes: string[];
  supportedScopes?: string[];
}

// MCP OAuth 2.1 Resource Provider information (2025-03-26 spec compliant)
export interface MCPResourceProviderInfo {
  resourceIdentifier: string; // Usually the hostname of the MCP server
  serverUrl: string; // Full MCP server URL
  mcpScope: string; // Format: <resource-identifier>/mcp:access
  externalIdP?: string; // External Identity Provider (github.com, accounts.google.com, etc.)
}

// External Identity Provider configuration
export interface ExternalIdPConfig {
  name: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId?: string;
  clientSecret?: string;
  scopes: string[];
}

export interface MCPOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  clientId?: string; // From dynamic registration
  clientSecret?: string; // From dynamic registration
}

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  transportType: 'sse' | 'http-streamable';
  description?: string;
  createdAt: number;
  readonly?: boolean; // For hardcoded servers
  requiresAuth?: boolean; // Discovered automatically
  oauthDiscovery?: MCPOAuthDiscovery; // Discovered endpoints
  // MCP OAuth 2.1 Resource Provider information (2025-03-26 spec)
  resourceProviderInfo?: MCPResourceProviderInfo;
  externalIdP?: ExternalIdPConfig; // External Identity Provider config
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
    properties?: Record<
      string,
      {
        type: string;
        description?: string;
      }
    >;
    required?: string[];
  };
  _mcpServerId?: string;
  _mcpServerName?: string;
  _mcpOriginalName?: string;
}

// MCP Tool execution result
export type MCPToolResult = unknown;
