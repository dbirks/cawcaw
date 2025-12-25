/**
 * ACP (Agent Client Protocol) Type Definitions
 *
 * Based on Agent Client Protocol specification
 * https://agentclientprotocol.com/protocol/overview
 */

// ============================================================================
// Agent Discovery & Configuration
// ============================================================================

/**
 * Agent Card - describes agent capabilities and metadata
 * Fetched from /.well-known/agent.json or /.well-known/agent-card.json
 */
export interface ACPAgentCard {
  name: string;
  title?: string;
  version: string;
  description?: string;
  capabilities: ACPCapabilities;
  url: string;
  homepage?: string;
  supportedProtocolVersions?: string[];
}

/**
 * Agent capabilities - what the agent can do
 */
export interface ACPCapabilities {
  fileSystem?: {
    read?: boolean;
    write?: boolean;
    watch?: boolean;
  };
  terminal?: boolean;
  mcp?: {
    http?: boolean;
    sse?: boolean;
    stdio?: boolean;
  };
  session?: {
    load?: boolean;
    new?: boolean;
    prompt?: boolean;
    cancel?: boolean;
    update?: boolean;
  };
  planning?: boolean;
  streaming?: boolean;
}

/**
 * User-configured ACP agent server
 */
export interface ACPServerConfig {
  id: string;
  name: string;
  url: string; // Agent endpoint URL
  enabled: boolean;
  description?: string;
  createdAt: number;
  agentCard?: ACPAgentCard;
  requiresAuth?: boolean;
  oauthDiscovery?: ACPOAuthDiscovery;
}

/**
 * OAuth discovery metadata
 */
export interface ACPOAuthDiscovery {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes?: string[];
}

/**
 * Storage configuration for all ACP servers
 */
