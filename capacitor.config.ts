import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.cawcaw',
  appName: 'caw caw',
  webDir: 'dist',
  ios: {
    preferredContentMode: 'mobile',
    contentInset: 'always' // Auto-adjust scroll view insets for safe area
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true
    },
    StatusBar: {
      overlaysWebView: false, // false = classic gap below status bar, true = immersive
      style: 'default' // 'default' | 'light' | 'dark'
    },
    Keyboard: {
      resize: 'native' // 'none' | 'body' | 'native' - prevents scroll issues
    }
  }
};

export default config;
