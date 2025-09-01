import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import type { MCPOAuthDiscovery, MCPOAuthTokens } from '@/types/mcp';

const OAUTH_STORAGE_PREFIX = 'mcp_oauth_';
const MCP_PROTOCOL_VERSION = '2025-03-26';

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
  async discoverOAuthCapabilities(serverUrl: string): Promise<MCPOAuthDiscovery | null> {
    try {
      // Step 1: Check for OAuth Protected Resource metadata (RFC8414)
      const resourceMetadataUrl = new URL('/.well-known/oauth-protected-resource', serverUrl);
      const resourceResponse = await fetch(resourceMetadataUrl.toString(), {
        headers: {
          Accept: 'application/json',
          'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        },
      });

      if (!resourceResponse.ok) {
        // Server doesn't require OAuth
        return null;
      }

      const resourceMetadata = await resourceResponse.json();
      const authServerUrl = resourceMetadata.authorization_server || serverUrl;

      // Step 2: Get Authorization Server Metadata
      const authMetadataUrl = new URL('/.well-known/oauth-authorization-server', authServerUrl);
      const authResponse = await fetch(authMetadataUrl.toString(), {
        headers: {
          Accept: 'application/json',
          'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        },
      });

      if (!authResponse.ok) {
        throw new Error('OAuth authorization server metadata not found');
      }

      const authMetadata = await authResponse.json();

      return {
        authorizationEndpoint: authMetadata.authorization_endpoint,
        tokenEndpoint: authMetadata.token_endpoint,
        registrationEndpoint: authMetadata.registration_endpoint,
        supportedGrantTypes: authMetadata.grant_types_supported || ['authorization_code'],
        supportedScopes: authMetadata.scopes_supported,
      };
    } catch (error) {
      console.error('OAuth capability discovery failed:', error);
      return null;
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

    const registrationData = {
      client_name: 'caw caw - AI Chat App',
      client_uri: 'https://cawcaw.app',
      redirect_uris: [this.getRedirectUri()],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none', // PKCE public client
      application_type: 'native',
      scope: discovery.supportedScopes?.join(' ') || '',
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
  async startOAuthFlow(serverId: string, serverUrl: string): Promise<string> {
    // Step 1: Discover OAuth capabilities
    const discovery = await this.discoverOAuthCapabilities(serverUrl);
    if (!discovery) {
      throw new Error('Server does not support OAuth authentication');
    }

    // Step 2: Register client dynamically if supported
    let clientId: string;
    let clientSecret: string | undefined;

    if (discovery.registrationEndpoint) {
      const registration = await this.registerClient(discovery, serverUrl);
      clientId = registration.clientId;
      clientSecret = registration.clientSecret;

      // Store client credentials
      await SecureStoragePlugin.set({
        key: `${OAUTH_STORAGE_PREFIX}client_${serverId}`,
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
    await SecureStoragePlugin.set({
      key: `${OAUTH_STORAGE_PREFIX}verifier_${serverId}`,
      value: codeVerifier,
    });

    // Store discovery info for later use
    await SecureStoragePlugin.set({
      key: `${OAUTH_STORAGE_PREFIX}discovery_${serverId}`,
      value: JSON.stringify(discovery),
    });

    // Step 4: Build OAuth authorization URL with PKCE
    const authUrl = new URL(discovery.authorizationEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('redirect_uri', this.getRedirectUri());

    if (discovery.supportedScopes && discovery.supportedScopes.length > 0) {
      authUrl.searchParams.set('scope', discovery.supportedScopes.join(' '));
    }

    // Add state parameter for CSRF protection
    const state = generateCodeVerifier();
    authUrl.searchParams.set('state', state);
    await SecureStoragePlugin.set({
      key: `${OAUTH_STORAGE_PREFIX}state_${serverId}`,
      value: state,
    });

    return authUrl.toString();
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(
    serverId: string,
    code: string,
    receivedState: string
  ): Promise<MCPOAuthTokens> {
    // Verify state parameter
    const storedState = await SecureStoragePlugin.get({
      key: `${OAUTH_STORAGE_PREFIX}state_${serverId}`,
    });

    if (storedState?.value !== receivedState) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    // Get stored client credentials and discovery info
    const [verifierResult, clientResult, discoveryResult] = await Promise.all([
      SecureStoragePlugin.get({ key: `${OAUTH_STORAGE_PREFIX}verifier_${serverId}` }),
      SecureStoragePlugin.get({ key: `${OAUTH_STORAGE_PREFIX}client_${serverId}` }),
      SecureStoragePlugin.get({ key: `${OAUTH_STORAGE_PREFIX}discovery_${serverId}` }),
    ]);

    if (!verifierResult?.value || !clientResult?.value || !discoveryResult?.value) {
      throw new Error('OAuth flow data not found - restart authentication');
    }

    const clientData = JSON.parse(clientResult.value);
    const discovery: MCPOAuthDiscovery = JSON.parse(discoveryResult.value);

    // Exchange authorization code for access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientData.clientId,
      code,
      redirect_uri: this.getRedirectUri(),
      code_verifier: verifierResult.value,
    });

    // Add client secret if available (confidential client)
    if (clientData.clientSecret) {
      tokenRequestBody.set('client_secret', clientData.clientSecret);
    }

    const tokenResponse = await fetch(discovery.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
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
  private getRedirectUri(): string {
    // For mobile apps, use a custom scheme
    // For web apps, use the current origin
    if (typeof window !== 'undefined') {
      const isCapacitor = 'capacitor' in window;
      if (isCapacitor) {
        return 'cawcaw://oauth/callback';
      }
      return `${window.location.origin}/oauth/callback`;
    }
    return 'cawcaw://oauth/callback';
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
