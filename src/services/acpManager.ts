/**
 * ACP (Agent Client Protocol) Manager
 *
 * Manages connections to remote ACP agents (Claude Code, goose, Gemini CLI, etc.)
 * Handles session lifecycle, message streaming, and permission requests.
 */

import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { debugLogger } from '@/services/debugLogger';
import { httpClient } from '@/utils/httpClient';
import type {
  ACPAgentCard,
  ACPManagerConfig,
  ACPMessage,
  ACPPermissionRequest,
  ACPPromptResult,
  ACPRequest,
  ACPResponse,
  ACPServerConfig,
  ACPServerStatus,
  ACPSession,
  ACPSessionParams,
  ACPTestResult,
  ACPUpdate,
} from '../types/acp';

const ACP_STORAGE_KEY = 'acp_server_configs';
const ACP_OAUTH_PREFIX = 'acp_oauth_tokens_';

/**
 * Default ACP configuration
 */
const DEFAULT_CONFIG: ACPManagerConfig = {
  servers: [],
  enabledServers: [],
};

/**
 * ACP Agent Client
 * Handles communication with a single ACP agent server
 */
class ACPAgentClient {
  private config: ACPServerConfig;
  private oauthToken?: string;
  private sessionId: string | null = null;
  private requestIdCounter = 0;

  constructor(config: ACPServerConfig, oauthToken?: string) {
    this.config = config;
    this.oauthToken = oauthToken;
  }

  /**
   * Generate next request ID
   */
  private nextRequestId(): string {
    return `${Date.now()}_${++this.requestIdCounter}`;
  }

  /**
   * Make JSON-RPC request to agent
   */
  private async makeRequest<T>(method: string, params?: unknown): Promise<ACPResponse<T>> {
    const request: ACPRequest = {
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method,
      params,
    };

    debugLogger.info('mcp', `ACP Request to ${this.config.name}:`, { method, params });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add OAuth token if available
    if (this.oauthToken) {
      headers.Authorization = `Bearer ${this.oauthToken}`;
    }

    try {
      const httpResponse = await httpClient.post(this.config.url, request, headers);
      const response = (await httpResponse.json()) as ACPResponse<T>;

      debugLogger.info('mcp', `ACP Response from ${this.config.name}:`, response);

      return response;
    } catch (error) {
      debugLogger.error('mcp', `ACP request failed for ${this.config.name}:`, error);
      throw error;
    }
  }

  /**
   * Initialize connection to agent
   */
  async initialize(): Promise<{
    protocolVersion: string;
    capabilities?: unknown;
  }> {
    const response = await this.makeRequest<{
      protocolVersion: string;
      capabilities?: unknown;
    }>('initialize', {
      protocolVersion: '2025-06-18', // Latest ACP version
      clientInfo: {
        name: 'caw-caw',
        version: '0.1.4',
      },
    });

    if (response.error) {
      throw new Error(`Initialize failed: ${response.error.message}`);
    }

    return response.result!;
  }

  /**
   * Create new session
   */
  async createSession(params?: ACPSessionParams): Promise<string> {
    const response = await this.makeRequest<{ sessionId: string }>(
      'session/new',
      params || { cwd: '/' }
    );

    if (response.error) {
      throw new Error(`Create session failed: ${response.error.message}`);
    }

    this.sessionId = response.result?.sessionId;
    debugLogger.info('mcp', `Session created: ${this.sessionId}`);

    return this.sessionId;
  }

  /**
   * Send prompt to agent and stream responses
   *
   * Returns async generator that yields ACPUpdate notifications
   */
  async *sendPrompt(
    sessionId: string,
    messages: ACPMessage[]
  ): AsyncGenerator<ACPUpdate, ACPPromptResult, undefined> {
    // For now, we'll use polling or SSE for streaming
    // This is a simplified implementation - in production, you'd want proper SSE or WebSocket

    const response = await this.makeRequest<ACPPromptResult>('session/prompt', {
      sessionId,
      messages,
    });

    if (response.error) {
      throw new Error(`Prompt failed: ${response.error.message}`);
    }

    // TODO: Implement proper streaming with SSE or WebSocket
    // For now, yield a stub update and return the final result
    // In Phase 3, this will properly stream updates via SSE
    yield {
      type: 'agent_message_chunk' as const,
      text: '',
    };

    return (
      response.result ?? {
        stopReason: 'end_turn' as const,
      }
    );
  }

