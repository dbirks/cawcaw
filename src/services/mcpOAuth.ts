import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { debugLogger } from '@/services/debugLogger';
import type { MCPOAuthDiscovery, MCPOAuthTokens } from '@/types/mcp';

const OAUTH_STORAGE_PREFIX = 'mcp_oauth_';
const MCP_PROTOCOL_VERSION = '2025-06-18';

// PKCE code verifier and challenge generation
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

export class MCPOAuthManager {
  // Discover if server requires OAuth and get endpoints
  async discoverOAuthCapabilities(serverUrl: string): Promise<MCPOAuthDiscovery | undefined> {
    debugLogger.info('oauth', '🔍 Starting OAuth capability discovery', { serverUrl });

    try {
      // Step 1: Check for OAuth Protected Resource metadata (RFC8414)
      const resourceMetadataUrl = new URL('/.well-known/oauth-protected-resource', serverUrl);
      debugLogger.info('oauth', '🌐 Fetching protected resource metadata', {
        url: resourceMetadataUrl.toString(),
      });

      const resourceResponse = await fetch(resourceMetadataUrl.toString(), {
        headers: {
          Accept: 'application/json',
          'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        },
      });

      debugLogger.info('oauth', '📡 Protected resource response', {
        ok: resourceResponse.ok,
        status: resourceResponse.status,
        statusText: resourceResponse.statusText,
      });

      if (!resourceResponse.ok) {
        debugLogger.info(
          'oauth',
          "ℹ️  Server doesn't require OAuth (no protected resource metadata)"
        );
        return undefined;
      }

      const resourceMetadata = await resourceResponse.json();
      debugLogger.info('oauth', '📋 Protected resource metadata', resourceMetadata);

      const authServerUrl = resourceMetadata.authorization_server || serverUrl;
      debugLogger.info('oauth', '🔗 Authorization server URL', { authServerUrl });

      // Step 2: Get Authorization Server Metadata
      const authMetadataUrl = new URL('/.well-known/oauth-authorization-server', authServerUrl);
      debugLogger.info('oauth', '🌐 Fetching authorization server metadata', {
        url: authMetadataUrl.toString(),
      });

      const authResponse = await fetch(authMetadataUrl.toString(), {
        headers: {
          Accept: 'application/json',
          'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        },
      });

      debugLogger.info('oauth', '📡 Authorization server response', {
        ok: authResponse.ok,
        status: authResponse.status,
        statusText: authResponse.statusText,
      });

      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        debugLogger.error('oauth', '❌ Authorization server metadata fetch failed', {
          errorText,
          status: authResponse.status,
        });
        throw new Error(
          `OAuth authorization server metadata not found: ${authResponse.status} ${errorText}`
        );
      }

      const authMetadata = await authResponse.json();
      debugLogger.info('oauth', '📋 Authorization server metadata', authMetadata);

      return {
        authorizationEndpoint: authMetadata.authorization_endpoint,
        tokenEndpoint: authMetadata.token_endpoint,
        registrationEndpoint: authMetadata.registration_endpoint,
        supportedGrantTypes: authMetadata.grant_types_supported || ['authorization_code'],
        supportedScopes: authMetadata.scopes_supported,
      };
    } catch (error) {
      debugLogger.error('oauth', '❌ OAuth capability discovery failed', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });
      return undefined;
    }
  }

