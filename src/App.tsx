import { useEffect, useState } from 'react';
import ChatView from './components/ChatView';
import { mcpManager } from './services/mcpManager';

function App() {
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);

  useEffect(() => {
    // Check if this is an OAuth callback URL
    const urlParams = new URLSearchParams(window.location.search);

    if (window.location.pathname === '/oauth/callback') {
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      console.log('Web OAuth callback detected:', { code: !!code, state: !!state, error });

      if (error) {
        const errorDescription = urlParams.get('error_description');
        console.error('OAuth error:', error, errorDescription);
        alert(`❌ OAuth error: ${errorDescription || error}`);
        // Redirect back to main app
        window.location.href = '/';
        return;
      }

      if (code && state) {
        setIsProcessingOAuth(true);

        // Parse the state to get server ID
        try {
          const stateData = JSON.parse(atob(state));
          const serverId = stateData.serverId;

          console.log('Processing OAuth callback for server:', serverId);

          // Complete the OAuth flow
          mcpManager
            .completeOAuthFlow(serverId, code, state)
            .then(() => {
              console.log('✅ OAuth flow completed successfully');
              alert('✅ OAuth authentication successful! MCP server is now connected.');
              // Redirect back to main app
              window.location.href = '/';
            })
            .catch((error) => {
              console.error('❌ Failed to complete OAuth flow:', error);
              alert(`❌ OAuth authentication failed: ${error.message || 'Unknown error'}`);
              // Redirect back to main app anyway
              window.location.href = '/';
            });
        } catch (error) {
          console.error('❌ Failed to parse OAuth state:', error);
          alert('❌ Invalid OAuth callback - state parameter invalid');
          window.location.href = '/';
        }

        return;
      }
    }
  }, []);

  // Show loading screen during OAuth processing
  if (isProcessingOAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Completing OAuth Authentication</h2>
          <p className="text-muted-foreground">Please wait while we connect your MCP server...</p>
        </div>
      </div>
    );
  }

  return <ChatView />;
}

export default App;