export interface ACPManagerConfig {
  servers: ACPServerConfig[];
  enabledServers: string[];
  lastUsedServer?: string;
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Active ACP session
 */
export interface ACPSession {
  id: string; // Session ID from server
  serverId: string; // Which agent this session is with
  cwd: string; // Working directory on server
  createdAt: number;
  lastActivity: number;
  conversationId?: string; // Link to conversation storage
}

/**
 * Session initialization parameters
 */
export interface ACPSessionParams {
  cwd?: string;
  environment?: Record<string, string>;
  capabilities?: string[];
}

// ============================================================================
// Message Content
// ============================================================================

/**
 * Content blocks for messages (user and agent)
 */
export interface ACPContentBlock {
  type: 'text' | 'resource' | 'file' | 'image';
  text?: string;
  uri?: string;
  mimeType?: string;
  data?: string; // Base64 for binary content
}

/**
 * Message role
 */
export type ACPMessageRole = 'user' | 'agent';

/**
 * Message structure for session/prompt
 */
export interface ACPMessage {
  role: ACPMessageRole;
  content: ACPContentBlock[];
}

// ============================================================================
// Tool Calls
// ============================================================================

/**
 * Tool call kinds - types of operations agents can perform
 */
export type ACPToolCallKind =
  | 'read' // Read file
  | 'edit' // Edit file
  | 'delete' // Delete file
  | 'move' // Move/rename file
  | 'search' // Search in files
  | 'execute' // Run terminal command
  | 'think' // Agent reasoning
  | 'fetch' // HTTP request
  | 'other'; // Other operation

/**
 * Tool call execution status
 */
export type ACPToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * File diff for edit operations
 */
export interface ACPDiff {
  path: string;
  oldText: string | null; // null for new files
  newText: string;
  startLine?: number;
  endLine?: number;
}

/**
 * Terminal execution context
 */
export interface ACPTerminal {
  terminalId: string;
  command?: string;
  output?: string;
  exitCode?: number;
}

/**
 * Tool call from agent
 */
export interface ACPToolCall {
  toolCallId: string;
  title: string;
  kind: ACPToolCallKind;
  status: ACPToolCallStatus;
  path?: string; // File path for file operations
  line?: number; // Line number for edits
  diff?: ACPDiff;
  terminal?: ACPTerminal;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  timestamp?: number;
}

// ============================================================================
// Permissions
// ============================================================================

/**
 * Permission action kinds
 */
export type ACPPermissionKind =
  | 'allow_once' // Allow this request only
  | 'allow_always' // Allow all future requests of this type
  | 'reject_once' // Reject this request only
  | 'reject_always'; // Reject all future requests of this type

/**
 * Permission option presented to user
 */
export interface ACPPermissionOption {
  id: string;
  label: string;
  kind: ACPPermissionKind;
  description?: string;
}

/**
 * Permission request from agent
 */
export interface ACPPermissionRequest {
  requestId: string;
  toolCallId: string;
  title: string;
  description?: string;
  path?: string;
  diff?: ACPDiff;
  options: ACPPermissionOption[];
  timestamp: number;
}

// ============================================================================
// Agent Plans
// ============================================================================

/**
 * Plan item status
 */
export type ACPPlanItemStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

/**
 * Single task in agent's plan
 */
export interface ACPPlanItem {
  id: string;
  title: string;
  status: ACPPlanItemStatus;
  description?: string;
  timestamp?: number;
}

/**
 * Agent plan - list of tasks
 */
export interface ACPPlan {
  items: ACPPlanItem[];
  title?: string;
}

// ============================================================================
// Streaming Updates
// ============================================================================

/**
 * Update notification types from agent
 */
export type ACPUpdateType =
  | 'agent_message_chunk' // Text streaming
  | 'tool_call' // New tool call announced
  | 'tool_call_update' // Tool call status changed
  | 'plan' // Agent plan created/updated
  | 'resource' // Resource block
  | 'thought'; // Agent reasoning

/**
 * Streaming update from session/update notification
 */
export interface ACPUpdate {
  type: ACPUpdateType;
  text?: string; // For agent_message_chunk
  toolCall?: ACPToolCall; // For tool_call, tool_call_update
  plan?: ACPPlan; // For plan
  thought?: string; // For thought
  timestamp?: number;
}

// ============================================================================
// Session Responses
// ============================================================================

/**
 * Stop reasons - why generation ended
 */
export type ACPStopReason =
  | 'end_turn' // Agent completed normally
  | 'max_tokens' // Token limit reached
  | 'max_turn_requests' // Too many tool calls
  | 'refusal' // Agent refused to answer
  | 'cancelled'; // User cancelled

/**
 * Result of session/prompt request
 */
export interface ACPPromptResult {
  stopReason: ACPStopReason;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

// ============================================================================
// Server Status
// ============================================================================

/**
 * Connection status for an ACP server
 */
export interface ACPServerStatus {
  id: string;
  connected: boolean;
  error?: string;
  lastChecked: number;
  sessionId?: string;
  agentInfo?: {
    name: string;
    version: string;
    capabilities?: ACPCapabilities;
  };
}

// ============================================================================
// JSON-RPC Types
// ============================================================================

/**
 * JSON-RPC 2.0 request
 */
export interface ACPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC 2.0 response
 */
export interface ACPResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: ACPError;
}

/**
 * JSON-RPC 2.0 error
 */
export interface ACPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC 2.0 notification (no response expected)
 */
export interface ACPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// ============================================================================
// Testing & Diagnostics
// ============================================================================

/**
 * Connection test result
 */
export interface ACPTestResult {
  success: boolean;
  agentCard?: ACPAgentCard;
  error?: string;
  requiresAuth?: boolean;
  oauthDiscovery?: ACPOAuthDiscovery;
  latency?: number;
  timestamp: number;
}

/**
 * Detailed error for connection issues
 */
export interface DetailedACPError {
  message: string;
  httpStatus?: number;
  jsonRpcError?: ACPError;
  responseBody?: string;
  headers?: Record<string, string>;
  timestamp: number;
}
