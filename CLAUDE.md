# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a cross-platform AI chat application built with React + Capacitor for iOS and Android deployment. The app allows users to chat with AI using their own OpenAI API keys with MCP (Model Context Protocol) server integration for external tools.

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + ShadCN/UI components
- **AI Integration**: Vercel AI SDK v5.0 with direct OpenAI provider calls
- **Mobile**: Capacitor 7 for iOS/Android deployment
- **Code Quality**: Biome for linting, formatting, and import organization
- **External Tools**: MCP (Model Context Protocol) for AI tool integration
- **Package Manager**: pnpm

## Development Commands

### Core Development
```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Code quality tools (Biome)
pnpm lint           # Run linting only
pnpm lint:fix       # Run linting with auto-fix
pnpm format         # Format code only
pnpm check          # Run all checks (lint + format + organize imports)

# Preview production build
pnpm preview
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

# Quick mobile workflows
pnpm ios                   # Build, sync, and run on iOS
pnpm android               # Build, sync, and run on Android

# Diagnostic commands
pnpm cap:doctor            # Check Capacitor health
pnpm cap:ls                # List installed plugins
```

## Architecture

### Client-Side Architecture
The app has been modernized to use a **single-page application architecture** with direct API calls:

1. **Frontend (React)**: Complete chat UI running on http://localhost:5174
2. **Direct OpenAI Integration**: No backend server needed - uses AI SDK v5.0 client-side calls
3. **Secure Storage**: API keys stored using Capacitor Secure Storage

This eliminates the need for a separate Express backend server while maintaining security through client-side secure storage.

### Key Components

**ChatView.tsx**: Main chat interface component
- Manages API key input/storage using Capacitor Secure Storage
- Direct integration with OpenAI via `createOpenAI({ apiKey })`
- Built-in demo tools (calculator, time, text analyzer) for testing MCP functionality
- Handles tool call expansion/collapse UI
- Uses AI SDK v5.0's `generateText` with tool integration

**Settings.tsx**: Tabbed settings interface
- **LLM Provider Tab**: OpenAI API key management, current model display
- **Tools & MCP Tab**: MCP server configuration, quick setup options
- Real-time MCP server status monitoring
- Secure API key updates and management

**mcpManager.ts**: MCP (Model Context Protocol) integration
- Manages external tool server connections
- Built-in mock tools for demo purposes
- Secure storage of MCP server configurations
- Server status tracking and connection management

### AI SDK v5.0 Integration Notes
This project uses AI SDK v5.0 with significant architectural changes:
- Direct client-side OpenAI integration (no backend proxy)
- Uses `generateText` with tool integration for MCP functionality  
- Built-in tools defined using `tool()` helper with Zod schemas
- Tool call results displayed in expandable UI components
- Status handling for streaming responses

### Mobile Architecture
- **Capacitor Config**: `capacitor.config.ts` defines app metadata (`app.cawcaw`)
- **Native Projects**: `ios/` and `android/` contain platform-specific code
- **Web Build**: `dist/` directory synced to mobile platforms
- **Secure Storage**: Uses `capacitor-secure-storage-plugin` for API keys and MCP configs
- **MCP Integration**: Works on mobile devices with proper tool integration

### MCP (Model Context Protocol) Integration
- **Purpose**: Allows AI to use external tools and services (calculators, web APIs, etc.)
- **Configuration**: Managed through Settings → Tools & MCP tab
- **Built-in Tools**: Calculator, time, text analyzer (always available for testing)
- **External Servers**: Support for HTTP and SSE transport types
- **Storage**: MCP server configs stored securely using Capacitor Secure Storage

### Styling System
- **Tailwind v4**: Uses `@tailwindcss/vite` plugin with `@import "tailwindcss"`
- **ShadCN/UI**: Pre-built components in `src/components/ui/`
- **Path Aliases**: `@/` resolves to `src/` directory
- **Theme System**: CSS variables in `src/index.css` for light/dark themes
- **Responsive Design**: Uses `h-dvh` for proper mobile viewport handling

## Code Quality & Development Workflow

### Biome Integration
This project uses **Biome** instead of ESLint/Prettier for superior performance:
- **Linting**: Strict TypeScript rules, accessibility checks, React best practices
- **Formatting**: Consistent code style (single quotes, trailing commas, etc.)
- **Import Organization**: Automatic import sorting and cleanup
- **CI/CD Integration**: GitHub Actions enforces code quality before deployment

### Biome Configuration (`biome.json`)
- **Line Width**: 100 characters
- **Quote Style**: Single quotes for JS, double quotes for JSX
- **Strict Rules**: `noExplicitAny` as warning, unused variables as errors
- **Accessibility**: Form labels, button types enforced
- **Test Overrides**: Relaxed rules for test files

### Common Code Quality Issues to Fix
When Biome reports errors, these are the most common:
1. **`noExplicitAny`**: Replace `any` types with proper TypeScript types
2. **`useButtonType`**: Add `type="button"` to button elements
3. **`noLabelWithoutControl`**: Add `htmlFor` attributes to labels
4. **`noNestedComponentDefinitions`**: Move component definitions outside parent components
5. **`noNonNullAssertion`**: Replace `!` assertions with proper null checks

