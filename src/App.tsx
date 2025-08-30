import { StatusBar, Style } from '@capacitor/status-bar';
import { useTheme } from '@/hooks/useTheme';
import { useEffect } from 'react';
import ChatView from './components/ChatView';

function App() {
  // Initialize theme on app startup
  const { currentTheme } = useTheme();

  useEffect(() => {
    // Initialize StatusBar for proper iOS safe area handling
    const setupStatusBar = async () => {
      try {
        // Enable overlay mode for full-bleed design (only needs to be done once)
        await StatusBar.setOverlaysWebView({ overlay: true });
        
        // Set style based on current theme
        const statusBarStyle = currentTheme === 'dark' ? Style.Light : Style.Dark;
        await StatusBar.setStyle({ style: statusBarStyle });
      } catch (error) {
        // StatusBar API might not be available on web/development
        console.log('StatusBar initialization skipped:', error);
      }
    };

    setupStatusBar();
  }, [currentTheme]);

  return <ChatView />;
}

export default App;
