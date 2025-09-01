import { StatusBar, Style } from '@capacitor/status-bar';
import { useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
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
        // Style.Dark = dark text (for light backgrounds)
        // Style.Light = light text (for dark backgrounds)
        const statusBarStyle = currentTheme === 'dark' ? Style.Light : Style.Dark;
        await StatusBar.setStyle({ style: statusBarStyle });

        console.log(`StatusBar style set to: ${statusBarStyle} for theme: ${currentTheme}`);
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
