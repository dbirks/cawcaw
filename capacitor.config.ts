import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.cawcaw',
  appName: 'caw caw',
  webDir: 'dist',
  ios: {
    preferredContentMode: 'mobile',
    contentInset: 'automatic'
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true
    }
  }
};

export default config;
