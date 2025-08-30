import { StatusBar, Style } from '@capacitor/status-bar';
import { useTheme } from '@/hooks/useTheme';
import { useEffect } from 'react';
import ChatView from './components/ChatView';

function App() {
  // Initialize theme on app startup
  const { currentTheme } = useTheme();

  useEffect(() => {
    // Initialize StatusBar for proper iOS safe area handling
    const initializeStatusBar = async () => {
      try {
        // Enable overlay mode for full-bleed design
        await StatusBar.setOverlaysWebView({ overlay: true });
        
        // Set initial style based on theme
        const statusBarStyle = currentTheme === 'dark' ? Style.Light : Style.Dark;
        await StatusBar.setStyle({ style: statusBarStyle });
      } catch (error) {
        // StatusBar API might not be available on web/development
        console.log('StatusBar initialization skipped:', error);
      }
    };

    initializeStatusBar();
  }, []);

  // Update status bar style when theme changes
  useEffect(() => {
    const updateStatusBarStyle = async () => {
      try {
        const statusBarStyle = currentTheme === 'dark' ? Style.Light : Style.Dark;
        await StatusBar.setStyle({ style: statusBarStyle });
      } catch (error) {
        // StatusBar API might not be available on web/development
        console.log('StatusBar style update skipped:', error);
      }
    };

    updateStatusBarStyle();
  }, [currentTheme]);

  return <ChatView />;
}

export default App;
