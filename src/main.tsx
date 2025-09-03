import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import App from './App.tsx';
import { debugLogger } from './services/debugLogger';
import { mcpOAuthManager } from './services/mcpOAuth';

// Initialize StatusBar on mobile platforms
if (Capacitor.isNativePlatform()) {
  // Use Style.Default for automatic light/dark mode adaptation
  StatusBar.setStyle({ style: Style.Default }).catch(console.error);
  // Enable overlay for full-bleed design with proper safe areas
  StatusBar.setOverlaysWebView({ overlay: true }).catch(console.error);
}

// Handle OAuth redirect callbacks from custom URL scheme
CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
  debugLogger.info('oauth', '📱 Received app URL open event', { url });

  // Handle OAuth callback redirects
  if (url?.startsWith('cawcaw://oauth-callback')) {
    try {
      debugLogger.info('oauth', '🔗 Processing OAuth callback URL');

      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');
      const serverId = urlObj.searchParams.get('server_id');
      const error = urlObj.searchParams.get('error');

      debugLogger.info('oauth', '📋 OAuth callback parameters', {
        hasCode: !!code,
        hasState: !!state,
        serverId,
        error,
      });

      if (error) {
        debugLogger.error('oauth', '❌ OAuth callback error', { error, url });
        alert(`OAuth authentication failed: ${error}`);
        return;
      }

      if (code && state && serverId) {
        debugLogger.info('oauth', '✅ Valid OAuth callback, exchanging code for token');
        await mcpOAuthManager.exchangeCodeForToken(serverId, code, state);
        debugLogger.info('oauth', '🎉 OAuth authentication completed successfully');
        alert('✅ OAuth authentication successful!');
      } else {
        debugLogger.error('oauth', '❌ Missing required OAuth callback parameters', {
          code: !!code,
          state: !!state,
          serverId: !!serverId,
        });
        alert('❌ Invalid OAuth callback - missing required parameters');
      }
    } catch (error) {
      debugLogger.error('oauth', '❌ Failed to process OAuth callback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        url,
      });
      alert(
        `❌ Failed to complete OAuth authentication: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
