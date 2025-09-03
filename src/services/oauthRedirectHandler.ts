import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { mcpManager } from './mcpManager';

/**
 * OAuth Redirect Handler Service
 * Handles OAuth callback redirects from external OAuth providers
 */
class OAuthRedirectHandler {
  private isListening = false;

  /**
   * Initialize the OAuth redirect handler
   * Should be called when the app starts
   */
  async initialize(): Promise<void> {
    if (this.isListening) return;

    // Listen for app URL events (OAuth redirects)
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.handleOAuthRedirect(event.url);
    });

    this.isListening = true;
    console.log('OAuth redirect handler initialized');
  }

  /**
   * Handle OAuth redirect URL
   * Expected format: cawcaw://oauth/callback?code=AUTH_CODE&state=STATE&server_id=SERVER_ID
   */
  private async handleOAuthRedirect(url: string): Promise<void> {
    console.log('OAuth redirect received:', url);

    try {
      const urlObj = new URL(url);

      // Check if this is an OAuth callback
      if (urlObj.protocol === 'cawcaw:' && urlObj.pathname === '//oauth/callback') {
        const searchParams = urlObj.searchParams;
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const serverId = searchParams.get('server_id');

        if (!code || !state || !serverId) {
          console.error('Invalid OAuth callback parameters:', { code, state, serverId });
          this.showError('Invalid OAuth callback parameters');
          return;
        }

        // Handle OAuth error responses
        const error = searchParams.get('error');
        if (error) {
          const errorDescription = searchParams.get('error_description');
          console.error('OAuth error:', error, errorDescription);
          this.showError(`OAuth error: ${errorDescription || error}`);
          return;
        }

        console.log('Processing OAuth callback for server:', serverId);

        // Complete the OAuth flow
        try {
          await mcpManager.completeOAuthFlow(serverId, code, state);
          this.showSuccess('OAuth authentication successful! You can now use this MCP server.');
        } catch (error) {
          console.error('Failed to complete OAuth flow:', error);
          this.showError(
            `OAuth authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    } catch (error) {
      console.error('Failed to parse OAuth redirect URL:', error);
      this.showError('Failed to process OAuth callback');
    }
  }

  /**
   * Show success message to user
   */
  private showSuccess(message: string): void {
    // Using native alert for now, could be replaced with a toast or notification
    if (typeof window !== 'undefined') {
      alert(`✅ ${message}`);
    }
    console.log('OAuth Success:', message);
  }

  /**
   * Show error message to user
   */
  private showError(message: string): void {
    // Using native alert for now, could be replaced with a toast or notification
    if (typeof window !== 'undefined') {
      alert(`❌ ${message}`);
    }
    console.error('OAuth Error:', message);
  }

  /**
   * Clean up the redirect handler
   */
  async cleanup(): Promise<void> {
    if (this.isListening) {
      App.removeAllListeners();
      this.isListening = false;
      console.log('OAuth redirect handler cleaned up');
    }
  }

  /**
   * Get the redirect URI that should be used for OAuth flows
   */
  getRedirectUri(): string {
    return 'cawcaw://oauth/callback';
  }

  /**
   * Build OAuth redirect URL with server ID for tracking
   * This modifies the OAuth URL to include the server ID as a parameter
   */
  buildOAuthUrl(baseAuthUrl: string, serverId: string): string {
    try {
      const url = new URL(baseAuthUrl);

      // Add server_id to the state parameter or as a separate parameter
      // We'll embed it in the redirect_uri as a query parameter
      const redirectUri = `${this.getRedirectUri()}?server_id=${encodeURIComponent(serverId)}`;
      url.searchParams.set('redirect_uri', redirectUri);

      return url.toString();
    } catch (error) {
      console.error('Failed to build OAuth URL:', error);
      return baseAuthUrl;
    }
  }
}

// Export singleton instance
export const oauthRedirectHandler = new OAuthRedirectHandler();