## Important Development Notes

### Running the App
Use `pnpm dev` to start the development server. The app now runs entirely client-side with direct OpenAI API integration - no backend server required.

### Mobile Development Workflow
1. Make changes to React code
2. Run `pnpm build` to create production build
3. Run `pnpm cap:sync` to update mobile platforms
4. Open native IDE and run on device/simulator

### API Key Security
- API keys are user-provided and stored using Capacitor Secure Storage
- Never commit or hardcode API keys
- Keys are passed directly to OpenAI via AI SDK client-side calls
- MCP server configurations also stored securely

### MCP Development
- **Testing**: Use built-in demo tools (calculator, time, text analyzer) 
- **Adding Servers**: Use Settings → Tools & MCP → Quick Setup for common configurations
- **Custom Servers**: Support for HTTP and SSE transport protocols
- **Debugging**: MCP server status shown in real-time in Settings interface

### TypeScript Configuration
- Uses path mapping (`@/*` → `src/*`) in both tsconfig and Vite
- Separate configs for app (`tsconfig.app.json`) and Node/tooling (`tsconfig.node.json`)
- Strict mode enabled with modern ES2022 target

## Capacitor Platform Specifics

### iOS Platform
- Native project in `ios/App/`
- Requires Xcode for building
- Uses CocoaPods for dependencies
- **Bundle ID**: `app.cawcaw`
- **Fastlane**: Automated deployment configured with certificate management

### Android Platform  
- Native project in `android/`
- Uses Gradle build system
- Requires Android Studio
- **Package name**: `app.cawcaw`

### Plugin Integration
The app includes `capacitor-secure-storage-plugin` for secure API key and MCP config storage. After adding new plugins, always run `pnpm cap:sync` to update native projects.

## Important Development Notes & Lessons

### App Branding & Identity
- **App Name**: "caw caw" (lowercase)
- **Bundle ID**: `app.cawcaw` (proper reverse domain notation)
- **Domain**: cawcaw.app
- **Current AI Model**: GPT-4o Mini (fast and cost-effective as of 2025)

### ShadCN/UI Card Component Override
When using ShadCN Card components for chat bubbles, remember the built-in padding:
- Card has default `py-6` (24px vertical padding)
- CardContent has default `px-6` (24px horizontal padding)
- Override with `py-0` on Card and custom padding on CardContent for tight spacing
- Example: `<Card className="py-0">` + `<CardContent className="px-3 py-2">`

### Settings Interface Design
The Settings component uses a tabbed interface:
- **LLM Provider Tab**: API key management, model information
- **Tools & MCP Tab**: MCP server configuration, quick setup options
- Uses Radix UI Tabs component for accessibility
- Real-time status updates for MCP server connections

### iOS Viewport Handling
- Use `h-dvh` instead of `min-h-screen` to prevent input hiding issues
- Dynamic viewport height accounts for mobile browser UI changes
- Critical for proper keyboard handling on iOS devices

### GitHub Actions & CI/CD
- **Code Quality**: Biome linting enforced before deployment
- **iOS Deployment**: Automated TestFlight uploads with Fastlane
- **Certificate Management**: Uses Fastlane Match for iOS signing
- **Build Process**: Fails fast on code quality issues

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

### Commit Message Convention & Workflow
Always use conventional commit messages when making changes:
- `feat:` for new features
- `fix:` for bug fixes  
- `docs:` for documentation updates
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding/updating tests
- `chore:` for maintenance tasks
- `ci:` for CI/CD pipeline changes

Keep commit messages short and descriptive (under 50 characters for the subject line).

### Development & Testing Workflow
1. **Work in chunks**: Complete logical units of work before committing
2. **Code quality checks**: Always run `pnpm lint` before committing
3. **Local testing**: Test with Playwright MCP locally after major UI changes
4. **Commit small**: Make focused commits with clear conventional messages
5. **Use Tailwind**: Always prefer Tailwind CSS classes over custom CSS - we have the full Tailwind v4 utility system available
6. **Example workflow**:
   ```bash
   # After completing a feature/fix
   pnpm lint
   # Test with Playwright if UI changes
   git add .
   git commit -m "fix: resolve theme initialization on app startup"
   ```

### Testing with Playwright MCP
Use Playwright MCP server for automated UI testing and verification:
- **Theme consistency**: Test light/dark mode across main chat and settings
- **Viewport behavior**: Verify safe area handling and mobile responsiveness  
- **User flows**: Test complete workflows (chat, settings, MCP configuration)
- **Available commands**: `mcp__playwright__browser_*` tools for navigation, interaction, and verification
- **Best practices**:
  - Always use `browser_snapshot` to understand page state before interactions
  - Use `browser_evaluate` to check JavaScript state (theme classes, etc.)
  - Test on both desktop and mobile viewport sizes
  - Verify console messages for errors during testing

Example Playwright testing workflow:
```bash
pnpm dev &  # Start dev server in background
# Use Playwright MCP tools to test
# Kill dev server when done
```

**Important**: Always test on port 5173 (`http://localhost:5173`) - this is where saved API keys and preferences are stored in local storage. Other ports will require re-entering API keys.