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
      overlaysWebView: true, // Enable immersive mode for modern blurred status bar
      style: 'default', // Will auto-adapt based on content
      backgroundColor: '#00000000' // Transparent background for blur effect
    },
    Keyboard: {
      resize: 'native' // 'none' | 'body' | 'native' - prevents scroll issues
    }
  }
};

export default config;
