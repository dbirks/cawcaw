import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { debugLogger } from '@/services/debugLogger';
import type { MCPOAuthDiscovery, MCPOAuthTokens } from '@/types/mcp';

const OAUTH_STORAGE_PREFIX = 'mcp_oauth_';
const MCP_PROTOCOL_VERSION = '2025-03-26'; // Use 2025-03-26 which has official OAuth support

// PKCE code verifier and challenge generation (OAuth 2.1 compliant)
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64String = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))));
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Parse WWW-Authenticate header for OAuth discovery (MCP 2025-03-26 spec compliant)
function parseWWWAuthenticateHeader(authHeader: string): MCPOAuthDiscovery | undefined {
  debugLogger.info('oauth', '🔍 Parsing WWW-Authenticate header', { authHeader });

  // Expected format: Bearer realm="mcp", authorization_uri="...", token_uri="...", scope="<resource>/mcp:access"
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    debugLogger.warn('oauth', '⚠️ WWW-Authenticate header is not Bearer type');
    return undefined;
  }

  const params = bearerMatch[1];
  const paramRegex = /(\w+)="([^"]+)"/g;
  const parsedParams: Record<string, string> = {};
  
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: RegExp.exec() pattern is standard
  while ((match = paramRegex.exec(params)) !== null) {
    parsedParams[match[1]] = match[2];
  }

  debugLogger.info('oauth', '📋 Parsed WWW-Authenticate parameters', parsedParams);

  // Validate required MCP OAuth parameters
  if (parsedParams.realm !== 'mcp') {
    debugLogger.warn('oauth', '⚠️ WWW-Authenticate realm is not "mcp"');
    return undefined;
  }

  if (!parsedParams.authorization_uri || !parsedParams.token_uri) {
    debugLogger.warn('oauth', '⚠️ Missing required OAuth endpoints in WWW-Authenticate header');
    return undefined;
  }

  return {
    authorizationEndpoint: parsedParams.authorization_uri,
    tokenEndpoint: parsedParams.token_uri,
    registrationEndpoint: parsedParams.registration_endpoint,
    supportedGrantTypes: ['authorization_code'],
    supportedScopes: parsedParams.scope ? [parsedParams.scope] : undefined,
  };
}

// Extract resource identifier from MCP server URL
function extractResourceIdentifier(serverUrl: string): string {
  try {
    const url = new URL(serverUrl);
    return url.hostname;
  } catch {
    debugLogger.error('oauth', '❌ Invalid server URL for resource identifier', { serverUrl });
    throw new Error(`Invalid MCP server URL: ${serverUrl}`);
  }
}

// Generate MCP-compliant scope format
function generateMCPScope(resourceIdentifier: string): string {
  return `${resourceIdentifier}/mcp:access`;
}