  // Perform dynamic client registration (RFC7591)
  async registerClient(
    discovery: MCPOAuthDiscovery,
    _serverUrl: string
  ): Promise<{
    clientId: string;
    clientSecret?: string;
  }> {
    if (!discovery.registrationEndpoint) {
      throw new Error('Server does not support dynamic client registration');
    }

    // Filter scopes to only include commonly supported ones
    const commonValidScopes = [
      'openid',
      'profile',
      'email',
      'read-repos',
      'write-repos',
      'manage-repos',
      'read-mcp',
      'write-discussions',
      'read-billing',
      'inference-api',
      'jobs',
      'webhooks',
    ];
    const requestedScopes = discovery.supportedScopes?.filter((scope) =>
      commonValidScopes.includes(scope)
    ) || ['openid'];

    debugLogger.info('oauth', '📋 Filtering OAuth scopes for registration', {
      supportedScopes: discovery.supportedScopes,
      filteredScopes: requestedScopes,
    });

    const registrationData = {
      client_name: 'cawcaw - AI chat with tools',
      client_uri: 'https://cawcaw.app',
      logo_uri: 'https://raw.githubusercontent.com/dbirks/capacitor-ai-app/main/ios-icon.png', // Standard OAuth logo field
      redirect_uris: [this.getRedirectUri()], // Base redirect URI for registration
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none', // PKCE public client
      application_type: 'native',
      scope: requestedScopes.join(' '),
    };

    const response = await fetch(discovery.registrationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      },
      body: JSON.stringify(registrationData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dynamic client registration failed: ${response.status} ${errorText}`);
    }

    const clientData = await response.json();
    return {
      clientId: clientData.client_id,
      clientSecret: clientData.client_secret,
    };
  }

  // Start OAuth flow with dynamic discovery and registration
  async startOAuthFlow(
    serverId: string,
    serverUrl: string,
    existingDiscovery?: MCPOAuthDiscovery
  ): Promise<string> {
    debugLogger.info('oauth', '🔍 mcpOAuthManager.startOAuthFlow called', {
      serverId,
      serverUrl,
      hasExistingDiscovery: !!existingDiscovery,
    });

    // Step 1: Use existing discovery data or discover OAuth capabilities
    let discovery = existingDiscovery;
    if (!discovery) {
      debugLogger.info('oauth', '🔍 No existing discovery data, discovering OAuth capabilities...');
      discovery = await this.discoverOAuthCapabilities(serverUrl);
      debugLogger.info('oauth', '📋 Discovery result', discovery);
      if (!discovery) {
        debugLogger.error('oauth', '❌ Server does not support OAuth authentication');
        throw new Error('Server does not support OAuth authentication');
      }
    } else {
      debugLogger.info('oauth', '✅ Using existing discovery data', discovery);
    }

    // Step 2: Register client dynamically if supported
    let clientId: string;
    let clientSecret: string | undefined;

    if (discovery.registrationEndpoint) {
      const registration = await this.registerClient(discovery, serverUrl);
      clientId = registration.clientId;
      clientSecret = registration.clientSecret;

      // Store client credentials
      const clientKey = `${OAUTH_STORAGE_PREFIX}client_${serverId}`;
      debugLogger.info('oauth', '💾 Storing client credentials', { clientKey, serverId });

      await SecureStoragePlugin.set({
        key: clientKey,
        value: JSON.stringify({ clientId, clientSecret }),
      });
    } else {
      throw new Error(
        'Server does not support dynamic client registration. Manual configuration required.'
      );
    }

    // Step 3: Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store code verifier for later use
    const verifierKey = `${OAUTH_STORAGE_PREFIX}verifier_${serverId}`;
    debugLogger.info('oauth', '💾 Storing code verifier', { verifierKey, serverId });

    await SecureStoragePlugin.set({
      key: verifierKey,
      value: codeVerifier,
    });

    // Store discovery info for later use
    const discoveryKey = `${OAUTH_STORAGE_PREFIX}discovery_${serverId}`;
    debugLogger.info('oauth', '💾 Storing discovery info', { discoveryKey, serverId });

    await SecureStoragePlugin.set({
      key: discoveryKey,
      value: JSON.stringify(discovery),
    });

    // Step 4: Build OAuth authorization URL with PKCE
    const authUrl = new URL(discovery.authorizationEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('redirect_uri', this.getRedirectUri(serverId));

    if (discovery.supportedScopes && discovery.supportedScopes.length > 0) {
      authUrl.searchParams.set('scope', discovery.supportedScopes.join(' '));
    }

    // Add state parameter for CSRF protection (includes serverId for tracking)
    const csrfState = generateCodeVerifier();
    const stateData = {
      csrf: csrfState,
      serverId: serverId,
    };
    const state = btoa(JSON.stringify(stateData)); // Base64 encode for URL safety
    authUrl.searchParams.set('state', state);

    const stateKey = `${OAUTH_STORAGE_PREFIX}state_${serverId}`;
    debugLogger.info('oauth', '💾 Storing state parameter with serverId', {
      stateKey,
      serverId,
      stateLength: state.length,
      csrfStateLength: csrfState.length,
    });

    await SecureStoragePlugin.set({
      key: stateKey,
      value: csrfState, // Store only the CSRF part for validation
    });

    return authUrl.toString();
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(
    serverId: string,
    code: string,
    receivedState: string
  ): Promise<MCPOAuthTokens> {
    debugLogger.info('oauth', '🔐 Starting token exchange', {
      serverId,
      hasCode: !!code,
      hasState: !!receivedState,
      codeLength: code?.length,
      stateLength: receivedState?.length,
    });

    // Verify state parameter
    const stateKey = `${OAUTH_STORAGE_PREFIX}state_${serverId}`;
    debugLogger.info('oauth', '🔑 Retrieving stored state', { stateKey });

    const storedState = await SecureStoragePlugin.get({
      key: stateKey,
    });

    // Extract CSRF state from received state parameter (now contains both CSRF and serverId)
    let receivedCsrfState: string;
    try {
      const stateData = JSON.parse(atob(receivedState));
      receivedCsrfState = stateData.csrf;
      debugLogger.info('oauth', '🔓 Extracted CSRF from received state', {
        hasStateData: !!stateData,
        hasReceivedCsrf: !!receivedCsrfState,
        receivedServerId: stateData.serverId,
      });
    } catch (stateParseError) {
      debugLogger.error('oauth', '❌ Failed to parse received state parameter', {
        error: stateParseError instanceof Error ? stateParseError.message : 'Unknown error',
        receivedState,
      });
      throw new Error('Invalid state parameter format');
    }

    debugLogger.info('oauth', '🔍 State comparison', {
      hasStoredState: !!storedState?.value,
      storedStateLength: storedState?.value?.length,
      receivedStateLength: receivedState?.length,
      receivedCsrfLength: receivedCsrfState?.length,
      csrfStatesMatch: storedState?.value === receivedCsrfState,
    });

    if (storedState?.value !== receivedCsrfState) {
      debugLogger.error('oauth', '❌ CSRF state mismatch', {
        storedCsrf: storedState?.value,
        receivedCsrf: receivedCsrfState,
      });
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    // Get stored client credentials and discovery info
    const verifierKey = `${OAUTH_STORAGE_PREFIX}verifier_${serverId}`;
    const clientKey = `${OAUTH_STORAGE_PREFIX}client_${serverId}`;
    const discoveryKey = `${OAUTH_STORAGE_PREFIX}discovery_${serverId}`;

    debugLogger.info('oauth', '🔑 Retrieving OAuth flow data', {
      verifierKey,
      clientKey,
      discoveryKey,
    });

    const [verifierResult, clientResult, discoveryResult] = await Promise.all([
      SecureStoragePlugin.get({ key: verifierKey }),
      SecureStoragePlugin.get({ key: clientKey }),
      SecureStoragePlugin.get({ key: discoveryKey }),
    ]);

    debugLogger.info('oauth', '📦 OAuth flow data retrieval results', {
      hasVerifier: !!verifierResult?.value,
      hasClient: !!clientResult?.value,
      hasDiscovery: !!discoveryResult?.value,
      verifierLength: verifierResult?.value?.length,
      clientLength: clientResult?.value?.length,
      discoveryLength: discoveryResult?.value?.length,
    });

    if (!verifierResult?.value || !clientResult?.value || !discoveryResult?.value) {
      debugLogger.error('oauth', '❌ Missing OAuth flow data in secure storage', {
        missingVerifier: !verifierResult?.value,
        missingClient: !clientResult?.value,
        missingDiscovery: !discoveryResult?.value,
        serverId,
      });
      throw new Error('OAuth flow data not found - restart authentication');
    }

    const clientData = JSON.parse(clientResult.value);
    const discovery: MCPOAuthDiscovery = JSON.parse(discoveryResult.value);

    // Get server configuration to use as resource indicator (RFC 8707)
    let serverUrl = '';
    try {
      const serverConfigResult = await SecureStoragePlugin.get({ key: `mcp_server_${serverId}` });
      if (serverConfigResult?.value) {
        const serverConfig = JSON.parse(serverConfigResult.value);
        serverUrl = serverConfig.url || '';
      }
    } catch (configError) {
      debugLogger.error('oauth', '⚠️ Could not retrieve server config for resource indicator', {
        serverId,
        error: configError instanceof Error ? configError.message : 'Unknown error',
      });
    }

    // Exchange authorization code for access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientData.clientId,
      code,
      redirect_uri: this.getRedirectUri(serverId),
      code_verifier: verifierResult.value,
    });

    // Add resource indicator (RFC 8707) for MCP 2025-06-18 compliance
    if (serverUrl) {
      tokenRequestBody.set('resource', serverUrl);
      debugLogger.info('oauth', '🎯 Added resource indicator for MCP server', {
        serverUrl,
        serverId,
      });
    }

    // Add client secret if available (confidential client)
    if (clientData.clientSecret) {
      tokenRequestBody.set('client_secret', clientData.clientSecret);
    }

    debugLogger.info('oauth', '🌐 Making token exchange request', {
      url: discovery.tokenEndpoint,
      method: 'POST',
      bodyParams: Object.fromEntries(tokenRequestBody),
      hasClientSecret: !!clientData.clientSecret,
    });

    const tokenResponse = await fetch(discovery.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        // Remove MCP-Protocol-Version header - OAuth endpoints don't expect it
      },
      body: tokenRequestBody,
    });

    debugLogger.info('oauth', '📡 Token exchange response received', {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      ok: tokenResponse.ok,
      headers: Object.fromEntries(tokenResponse.headers.entries()),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      debugLogger.error('oauth', '❌ Token exchange failed', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        errorText,
        url: discovery.tokenEndpoint,
      });
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    debugLogger.info('oauth', '✅ Token exchange successful', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      tokenType: tokenData.token_type,
    });

    const tokens: MCPOAuthTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined,
      clientId: clientData.clientId,
      clientSecret: clientData.clientSecret,
    };

    // Store tokens securely
    await this.storeOAuthTokens(serverId, tokens);

    // Clean up temporary storage
    await Promise.all([
      SecureStoragePlugin.remove({ key: `${OAUTH_STORAGE_PREFIX}verifier_${serverId}` }),
      SecureStoragePlugin.remove({ key: `${OAUTH_STORAGE_PREFIX}state_${serverId}` }),
      SecureStoragePlugin.remove({ key: `${OAUTH_STORAGE_PREFIX}client_${serverId}` }),
    ]);

    return tokens;
  }

  // Refresh access token if expired
  async refreshTokenIfNeeded(serverId: string, tokens: MCPOAuthTokens): Promise<MCPOAuthTokens> {
    if (!this.isTokenExpired(tokens) || !tokens.refreshToken) {
      return tokens;
    }

    const discoveryResult = await SecureStoragePlugin.get({
      key: `${OAUTH_STORAGE_PREFIX}discovery_${serverId}`,
    });

    if (!discoveryResult?.value) {
      throw new Error('OAuth discovery data not found');
    }

    const discovery: MCPOAuthDiscovery = JSON.parse(discoveryResult.value);

    const refreshBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    });

    if (tokens.clientId) {
      refreshBody.set('client_id', tokens.clientId);
    }
    if (tokens.clientSecret) {
      refreshBody.set('client_secret', tokens.clientSecret);
    }

    const refreshResponse = await fetch(discovery.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
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
    return updatedTokens;
  }

  // Check if access token is expired
  private isTokenExpired(tokens: MCPOAuthTokens): boolean {
    if (!tokens.tokenExpiresAt) return false;
    // Consider token expired if it expires within the next 5 minutes
    return Date.now() > tokens.tokenExpiresAt - 300000;
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

      if (result?.value) {
        return JSON.parse(result.value);
      }
    } catch (error) {
      console.error('Failed to load OAuth tokens:', error);
    }

    return null;
  }

  // Clear OAuth tokens and discovery data for server
  async clearOAuthTokens(serverId: string): Promise<void> {
    await Promise.all([
      SecureStoragePlugin.remove({ key: `${OAUTH_STORAGE_PREFIX}tokens_${serverId}` }),
      SecureStoragePlugin.remove({ key: `${OAUTH_STORAGE_PREFIX}discovery_${serverId}` }),
    ]);
  }

  // Get redirect URI for OAuth flow
  private getRedirectUri(serverId?: string): string {
    debugLogger.info('oauth', '🔗 getRedirectUri called', {
      serverId,
      hasWindow: typeof window !== 'undefined',
      windowLocation: typeof window !== 'undefined' ? window.location?.href : undefined,
    });

    // For mobile apps, use a custom scheme
    // For web apps, use the current origin
    if (typeof window !== 'undefined') {
      // More reliable Capacitor detection using multiple methods
      const capacitorInWindow = 'capacitor' in window;
      const protocolCheck = window.location?.protocol === 'capacitor:';
      const customSchemeCheck = window.location?.origin?.startsWith('cawcaw://') || false;
      const isCapacitor = capacitorInWindow || protocolCheck || customSchemeCheck;

      debugLogger.info('oauth', '🔍 Capacitor detection', {
        capacitorInWindow,
        protocolCheck,
        customSchemeCheck,
        isCapacitor,
        windowLocationOrigin: window.location?.origin,
        windowLocationProtocol: window.location?.protocol,
      });

      if (isCapacitor) {
        // Use consistent base URI for both registration and authorization
        // ServerId will be tracked via state parameter instead
        const redirectUri = 'cawcaw://oauth-callback';

        debugLogger.info('oauth', '📱 Using Capacitor redirect URI', { redirectUri, serverId });
        return redirectUri;
      }

      const webRedirectUri = `${window.location.origin}/oauth/callback`;
      debugLogger.info('oauth', '🌐 Using web redirect URI', { webRedirectUri });
      return webRedirectUri;
    }

    // Fallback for server-side or no window (use consistent base URI)
    const fallbackUri = 'cawcaw://oauth-callback';

    debugLogger.info('oauth', '🔄 Using fallback redirect URI', { fallbackUri, serverId });
    return fallbackUri;
  }

  // Test if server supports OAuth and get discovery info
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
export const mcpOAuthManager = new MCPOAuthManager();
