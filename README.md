# AI Chat App

A cross-platform AI chat application built with React + Capacitor for iOS and Android. Users can chat with AI using their own OpenAI API keys.

## Features

- 💬 Real-time AI chat interface
- 🔐 Secure API key storage
- 📱 Native iOS and Android apps
- 🎨 Modern UI with Tailwind CSS + ShadCN/UI
- ⚡ Built with Vite + TypeScript

## Development Setup

### Prerequisites

- Node.js (latest LTS)
- pnpm package manager
- For iOS development: macOS with Xcode
- For Android development: Android Studio

### Getting Started

```bash
# Install dependencies
pnpm install

# Start development (both frontend and backend)
pnpm dev:all

# Or start individually
pnpm dev:server    # Backend API server (port 3001)
pnpm dev           # Frontend React app (port 5173)
```

### Available Scripts

#### Core Development
- `pnpm dev:all` - Start both frontend and backend
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint
- `pnpm preview` - Preview production build

#### Mobile Development
- `pnpm build:mobile` - Build web assets and sync to mobile platforms
- `pnpm cap:sync` - Sync web assets to all platforms
- `pnpm cap:open:ios` - Open Xcode
- `pnpm cap:open:android` - Open Android Studio
- `pnpm cap:run:ios` - Run on iOS simulator/device
- `pnpm cap:run:android` - Run on Android emulator/device

## Deployment

### iOS App Store & TestFlight

#### Prerequisites
- Apple Developer Account ($99/year)
- macOS with Xcode installed
- Valid signing certificates and provisioning profiles

#### Steps

1. **Prepare App in App Store Connect**
   ```bash
   # Visit https://appstoreconnect.apple.com
   # Create new app with Bundle ID: com.aichat.app
   ```

2. **Build Production Version**
   ```bash
   pnpm build:mobile
   ```

3. **Configure Signing in Xcode**
   ```bash
   pnpm cap:open:ios
   ```
   - Select your development team
   - Set Bundle Identifier to `com.aichat.app`
   - Configure signing certificates

4. **Create Archive & Upload**
   - In Xcode: Product → Archive
   - Use Organizer to distribute to App Store Connect
   - Upload for TestFlight/App Store review

5. **TestFlight Setup**
   - Go to App Store Connect → TestFlight tab
   - Add test information and beta app description
   - Invite internal testers (up to 100)
   - For external testing (up to 10,000), submit for beta review

#### Automated iOS Deployment with TestFlight

**🚀 Fully automated iOS deployment is now configured!**

The app includes a complete GitHub Actions workflow that builds, signs, and uploads to TestFlight automatically. No Mac required - everything runs on GitHub's macOS runners.

**Quick Setup:**
1. **Join Apple Developer Program** ($99/year)
2. **Run setup script**: `./scripts/setup-ios-deployment.sh`
3. **Configure GitHub secrets** (detailed in iOS-DEPLOYMENT.md)
4. **Push to main branch** - automatic TestFlight upload!

**📖 For complete setup instructions, see: [iOS-DEPLOYMENT.md](./iOS-DEPLOYMENT.md)**

**Features:**
- ✅ Headless macOS builds via GitHub Actions
- ✅ Certificate management with Fastlane Match
- ✅ Automatic TestFlight uploads
- ✅ No local Mac or Xcode required
- ✅ Professional signing and distribution
- ✅ Works entirely from Linux development environment

**Cost:** $99/year (Apple) + ~$5-15/month (GitHub Actions)

### Android Play Store

#### Prerequisites
- Google Play Developer Account ($25 one-time fee)
- Android Studio installed

#### Steps

1. **Prepare App in Google Play Console**
   ```bash
   # Visit https://play.google.com/console
   # Create new app with package name: com.aichat.app
   ```

2. **Build Production Version**
   ```bash
   pnpm build:mobile
   ```

3. **Generate Signed APK/AAB**
   ```bash
   pnpm cap:open:android
   ```
   - Create upload keystore
   - Configure signing in `android/app/build.gradle`
   - Build → Generate Signed Bundle/APK

4. **Upload to Play Console**
   - Go to Play Console → Production
   - Upload your AAB file
   - Complete store listing information
   - Submit for review

### Environment Variables

The app uses user-provided API keys, so no environment variables are needed for the core functionality. For CI/CD, you may need:

- iOS: Apple Developer certificates and profiles
- Android: Keystore files and passwords

## Architecture

### Frontend (React)
- Built with Vite + TypeScript
- Styled with Tailwind CSS v4 + ShadCN/UI
- AI integration via Vercel AI SDK v5.0
- Runs on http://localhost:5173

### Backend (Express)
- API proxy server for OpenAI requests
- Handles user API key authorization
- Streaming responses
- Runs on http://localhost:3001

### Mobile (Capacitor)
- iOS project in `ios/App/`
- Android project in `android/`
- Secure storage for API keys
- Bundle ID: `com.aichat.app`

## Security

- API keys are user-provided and stored locally
- Uses Capacitor Secure Storage on mobile devices
- No hardcoded secrets in the codebase
- Backend proxies requests to OpenAI API

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm lint` and `pnpm build`
5. Submit a pull request

## Support

For issues and questions:
- Check the [Capacitor Documentation](https://capacitorjs.com/docs)
- Review [Apple's App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Consult [Google Play Policy](https://support.google.com/googleplay/android-developer/answer/9859348)

## License

MIT License - see LICENSE file for details.