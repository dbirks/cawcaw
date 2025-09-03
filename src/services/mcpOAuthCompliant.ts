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

// Generate MCP-compliant scope format (provider-specific)
function generateMCPScope(resourceIdentifier: string): string {
  // Hugging Face uses predefined scopes, not the generic MCP format
  if (resourceIdentifier === 'huggingface.co') {
    return 'read-mcp';
  }
  
  // Default MCP 2025-03-26 format for other providers
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

      // Fallback: Try well-known OAuth discovery endpoints
      return await this.tryWellKnownDiscovery(serverUrl);
    } catch (error) {
      debugLogger.error('oauth', '❌ OAuth capability discovery failed', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      return undefined;
    }
  }

  // Fallback: Try dynamic discovery from well-known endpoints
  private async tryWellKnownDiscovery(serverUrl: string): Promise<MCPOAuthDiscovery | undefined> {
    debugLogger.info('oauth', '🔄 Trying well-known OAuth discovery');
    
    const resourceIdentifier = extractResourceIdentifier(serverUrl);
    const url = new URL(serverUrl);
    
    // Try common well-known OAuth discovery endpoints
    const wellKnownEndpoints = [
      `${url.protocol}//${url.host}/.well-known/oauth-authorization-server`,
      `${url.protocol}//${url.host}/.well-known/openid_configuration`,
    ];

    for (const endpoint of wellKnownEndpoints) {
      try {
        debugLogger.info('oauth', `🔍 Checking well-known endpoint: ${endpoint}`);
        const response = await fetch(endpoint);
        
        if (response.ok) {
          const config = await response.json();
          
          if (config.authorization_endpoint && config.token_endpoint) {
            debugLogger.info('oauth', '✅ Found OAuth configuration via well-known discovery');
            return {
              authorizationEndpoint: config.authorization_endpoint,
              tokenEndpoint: config.token_endpoint,
              registrationEndpoint: config.registration_endpoint,
              supportedGrantTypes: config.grant_types_supported || ['authorization_code'],
              supportedScopes: [generateMCPScope(resourceIdentifier)],
            };
          }
        }
      } catch (error) {
        debugLogger.debug('oauth', `Well-known endpoint ${endpoint} not available:`, error);
      }
    }
    
    debugLogger.warn('oauth', 'No well-known OAuth discovery endpoints found');
    return undefined;
  }

  // Start OAuth flow with MCP 2025-03-26 compliance and dynamic client registration
  async startOAuthFlow(
    serverId: string,
    serverUrl: string,
    existingDiscovery?: MCPOAuthDiscovery
  ): Promise<string> {
    debugLogger.info('oauth', '🔍 Starting MCP OAuth 2.1 compliant flow with dynamic registration', {
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

    // Step 2: Perform dynamic client registration
    const clientCredentials = await this.registerClient(discovery, serverUrl);
    const clientId = clientCredentials.clientId;

    // Step 3: Generate PKCE parameters (mandatory in OAuth 2.1)
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store PKCE verifier, discovery info, and client credentials
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
      SecureStoragePlugin.set({
        key: `${OAUTH_STORAGE_PREFIX}client_${serverId}`,
        value: JSON.stringify(clientCredentials),
      }),
    ]);

    // Step 4: Build OAuth authorization URL with MCP-specific parameters
    const authUrl = new URL(discovery.authorizationEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('redirect_uri', this.getRedirectUri());
    
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

    debugLogger.info('oauth', '✅ MCP OAuth 2.1 URL generated with dynamic client', {
      authUrl: authUrl.toString(),
      resourceIdentifier,
      mcpScope,
      clientId,
    });

    return authUrl.toString();
  }

  // Dynamic client registration (RFC 7591 compliant)
  async registerClient(
    discovery: MCPOAuthDiscovery,
    serverUrl: string
  ): Promise<{
    clientId: string;
    clientSecret?: string;
  }> {
    debugLogger.info('oauth', '🏗️ Performing dynamic client registration (RFC 7591)');
    
    if (!discovery.registrationEndpoint) {
      throw new Error('OAuth server does not support dynamic client registration');
    }

    // Extract server information for client metadata
    const url = new URL(serverUrl);
    const appName = `cawcaw MCP Client for ${url.hostname}`;
    
    // Build client registration request (RFC 7591)
    const registrationRequest = {
      client_name: appName,
      client_uri: typeof window !== 'undefined' ? window.location.origin : 'cawcaw://app',
      redirect_uris: [this.getRedirectUri()],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none', // PKCE - no client secret needed
      application_type: 'native',
      logo_uri: 'https://raw.githubusercontent.com/dbirks/capacitor-ai-app/main/ios-icon.png',
    };

    debugLogger.info('oauth', '📋 Client registration request:', registrationRequest);

    try {
      const response = await fetch(discovery.registrationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(registrationRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Client registration failed: ${response.status} ${errorText}`);
      }

      const clientInfo = await response.json();
      debugLogger.info('oauth', '✅ Dynamic client registration successful:', {
        clientId: clientInfo.client_id,
        hasSecret: !!clientInfo.client_secret,
      });

      const credentials = {
        clientId: clientInfo.client_id,
        clientSecret: clientInfo.client_secret,
        registeredAt: Date.now(),
      };

      return credentials;
    } catch (error) {
      debugLogger.error('oauth', '❌ Dynamic client registration failed:', error);
      throw new Error(`Failed to register OAuth client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    const [verifierResult, discoveryResult, resourceResult, clientResult] = await Promise.all([
      SecureStoragePlugin.get({ key: `${OAUTH_STORAGE_PREFIX}verifier_${serverId}` }),
      SecureStoragePlugin.get({ key: `${OAUTH_STORAGE_PREFIX}discovery_${serverId}` }),
      SecureStoragePlugin.get({ key: `${OAUTH_STORAGE_PREFIX}resource_${serverId}` }),
      SecureStoragePlugin.get({ key: `${OAUTH_STORAGE_PREFIX}client_${serverId}` }),
    ]);

    if (!verifierResult?.value || !discoveryResult?.value || !resourceResult?.value || !clientResult?.value) {
      throw new Error('OAuth flow data not found - restart authentication');
    }

    const discovery: MCPOAuthDiscovery = JSON.parse(discoveryResult.value);
    const resourceInfo = JSON.parse(resourceResult.value);
    const clientCredentials = JSON.parse(clientResult.value);
    const clientId = clientCredentials.clientId;

    // Exchange authorization code for access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: this.getRedirectUri(),
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
  private getRedirectUri(): string {
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
      SecureStoragePlugin.remove({ key: `${OAUTH_STORAGE_PREFIX}client_${serverId}` }),
    ]);
  }

  // Refresh access token if expired (MCP 2025-03-26 compliant)
  async refreshTokenIfNeeded(serverId: string, tokens: MCPOAuthTokens): Promise<MCPOAuthTokens> {
    if (!this.isTokenExpired(tokens) || !tokens.refreshToken) {
      return tokens;
    }

    debugLogger.info('oauth', '🔄 Refreshing expired MCP OAuth 2.1 token');

    const [discoveryResult, clientResult] = await Promise.all([
      SecureStoragePlugin.get({ key: `${OAUTH_STORAGE_PREFIX}discovery_${serverId}` }),
      SecureStoragePlugin.get({ key: `${OAUTH_STORAGE_PREFIX}client_${serverId}` }),
    ]);

    if (!discoveryResult?.value || !clientResult?.value) {
      throw new Error('OAuth flow data not found');
    }

    const discovery: MCPOAuthDiscovery = JSON.parse(discoveryResult.value);
    const clientCredentials = JSON.parse(clientResult.value);
    const clientId = clientCredentials.clientId;

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