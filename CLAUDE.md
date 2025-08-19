# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a cross-platform AI chat application built with React + Capacitor for iOS and Android deployment. The app allows users to chat with AI using their own OpenAI API keys.

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + ShadCN/UI components
- **AI Integration**: Vercel AI SDK v5.0 with OpenAI provider
- **Mobile**: Capacitor 7 for iOS/Android deployment  
- **Backend**: Express server for AI API proxy
- **Package Manager**: pnpm

## Development Commands

### Core Development
```bash
# Start frontend only
pnpm dev

# Start backend API server only  
pnpm dev:server

# Start both frontend and backend concurrently
pnpm dev:all

# Build for production
pnpm build

# Type checking and linting
pnpm lint
```

### Capacitor Mobile Development
```bash
# Complete mobile build workflow (build + sync)
pnpm build:mobile

# Sync commands
pnpm cap:sync              # Sync to all platforms
pnpm cap:sync:ios          # Sync to iOS only
pnpm cap:sync:android      # Sync to Android only

# Open native IDEs
pnpm cap:open:ios          # Open Xcode
pnpm cap:open:android      # Open Android Studio

# Run on devices/simulators
pnpm cap:run:ios           # Build and run on iOS
pnpm cap:run:android       # Build and run on Android

# Build native apps
pnpm cap:build:ios         # Build iOS app
pnpm cap:build:android     # Build Android app

# Diagnostic commands
pnpm cap:doctor            # Check Capacitor health
pnpm cap:ls                # List installed plugins

# Add new platforms (if needed)
pnpm exec cap add ios
pnpm exec cap add android
```

## Architecture

### Two-Part Application Architecture
The app consists of two main parts that must both run during development:

1. **Frontend (React)**: Chat UI running on http://localhost:5173
2. **Backend (Express)**: API proxy server running on http://localhost:3001

The frontend makes requests to the backend, which then proxies to OpenAI's API using the user-provided API key.

### Key Components

**ChatView.tsx**: Main chat interface component
- Manages API key input/storage flow
- Uses `useChat` hook from AI SDK v5.0 for message management
- Handles both API key setup screen and chat interface
- Stores API keys in localStorage (will use Capacitor Secure Storage on mobile)

**server.ts**: Express API server
- Single `/api/chat` endpoint that proxies to OpenAI
- Extracts API key from Authorization header
- Streams responses using AI SDK's `streamText`
- CORS enabled for local development

### AI SDK v5.0 Integration Notes
This project uses AI SDK v5.0 which has significant API changes:
- Uses `@ai-sdk/react` package for React hooks
- `useChat` no longer manages input state internally
- Messages use `parts` array instead of `content` string
- Status values: "ready", "streaming", "submitted", "error"
- Send messages via: `sendMessage({ parts: [{ type: 'text', text: input }], role: 'user' })`

### Mobile Architecture
- **Capacitor Config**: `capacitor.config.ts` defines app metadata
- **Native Projects**: `ios/` and `android/` contain platform-specific code
- **Web Build**: `dist/` directory synced to mobile platforms
- **Secure Storage**: Uses `@atroo/capacitor-secure-storage-plugin` for API key storage

### Styling System
- **Tailwind v4**: Uses `@tailwindcss/vite` plugin with `@import "tailwindcss"`
- **ShadCN/UI**: Pre-built components in `src/components/ui/`
- **Path Aliases**: `@/` resolves to `src/` directory
- **Theme System**: CSS variables in `src/index.css` for light/dark themes

## Important Development Notes

### Running the App
Always use `pnpm dev:all` during development to run both frontend and backend together. The frontend depends on the backend API server.

### AI SDK Message Format
When working with messages, remember AI SDK v5.0 uses:
```typescript
// New format
message.parts?.map(part => typeof part === 'string' ? part : (part as any).text)

// Send messages like this
sendMessage({ parts: [{ type: 'text', text: input }], role: 'user' })
```

### Mobile Development Workflow
1. Make changes to React code
2. Run `pnpm build` to create production build
3. Run `pnpm exec cap sync` to update mobile platforms
4. Open native IDE and run on device/simulator

### API Key Security
- API keys are user-provided and stored locally
- Development uses localStorage, production will use Capacitor Secure Storage
- Backend receives API key via Authorization header and proxies to OpenAI
- Never commit or hardcode API keys

### CORS and External APIs
- **Vite Dev Server**: Will encounter CORS issues with external APIs and remote MCP servers - this is expected behavior
- **Mobile Apps**: iOS and Android builds work correctly with external APIs due to Capacitor's fetch patching
- **Workarounds**: Use backend server proxy for external API calls during development, or test external APIs on mobile builds only

### TypeScript Configuration
- Uses path mapping (`@/*` → `src/*`) in both tsconfig and Vite
- Separate configs for app (`tsconfig.app.json`) and Node/tooling (`tsconfig.node.json`)
- Strict mode enabled with modern ES2022 target

## Capacitor Platform Specifics

### iOS Platform
- Native project in `ios/App/`
- Requires Xcode for building
- Uses CocoaPods for dependencies
- App ID: `com.aichat.app`

### Android Platform  
- Native project in `android/`
- Uses Gradle build system
- Requires Android Studio
- Package name: `com.aichat.app`

### Plugin Integration
The app includes `@atroo/capacitor-secure-storage-plugin` for secure API key storage. After adding new plugins, always run `pnpm exec cap sync` to update native projects.

## Important Development Notes & Lessons

### App Branding & Identity
- **App Name**: "caw caw" (lowercase)
- **Bundle ID**: `app.cawcaw` (proper reverse domain notation)
- **Domain**: cawcaw.app
- **Current AI Model**: `gpt-4.1-nano` (fastest, cheapest OpenAI model as of 2025)

### ShadCN/UI Card Component Override
When using ShadCN Card components for chat bubbles, remember the built-in padding:
- Card has default `py-6` (24px vertical padding)
- CardContent has default `px-6` (24px horizontal padding)
- Override with `py-0` on Card and custom padding on CardContent for tight spacing
- Example: `<Card className="py-0">` + `<CardContent className="px-3 py-2">`

### Android Package Structure Changes
When changing bundle identifiers:
1. Update `capacitor.config.ts` 
2. Update `android/app/build.gradle` (namespace + applicationId)
3. Move Java files to new package structure: `android/app/src/main/java/app/cawcaw/`
4. Update `android/app/src/main/res/values/strings.xml`
5. Run `./gradlew clean` in android folder before rebuilding
6. Run `pnpm cap:sync` to apply changes

### iOS Bundle Identifier Updates
- Update `ios/App/App.xcodeproj/project.pbxproj` (PRODUCT_BUNDLE_IDENTIFIER)
- Update `ios/App/App/Info.plist` (CFBundleDisplayName)
- Update `ios/fastlane/Matchfile` (app_identifier)

### Chat UI Best Practices
- Use `space-y-3` for comfortable message spacing
- Use `px-3 py-2` for balanced bubble padding
- Use `rounded-2xl` for modern bubble styling
- User messages: `bg-blue-500 text-white`
- AI messages: `bg-muted`
- Always override Card default padding with `py-0`

### Commit Message Convention
Always use conventional commit messages when making changes:
- `feat:` for new features
- `fix:` for bug fixes  
- `docs:` for documentation updates
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding/updating tests
- `chore:` for maintenance tasks

Keep commit messages short and descriptive (under 50 characters for the subject line).