  /**
   * Cancel current session prompt
   */
  async cancelSession(sessionId: string): Promise<void> {
    const response = await this.makeRequest('session/cancel', { sessionId });

    if (response.error) {
      throw new Error(`Cancel failed: ${response.error.message}`);
    }
  }

  /**
   * Respond to permission request
   */
  async respondToPermission(requestId: string, optionId: string): Promise<void> {
    const response = await this.makeRequest('session/permission_response', {
      requestId,
      optionId,
    });

    if (response.error) {
      throw new Error(`Permission response failed: ${response.error.message}`);
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
}

/**
 * ACP Manager
 * Manages all ACP agent connections and sessions
 */
class ACPManager {
  private config: ACPManagerConfig = DEFAULT_CONFIG;
  private clients: Map<string, ACPAgentClient> = new Map();
  private sessions: Map<string, ACPSession> = new Map();
  private serverStatuses: Map<string, ACPServerStatus> = new Map();
  private pendingPermissions: Map<string, ACPPermissionRequest> = new Map();
  private initialized = false;

  constructor() {
    debugLogger.info('mcp', 'ACPManager initialized');
  }

  /**
   * Initialize manager and load configurations
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.loadConfigurations();
    this.initialized = true;

    debugLogger.info('mcp', `ACPManager loaded ${this.config.servers.length} servers`);
  }

  // ============================================================================
  // Configuration Management
  // ============================================================================

  /**
   * Load configurations from secure storage
   */
  async loadConfigurations(): Promise<ACPServerConfig[]> {
    try {
      const result = await SecureStoragePlugin.get({ key: ACP_STORAGE_KEY });

      if (result.value) {
        const stored: ACPManagerConfig = JSON.parse(result.value);
        this.config = { ...DEFAULT_CONFIG, ...stored };
        debugLogger.info('mcp', 'Loaded ACP configurations:', this.config.servers.length);
      }
    } catch (_error) {
      debugLogger.warn('mcp', 'No stored ACP configurations, using defaults');
      this.config = DEFAULT_CONFIG;
    }

    return this.config.servers;
  }

  /**
   * Save configurations to secure storage
   */
  async saveConfigurations(): Promise<void> {
    try {
      await SecureStoragePlugin.set({
        key: ACP_STORAGE_KEY,
        value: JSON.stringify(this.config),
      });

      debugLogger.info('mcp', 'Saved ACP configurations');
    } catch (error) {
      debugLogger.error('mcp', 'Failed to save ACP configurations:', error);
      throw error;
    }
  }

  /**
   * Add new ACP server
   */
  async addServer(
    serverConfig: Omit<ACPServerConfig, 'id' | 'createdAt'>
  ): Promise<ACPServerConfig> {
    const newServer: ACPServerConfig = {
      ...serverConfig,
      id: `acp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: Date.now(),
    };

    this.config.servers.push(newServer);

    if (newServer.enabled) {
      this.config.enabledServers.push(newServer.id);
    }

    await this.saveConfigurations();

    debugLogger.info('mcp', `Added ACP server: ${newServer.name}`);

    return newServer;
  }

  /**
   * Update existing server
   */
  async updateServer(serverId: string, updates: Partial<ACPServerConfig>): Promise<void> {
    const index = this.config.servers.findIndex((s) => s.id === serverId);

    if (index === -1) {
      throw new Error(`Server ${serverId} not found`);
    }

    this.config.servers[index] = {
      ...this.config.servers[index],
      ...updates,
    };

    // Update enabled list
    const wasEnabled = this.config.enabledServers.includes(serverId);
    const isEnabled = this.config.servers[index].enabled;

    if (isEnabled && !wasEnabled) {
      this.config.enabledServers.push(serverId);
    } else if (!isEnabled && wasEnabled) {
      this.config.enabledServers = this.config.enabledServers.filter((id) => id !== serverId);
    }

    await this.saveConfigurations();

    debugLogger.info('mcp', `Updated ACP server: ${serverId}`);
  }

  /**
   * Remove server
   */
  async removeServer(serverId: string): Promise<void> {
    this.config.servers = this.config.servers.filter((s) => s.id !== serverId);
    this.config.enabledServers = this.config.enabledServers.filter((id) => id !== serverId);

    // Cleanup client and session
    this.clients.delete(serverId);
    this.serverStatuses.delete(serverId);

    // Remove sessions for this server
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.serverId === serverId) {
        this.sessions.delete(sessionId);
      }
    }

    await this.saveConfigurations();

    debugLogger.info('mcp', `Removed ACP server: ${serverId}`);
  }

  /**
   * Get all configured servers
   */
  getServers(): ACPServerConfig[] {
    return this.config.servers;
  }

  /**
   * Get enabled servers
   */
  getEnabledServers(): ACPServerConfig[] {
    return this.config.servers.filter((s) => this.config.enabledServers.includes(s.id));
  }

  // ============================================================================
  // Agent Discovery
  // ============================================================================

  /**
   * Discover agent by fetching agent card
   * Tries /.well-known/agent.json and /.well-known/agent-card.json
   */
  async discoverAgent(baseUrl: string): Promise<ACPAgentCard | null> {
    const urls = [`${baseUrl}/.well-known/agent.json`, `${baseUrl}/.well-known/agent-card.json`];

    for (const url of urls) {
      try {
        debugLogger.info('mcp', `Discovering agent at: ${url}`);

        const httpResponse = await httpClient.get(url);
        const response = (await httpResponse.json()) as ACPAgentCard;

        if (response) {
          debugLogger.info('mcp', 'Agent card discovered:', response);
          return response;
        }
      } catch (error) {
        debugLogger.warn('mcp', `Failed to fetch ${url}:`, error);
      }
    }

    debugLogger.warn('mcp', 'No agent card found at', baseUrl);
    return null;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Test connection to ACP server
   */
  async testConnection(config: Partial<ACPServerConfig>): Promise<ACPTestResult> {
    const startTime = Date.now();

    try {
      // Try to discover agent card
      const agentCard = config.url ? await this.discoverAgent(config.url) : null;

      // Try to initialize connection
      const client = new ACPAgentClient(config as ACPServerConfig);

      try {
        await client.initialize();

        return {
          success: true,
          agentCard: agentCard || undefined,
          latency: Date.now() - startTime,
          timestamp: Date.now(),
        };
      } catch (error) {
        // Check if it's an auth error
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (
          errorMessage.includes('401') ||
          errorMessage.includes('403') ||
          errorMessage.includes('unauthorized')
        ) {
          return {
            success: false,
            requiresAuth: true,
            error: 'Authentication required',
            agentCard: agentCard || undefined,
            timestamp: Date.now(),
          };
        }

        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Connect to ACP server
   */
  async connectToServer(serverId: string): Promise<void> {
    const config = this.config.servers.find((s) => s.id === serverId);

    if (!config) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      // Get OAuth token if available
      let oauthToken: string | undefined;
      try {
        const tokenResult = await SecureStoragePlugin.get({
          key: `${ACP_OAUTH_PREFIX}${serverId}`,
        });
        if (tokenResult.value) {
          const tokenData = JSON.parse(tokenResult.value);
          oauthToken = tokenData.access_token;
        }
      } catch {
        // No token stored
      }

      // Create client
      const client = new ACPAgentClient(config, oauthToken);

      // Initialize
      await client.initialize();

      // Store client
      this.clients.set(serverId, client);

      // Update status
      this.serverStatuses.set(serverId, {
        id: serverId,
        connected: true,
        lastChecked: Date.now(),
      });

      debugLogger.info('mcp', `Connected to ACP server: ${config.name}`);
    } catch (error) {
      debugLogger.error('mcp', `Failed to connect to ${config.name}:`, error);

      this.serverStatuses.set(serverId, {
        id: serverId,
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        lastChecked: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Connect to all enabled servers
   */
  async connectToEnabledServers(): Promise<void> {
    const enabled = this.getEnabledServers();

    await Promise.allSettled(enabled.map((server) => this.connectToServer(server.id)));
  }

  /**
   * Get server status
   */
  getServerStatus(serverId: string): ACPServerStatus | undefined {
    return this.serverStatuses.get(serverId);
  }

  /**
   * Get all server statuses
   */
  getAllServerStatuses(): ACPServerStatus[] {
    return Array.from(this.serverStatuses.values());
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Create new session with agent
   */
  async createSession(serverId: string, params?: ACPSessionParams): Promise<ACPSession> {
    const client = this.clients.get(serverId);

    if (!client) {
      throw new Error(`Not connected to server ${serverId}`);
    }

    const sessionId = await client.createSession(params);

    const session: ACPSession = {
      id: sessionId,
      serverId,
      cwd: params?.cwd || '/',
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, session);

    debugLogger.info('mcp', `Created session: ${sessionId}`);

    return session;
  }

  /**
   * Get session
   */
  getSession(sessionId: string): ACPSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a server
   */
  getServerSessions(serverId: string): ACPSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.serverId === serverId);
  }

  // ============================================================================
  // Message Streaming
  // ============================================================================

  /**
   * Send prompt to agent
   */
  async *sendPrompt(
    sessionId: string,
    messages: ACPMessage[]
  ): AsyncGenerator<ACPUpdate, ACPPromptResult, undefined> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const client = this.clients.get(session.serverId);

    if (!client) {
      throw new Error(`Not connected to server ${session.serverId}`);
    }

    // Update last activity
    session.lastActivity = Date.now();

    // Stream responses and return final result
    const result = yield* client.sendPrompt(sessionId, messages);
    return result;
  }

  /**
   * Cancel session
   */
  async cancelSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const client = this.clients.get(session.serverId);

    if (!client) {
      throw new Error(`Not connected to server ${session.serverId}`);
    }

    await client.cancelSession(sessionId);
  }

  // ============================================================================
  // Permission Handling
  // ============================================================================

  /**
   * Add pending permission request
   */
  addPendingPermission(request: ACPPermissionRequest): void {
    this.pendingPermissions.set(request.requestId, request);
    debugLogger.info('mcp', `Permission request: ${request.title}`);
  }

  /**
   * Respond to permission request
   */
  async respondToPermission(requestId: string, optionId: string): Promise<void> {
    const request = this.pendingPermissions.get(requestId);

    if (!request) {
      throw new Error(`Permission request ${requestId} not found`);
    }

    const session = this.sessions.get(
      Array.from(this.sessions.values()).find(
        (s) => s.serverId === request.toolCallId.split('_')[0]
      )?.id || ''
    );

    if (!session) {
      throw new Error('Session not found for permission request');
    }

    const client = this.clients.get(session.serverId);

    if (!client) {
      throw new Error(`Not connected to server ${session.serverId}`);
    }

    await client.respondToPermission(requestId, optionId);

    // Remove from pending
    this.pendingPermissions.delete(requestId);

    debugLogger.info('mcp', `Responded to permission: ${requestId}`);
  }

  /**
   * Get pending permissions
   */
  getPendingPermissions(): ACPPermissionRequest[] {
    return Array.from(this.pendingPermissions.values());
  }

  // ============================================================================
  // OAuth Support (Following MCP patterns)
  // ============================================================================

  /**
   * Start OAuth flow for server
   */
  async startOAuthFlow(serverId: string): Promise<string> {
    const config = this.config.servers.find((s) => s.id === serverId);

    if (!config?.oauthDiscovery) {
      throw new Error('OAuth not configured for this server');
    }

    // Generate state parameter
    const state = `${serverId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    // Store state for validation
    await SecureStoragePlugin.set({
      key: `acp_oauth_state_${state}`,
      value: JSON.stringify({ serverId, timestamp: Date.now() }),
    });

    // Build authorization URL
    const authUrl = new URL(config.oauthDiscovery.authorizationEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', 'caw-caw'); // TODO: Make configurable
    authUrl.searchParams.set('redirect_uri', `${window.location.origin}/acp/callback`);
    authUrl.searchParams.set('state', state);

    if (config.oauthDiscovery.scopes) {
      authUrl.searchParams.set('scope', config.oauthDiscovery.scopes.join(' '));
    }

    return authUrl.toString();
  }

  /**
   * Complete OAuth flow
   */
  async completeOAuthFlow(code: string, state: string): Promise<void> {
    // Validate state
    const stateResult = await SecureStoragePlugin.get({
      key: `acp_oauth_state_${state}`,
    });

    if (!stateResult.value) {
      throw new Error('Invalid OAuth state');
    }

    const stateData = JSON.parse(stateResult.value);
    const serverId = stateData.serverId;

    const config = this.config.servers.find((s) => s.id === serverId);

    if (!config?.oauthDiscovery) {
      throw new Error('OAuth not configured');
    }

    // Exchange code for token
    const httpResponse = await httpClient.post(config.oauthDiscovery.tokenEndpoint, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${window.location.origin}/acp/callback`,
      client_id: 'caw-caw', // TODO: Make configurable
    });
    const tokenResponse = await httpResponse.json();

    // Store tokens
    await SecureStoragePlugin.set({
      key: `${ACP_OAUTH_PREFIX}${serverId}`,
      value: JSON.stringify(tokenResponse),
    });

    // Cleanup state
    await SecureStoragePlugin.remove({ key: `acp_oauth_state_${state}` });

    debugLogger.info('mcp', `OAuth completed for ${config.name}`);
  }
}

// Singleton instance
export const acpManager = new ACPManager();
