import { useEffect } from 'react';
import ChatView from './components/ChatView';
import { oauthRedirectHandler } from './services/oauthRedirectHandler';

function App() {
  useEffect(() => {
    // Initialize OAuth redirect handler when app starts
    oauthRedirectHandler.initialize().catch((error) => {
      console.error('Failed to initialize OAuth redirect handler:', error);
    });

    // Cleanup on unmount
    return () => {
      oauthRedirectHandler.cleanup().catch((error) => {
        console.error('Failed to cleanup OAuth redirect handler:', error);
      });
    };
  }, []);

  return <ChatView />;
}

export default App;