export class MCPOAuthManagerCompliant {
  // Discover OAuth capabilities using MCP 2025-03-26 WWW-Authenticate method
  async discoverOAuthCapabilities(serverUrl: string): Promise<MCPOAuthDiscovery | undefined> {
    debugLogger.info('oauth', '🔍 Starting MCP OAuth 2.1 capability discovery', { serverUrl });

    try {
      // Step 1: Make unauthenticated request to MCP server to get WWW-Authenticate header
      debugLogger.info('oauth', '🌐 Making unauthenticated request to trigger WWW-Authenticate header');
      
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'initialize',
          params: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: { tools: {} },
            clientInfo: { name: 'cawcaw', version: '1.0.0' },
          },
        }),
      });

      debugLogger.info('oauth', '📡 MCP server response', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      // Step 2: Check for WWW-Authenticate header (401 response expected for OAuth-protected resources)
      if (response.status === 401) {
        const authHeader = response.headers.get('WWW-Authenticate');
        if (authHeader) {
          debugLogger.info('oauth', '✅ Found WWW-Authenticate header', { authHeader });
          return parseWWWAuthenticateHeader(authHeader);
        } else {
          debugLogger.warn('oauth', '⚠️ 401 response but no WWW-Authenticate header');
        }
      } else if (response.status === 200) {
        debugLogger.info('oauth', 'ℹ️ MCP server does not require authentication');
        return undefined;
      }

      // Fallback: Try common external IdP endpoints for MCP servers
      return await this.tryExternalIdPDiscovery(serverUrl);
    } catch (error) {
      debugLogger.error('oauth', '❌ OAuth capability discovery failed', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      return undefined;
    }
  }

  // Fallback: Try discovery with common external Identity Providers
  private async tryExternalIdPDiscovery(serverUrl: string): Promise<MCPOAuthDiscovery | undefined> {
    debugLogger.info('oauth', '🔄 Trying external IdP discovery fallback');
    
    const resourceIdentifier = extractResourceIdentifier(serverUrl);
    
    // Common external IdPs that might be used with MCP servers
    const commonIdPs = [
      {
        name: 'GitHub',
        authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        tokenEndpoint: 'https://github.com/login/oauth/access_token',
        registrationEndpoint: 'https://github.com/settings/applications/new',
      },
      {
        name: 'Google',
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
      },
    ];

    // For demo/development, assume GitHub OAuth for now
    // In production, this would be configured or discovered differently
    debugLogger.info('oauth', '🔄 Using GitHub as external IdP for MCP Resource Provider');
    
    return {
      authorizationEndpoint: commonIdPs[0].authorizationEndpoint,
      tokenEndpoint: commonIdPs[0].tokenEndpoint,
      registrationEndpoint: commonIdPs[0].registrationEndpoint,
      supportedGrantTypes: ['authorization_code'],
      supportedScopes: [generateMCPScope(resourceIdentifier)],
    };
  }

  // Start OAuth flow with MCP 2025-03-26 compliance
  async startOAuthFlow(
    serverId: string,
    serverUrl: string,
    existingDiscovery?: MCPOAuthDiscovery
  ): Promise<string> {
    debugLogger.info('oauth', '🔍 Starting MCP OAuth 2.1 compliant flow', {
      serverId,
      serverUrl,
      hasExistingDiscovery: !!existingDiscovery,
    });

    // Extract resource identifier for MCP scope
    const resourceIdentifier = extractResourceIdentifier(serverUrl);
    const mcpScope = generateMCPScope(resourceIdentifier);

    debugLogger.info('oauth', '🎯 MCP Resource Provider setup', {
      resourceIdentifier,
      mcpScope,
      serverUrl,
    });

    // Step 1: Discover OAuth capabilities
    let discovery = existingDiscovery;
    if (!discovery) {
      discovery = await this.discoverOAuthCapabilities(serverUrl);
      if (!discovery) {
        throw new Error('MCP server does not support OAuth authentication');
      }
    }

    // Step 2: For external IdPs, we need client credentials
    // In production, this would use dynamic client registration or pre-configured clients
    const clientId = process.env.GITHUB_CLIENT_ID || 'your-github-client-id';
    
    if (!clientId || clientId.includes('your-github')) {
      throw new Error('GitHub OAuth client ID not configured for MCP Resource Provider');
    }

    // Step 3: Generate PKCE parameters (mandatory in OAuth 2.1)
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store PKCE verifier and discovery info
    await Promise.all([
      SecureStoragePlugin.set({
        key: `${OAUTH_STORAGE_PREFIX}verifier_${serverId}`,
        value: codeVerifier,
      }),
      SecureStoragePlugin.set({
        key: `${OAUTH_STORAGE_PREFIX}discovery_${serverId}`,
        value: JSON.stringify(discovery),
      }),
      SecureStoragePlugin.set({
        key: `${OAUTH_STORAGE_PREFIX}resource_${serverId}`,
        value: JSON.stringify({ resourceIdentifier, serverUrl, mcpScope }),
      }),
    ]);

    // Step 4: Build OAuth authorization URL with MCP-specific parameters
    const authUrl = new URL(discovery.authorizationEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('redirect_uri', this.getRedirectUri(serverId));
    
    // Use MCP-compliant scope format
    authUrl.searchParams.set('scope', mcpScope);
    
    // Add resource identifier (RFC 8707)
    authUrl.searchParams.set('resource', serverUrl);

    // Add state parameter for CSRF protection
    const csrfState = generateCodeVerifier();
    const stateData = { csrf: csrfState, serverId };
    const state = btoa(JSON.stringify(stateData));
    authUrl.searchParams.set('state', state);

    await SecureStoragePlugin.set({
      key: `${OAUTH_STORAGE_PREFIX}state_${serverId}`,
      value: csrfState,
    });

    debugLogger.info('oauth', '✅ MCP OAuth 2.1 URL generated', {
      authUrl: authUrl.toString(),
      resourceIdentifier,
      mcpScope,
    });

    return authUrl.toString();
  }

  // Exchange authorization code for access token (MCP 2025-03-26 compliant)
  async exchangeCodeForToken(
    serverId: string,
    code: string,
    receivedState: string
  ): Promise<MCPOAuthTokens> {
    debugLogger.info('oauth', '🔐 Starting MCP OAuth 2.1 token exchange', { serverId });

    // Verify state parameter
    const storedState = await SecureStoragePlugin.get({
      key: `${OAUTH_STORAGE_PREFIX}state_${serverId}`,
    });

    const stateData = JSON.parse(atob(receivedState));
    if (storedState?.value !== stateData.csrf) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    // Get stored flow data
    const [verifierResult, discoveryResult, resourceResult] = await Promise.all([
      SecureStoragePlugin.get({ key: `${OAUTH_STORAGE_PREFIX}verifier_${serverId}` }),
      SecureStoragePlugin.get({ key: `${OAUTH_STORAGE_PREFIX}discovery_${serverId}` }),
      SecureStoragePlugin.get({ key: `${OAUTH_STORAGE_PREFIX}resource_${serverId}` }),
    ]);

    if (!verifierResult?.value || !discoveryResult?.value || !resourceResult?.value) {
      throw new Error('OAuth flow data not found - restart authentication');
    }

    const discovery: MCPOAuthDiscovery = JSON.parse(discoveryResult.value);
    const resourceInfo = JSON.parse(resourceResult.value);
    const clientId = process.env.GITHUB_CLIENT_ID || 'your-github-client-id';

    // Exchange authorization code for access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: this.getRedirectUri(serverId),
      code_verifier: verifierResult.value,
    });

    // Add MCP resource identifier (RFC 8707)
    tokenRequestBody.set('resource', resourceInfo.serverUrl);

    const tokenResponse = await fetch(discovery.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenRequestBody,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    
    const tokens: MCPOAuthTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined,
      clientId,
    };

    // Store tokens and clean up temporary data
    await this.storeOAuthTokens(serverId, tokens);
    await this.cleanupTemporaryStorage(serverId);

    debugLogger.info('oauth', '✅ MCP OAuth 2.1 token exchange successful');
    return tokens;
  }

  // Clean up temporary OAuth flow storage
  private async cleanupTemporaryStorage(serverId: string): Promise<void> {
    await Promise.all([
      SecureStoragePlugin.remove({ key: `${OAUTH_STORAGE_PREFIX}verifier_${serverId}` }),
      SecureStoragePlugin.remove({ key: `${OAUTH_STORAGE_PREFIX}state_${serverId}` }),
      SecureStoragePlugin.remove({ key: `${OAUTH_STORAGE_PREFIX}resource_${serverId}` }),
    ]);
  }

  // Store OAuth tokens securely
  private async storeOAuthTokens(serverId: string, tokens: MCPOAuthTokens): Promise<void> {
    await SecureStoragePlugin.set({
      key: `${OAUTH_STORAGE_PREFIX}tokens_${serverId}`,
      value: JSON.stringify(tokens),
    });
  }

  // Load OAuth tokens from secure storage
  async loadOAuthTokens(serverId: string): Promise<MCPOAuthTokens | null> {
    try {
      const result = await SecureStoragePlugin.get({
        key: `${OAUTH_STORAGE_PREFIX}tokens_${serverId}`,
      });
      return result?.value ? JSON.parse(result.value) : null;
    } catch (error) {
      debugLogger.error('oauth', 'Failed to load OAuth tokens', { error });
      return null;
    }
  }

  // Get redirect URI for OAuth flow
  private getRedirectUri(_serverId?: string): string {
    if (typeof window !== 'undefined') {
      const isCapacitor = 'capacitor' in window || window.location?.protocol === 'capacitor:';
      
      if (isCapacitor) {
        return 'cawcaw://oauth-callback';
      }
      
      return `${window.location.origin}/oauth/callback`;
    }
    
    return 'cawcaw://oauth-callback';
  }

  // Clear OAuth tokens and discovery data for server
  async clearOAuthTokens(serverId: string): Promise<void> {
    await Promise.all([
      SecureStoragePlugin.remove({ key: `${OAUTH_STORAGE_PREFIX}tokens_${serverId}` }),
      SecureStoragePlugin.remove({ key: `${OAUTH_STORAGE_PREFIX}discovery_${serverId}` }),
    ]);
  }

  // Refresh access token if expired (MCP 2025-03-26 compliant)
  async refreshTokenIfNeeded(serverId: string, tokens: MCPOAuthTokens): Promise<MCPOAuthTokens> {
    if (!this.isTokenExpired(tokens) || !tokens.refreshToken) {
      return tokens;
    }

    debugLogger.info('oauth', '🔄 Refreshing expired MCP OAuth 2.1 token');

    const discoveryResult = await SecureStoragePlugin.get({
      key: `${OAUTH_STORAGE_PREFIX}discovery_${serverId}`,
    });

    if (!discoveryResult?.value) {
      throw new Error('OAuth discovery data not found');
    }

    const discovery: MCPOAuthDiscovery = JSON.parse(discoveryResult.value);
    const clientId = process.env.GITHUB_CLIENT_ID || 'your-github-client-id';

    const refreshBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: clientId,
    });

    const refreshResponse = await fetch(discovery.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: refreshBody,
    });

    if (!refreshResponse.ok) {
      throw new Error(`Token refresh failed: ${refreshResponse.status}`);
    }

    const tokenData = await refreshResponse.json();

    const updatedTokens: MCPOAuthTokens = {
      ...tokens,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || tokens.refreshToken,
      tokenExpiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined,
    };

    await this.storeOAuthTokens(serverId, updatedTokens);
    debugLogger.info('oauth', '✅ MCP OAuth 2.1 token refresh successful');
    return updatedTokens;
  }

  // Check if access token is expired
  private isTokenExpired(tokens: MCPOAuthTokens): boolean {
    if (!tokens.tokenExpiresAt) return false;
    // Consider token expired if it expires within the next 5 minutes
    return Date.now() > tokens.tokenExpiresAt - 300000;
  }

  // Dynamic client registration compatibility (not used in MCP 2025-03-26 Resource Provider model)
  async registerClient(
    _discovery: MCPOAuthDiscovery,
    _serverUrl: string
  ): Promise<{
    clientId: string;
    clientSecret?: string;
  }> {
    debugLogger.warn('oauth', '⚠️ Dynamic client registration not used in MCP OAuth 2.1 Resource Provider model');
    
    // In the Resource Provider model, we use pre-configured external IdP clients
    const clientId = process.env.GITHUB_CLIENT_ID || 'your-github-client-id';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    
    if (!clientId || clientId.includes('your-github')) {
      throw new Error('External Identity Provider client credentials not configured. Please set GITHUB_CLIENT_ID in .env file.');
    }

    return {
      clientId,
      clientSecret,
    };
  }

  // Test if server supports MCP OAuth 2.1
  async testOAuthSupport(serverUrl: string): Promise<{
    supportsOAuth: boolean;
    discovery?: MCPOAuthDiscovery;
    error?: string;
  }> {
    try {
      const discovery = await this.discoverOAuthCapabilities(serverUrl);
      return {
        supportsOAuth: !!discovery,
        discovery: discovery || undefined,
      };
    } catch (error) {
      return {
        supportsOAuth: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const mcpOAuthManagerCompliant = new MCPOAuthManagerCompliant();