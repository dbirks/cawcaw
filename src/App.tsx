import { useEffect, useState } from 'react';
import ChatView from './components/ChatView';
import { conversationStorage } from './services/conversationStorage';
import { mcpManager } from './services/mcpManager';

function App() {
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initialConversationId, setInitialConversationId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

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
              // Redirect back to main app - server status will show connection state
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

    // Initialize conversation storage before rendering the app
    const initializeApp = async () => {
      try {
        console.log('[App] Initializing conversation storage...');
        await conversationStorage.initialize();
        console.log('[App] Conversation storage initialized');

        // Get or create initial conversation
        const currentConversation = await conversationStorage.getCurrentConversation();
        console.log('[App] Current conversation:', currentConversation);

        if (currentConversation) {
          setInitialConversationId(currentConversation.id);
          console.log('[App] Set initial conversation ID:', currentConversation.id);
        } else {
          throw new Error('Failed to get or create initial conversation');
        }
      } catch (error) {
        console.error('[App] Initialization error:', error);
        setInitError(error instanceof Error ? error.message : 'Failed to initialize app');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
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

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Initializing</h2>
          <p className="text-muted-foreground">Setting up your workspace...</p>
        </div>
      </div>
    );
  }

  // Show error screen if initialization failed
  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2 text-destructive">Initialization Failed</h2>
          <p className="text-muted-foreground mb-4">{initError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Only render ChatView once we have a valid conversation ID
  if (!initialConversationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No conversation available</p>
        </div>
      </div>
    );
  }

  return <ChatView initialConversationId={initialConversationId} />;
}

export default App;
