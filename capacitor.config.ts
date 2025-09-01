import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.cawcaw',
  appName: 'caw caw',
  webDir: 'dist',
  assets: {
    iconPath: 'ios-icon.png'
  },
  ios: {
    preferredContentMode: 'mobile',
    contentInset: 'never' // Let CSS handle safe areas to avoid double padding
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true
    },
    StatusBar: {
      overlaysWebView: true, // Enable immersive mode for modern blurred status bar
      backgroundColor: '#00000000' // Transparent background for blur effect
    },
    Keyboard: {
      resize: 'native' // 'none' | 'body' | 'native' - prevents scroll issues
    }
  }
};

export default config;
