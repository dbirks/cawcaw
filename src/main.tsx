// FIRST IMPORT - Initialize Sentry before anything else
import './sentry';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import App from './App.tsx';
import { debugLogger } from './services/debugLogger';
import { mcpManager } from './services/mcpManager';

// Initialize StatusBar on mobile platforms
if (Capacitor.isNativePlatform()) {
  // Use Style.Default for automatic light/dark mode adaptation
  StatusBar.setStyle({ style: Style.Default }).catch(console.error);
  // Enable overlay for full-bleed design with proper safe areas
  StatusBar.setOverlaysWebView({ overlay: true }).catch(console.error);
}

// Reconnect MCP servers when app resumes from background
CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
  if (isActive) {
    debugLogger.info('mcp', '🔄 App resumed - reconnecting MCP servers');
    try {
      await mcpManager.loadConfigurations();
      await mcpManager.connectToEnabledServers();
      debugLogger.info('mcp', '✅ MCP servers reconnected successfully');
    } catch (error) {
      debugLogger.error('mcp', '❌ Failed to reconnect MCP servers on app resume', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
});

// Handle OAuth redirect callbacks from custom URL scheme
CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
  debugLogger.info('oauth', '📱 Received app URL open event', {
    url,
    urlLength: url?.length,
    startsWithCawcaw: url?.startsWith('cawcaw://'),
    startsWithCallback: url?.startsWith('cawcaw://oauth-callback'),
  });

  // Handle OAuth callback redirects (more flexible matching)
  if (url?.startsWith('cawcaw://')) {
    debugLogger.info('oauth', '🔗 Processing cawcaw:// URL - attempting OAuth callback parsing');

    try {
      // Try parsing as URL object first
      let code: string | null = null;
      let state: string | null = null;
      let serverId: string | null = null;
      let error: string | null = null;

      try {
        const urlObj = new URL(url);
        code = urlObj.searchParams.get('code');
        state = urlObj.searchParams.get('state');
        error = urlObj.searchParams.get('error');

        // Extract serverId from encoded state parameter
        if (state) {
          try {
            const stateData = JSON.parse(atob(state));
            serverId = stateData.serverId;
            debugLogger.info('oauth', '🔓 Extracted serverId from state parameter', {
              serverId,
              hasStateData: !!stateData,
            });
          } catch (stateParseError) {
            debugLogger.warn('oauth', '⚠️ Failed to parse serverId from state', {
              stateParseError:
                stateParseError instanceof Error ? stateParseError.message : 'Unknown error',
              state,
            });
          }
        }

        debugLogger.info('oauth', '🔧 URL object parsing successful', {
          urlObj: urlObj.toString(),
        });
      } catch (urlParseError) {
        debugLogger.warn('oauth', '⚠️ URL object parsing failed, trying manual parsing', {
          urlParseError: urlParseError instanceof Error ? urlParseError.message : 'Unknown error',
          url,
        });

        // Fallback: manual parameter extraction
        const params = url.split('?')[1];
        if (params) {
          const searchParams = new URLSearchParams(params);
          code = searchParams.get('code');
          state = searchParams.get('state');
          error = searchParams.get('error');

          // Extract serverId from encoded state parameter
          if (state) {
            try {
              const stateData = JSON.parse(atob(state));
              serverId = stateData.serverId;
              debugLogger.info('oauth', '🔓 Manual parsing: extracted serverId from state', {
                serverId,
              });
            } catch (stateParseError) {
              debugLogger.warn('oauth', '⚠️ Manual parsing: failed to parse serverId from state', {
                stateParseError:
                  stateParseError instanceof Error ? stateParseError.message : 'Unknown error',
              });
            }
          }

          debugLogger.info('oauth', '🔧 Manual parameter parsing attempted', { params });
        }
      }

      debugLogger.info('oauth', '📋 OAuth callback parameters extracted', {
        hasCode: !!code,
        hasState: !!state,
        serverId,
        error,
        codeLength: code?.length,
        stateLength: state?.length,
      });

      if (error) {
        debugLogger.error('oauth', '❌ OAuth callback error', { error, url });
        alert(`OAuth authentication failed: ${error}`);
        return;
      }

      if (code && state) {
        if (!serverId) {
          debugLogger.warn('oauth', '⚠️ No serverId found in callback URL, this may cause issues');
        }

        debugLogger.info(
          'oauth',
          '✅ Valid OAuth callback with code and state, attempting to complete flow'
        );

        // If we have a serverId, use it; otherwise this will likely fail but we'll try anyway
        const serverIdToUse = serverId || 'unknown-server';
        debugLogger.info('oauth', '🔧 Using serverId for OAuth completion', { serverIdToUse });

        await mcpManager.completeOAuthFlow(serverIdToUse, code, state);
        debugLogger.info(
          'oauth',
          '🎉 OAuth authentication completed successfully - server should now be connected'
        );

        // Dispatch custom event to refresh Settings UI
        window.dispatchEvent(
          new CustomEvent('oauth-completed', { detail: { serverId: serverIdToUse } })
        );

        alert(
          '✅ OAuth authentication successful! The connection status should update automatically.'
        );
      } else {
        debugLogger.error(
          'oauth',
          '❌ Missing required OAuth callback parameters (code and/or state)',
          {
            hasCode: !!code,
            hasState: !!state,
            hasServerId: !!serverId,
            url,
          }
        );
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
  } else {
    debugLogger.info('oauth', '📱 Received non-cawcaw URL', {
      url,
      startsWithCawcaw: url?.startsWith('cawcaw://'),
      actualPrefix: url?.substring(0, 50),
    });
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
