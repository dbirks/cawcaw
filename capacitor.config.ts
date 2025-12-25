import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.cawcaw',
  appName: 'caw caw',
  webDir: 'dist',
  server: {
    iosScheme: 'cawcaw', // Configure iOS custom scheme for OAuth redirects
  },
  assets: {
    iconPath: 'ios-icon.png'
  },
  ios: {
    preferredContentMode: 'mobile',
    contentInset: 'never', // Let CSS handle safe areas to avoid double padding
    scheme: 'cawcaw' // Register custom URL scheme for OAuth redirects
  },
	plugins: {
		SplashScreen: {
			launchAutoHide: true,
		},
		StatusBar: {
			overlaysWebView: true, // Enable immersive mode for modern blurred status bar
			backgroundColor: '#00000000', // Transparent background for blur effect
		},
		Keyboard: {
			resize: 'native', // 'none' | 'body' | 'native' - prevents scroll issues
		},
		CapacitorHttp: {
			enabled: true, // Enable native HTTP to bypass CORS on mobile
		},
		App: {
			handleContentUrlSchemes: ['cawcaw'], // Handle custom URL scheme redirects
		},
		SentryCapacitor: {
			dsn: process.env.VITE_SENTRY_DSN,
			environment: process.env.NODE_ENV || 'development',
			release: `caw-caw@${process.env.npm_package_version || '0.1.4'}`,
			attachStacktrace: true,
			attachThreads: true,
			enableNativeCrashHandling: true,
		},
	}
};

export default config;
