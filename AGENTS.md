# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a cross-platform AI chat application built with React + Capacitor for iOS deployment. The app allows users to chat with AI using their own OpenAI API keys with MCP (Model Context Protocol) server integration for external tools.

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + ShadCN/UI components
- **AI Integration**: Vercel AI SDK v5.0 with direct OpenAI provider calls
- **Mobile**: Capacitor 7 for iOS deployment
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

# Open native IDEs
pnpm cap:open:ios          # Open Xcode

# Run on devices/simulators
pnpm cap:run:ios           # Build and run on iOS

# Build native apps
pnpm cap:build:ios         # Build iOS app

# Quick mobile workflows
pnpm ios                   # Build, sync, and run on iOS

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
- MCP server integration for external tools
- Handles tool call expansion/collapse UI
- Uses AI SDK v5.0's `generateText` with tool integration

**Settings.tsx**: Tabbed settings interface
- **LLM Provider Tab**: OpenAI API key management, current model display
- **Tools & MCP Tab**: MCP server configuration, quick setup options
- Real-time MCP server status monitoring
- Secure API key updates and management

**mcpManager.ts**: MCP (Model Context Protocol) integration
- Manages external tool server connections
- Secure storage of MCP server configurations
- Server status tracking and connection management

### AI SDK v5.0 Integration Notes
This project uses AI SDK v5.0 with significant architectural changes:
- Direct client-side OpenAI integration (no backend proxy)
- Uses `generateText` with tool integration for MCP functionality  
- MCP tools defined using `tool()` helper with Zod schemas
- Tool call results displayed in expandable UI components
- Status handling for streaming responses

### Mobile Architecture
- **Capacitor Config**: `capacitor.config.ts` defines app metadata (`app.cawcaw`)
- **Native Projects**: `ios/` contains platform-specific code
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
- **Testing**: Connect external MCP servers for tool functionality
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
**IMPORTANT: Commit after EVERY chunk of work. Do not accumulate uncommitted changes.**

1. **Work in chunks**: Complete one logical unit of work at a time
2. **Commit immediately**: After each chunk is complete and working, commit it right away
3. **Code quality checks**: Always run `pnpm lint` before committing
4. **Local testing**: Test with Playwright MCP locally after major UI changes
5. **Commit small**: Make focused commits with clear conventional messages
6. **Use Tailwind**: Always prefer Tailwind CSS classes over custom CSS - we have the full Tailwind v4 utility system available
7. **Example workflow**:
   ```bash
   # After completing each feature/fix chunk
   pnpm lint
   # Test with Playwright if UI changes
   git add .
   git commit -m "fix: resolve theme initialization on app startup"
   # IMMEDIATELY commit, don't wait to accumulate more changes
   ```

### Testing with Playwright MCP Tools (Ad-Hoc Testing)
**Note**: This section covers ad-hoc browser automation via Claude Code's MCP integration - different from the repository's E2E test suite.

Use Playwright MCP server for manual UI testing and verification:
- **Theme consistency**: Test light/dark mode across main chat and settings
- **Viewport behavior**: Verify safe area handling and mobile responsiveness  
- **User flows**: Test complete workflows (chat, settings, MCP configuration)
- **Available commands**: `mcp__playwright__browser_*` tools for navigation, interaction, and verification
- **Best practices**:
  - Always use `browser_snapshot` to understand page state before interactions
  - Use `browser_evaluate` to check JavaScript state (theme classes, etc.)
  - Test on both desktop and mobile viewport sizes
  - Verify console messages for errors during testing

Example Playwright MCP testing workflow:
```bash
pnpm dev &  # Start dev server in background
# Use Claude Code's mcp__playwright__browser_* tools for manual testing
# Kill dev server when done
```

**Important**: Always test on port 5173 (`http://localhost:5173`) - this is where saved API keys and preferences are stored in local storage. Other ports will require re-entering API keys.

## Playwright E2E Testing Best Practices (2025)

### Core Testing Architecture
- **Critical Test Suite**: Run `smoke.spec.ts` + `hf-mcp-server-investigation.spec.ts` for CI (fast, covers core functionality)
- **Full Test Suite**: `pnpm test` locally runs all 19 tests for comprehensive coverage
- **Mobile-First Testing**: iPhone 15 viewport (393x852) with Chrome browser for mobile compatibility
- **API Key Automation**: Tests auto-configure using `TEST_OPENAI_API_KEY` environment variable

### Playwright Selector Best Practices

#### Priority Order (2025 Recommendations)
1. **`getByRole()`** - Best choice, aligns with accessibility and user intent
2. **`getByText()`** - Good for user-facing text that doesn't change
3. **`getByPlaceholder()`** - Excellent for form inputs
4. **CSS/data-testid** - Only when semantic selectors aren't sufficient

#### Mobile-Specific Selector Issues
- **Hidden Text Problem**: Mobile UIs often use `hidden sm:inline` patterns
  - ❌ **Bad**: `text=LLM Provider` (text hidden on mobile)
  - ✅ **Good**: `getByRole('tab', { name: /LLM/i })` (works on mobile)

#### Strict Mode Violations
- **Multiple Element Issues**: When selectors match multiple elements
  - ❌ **Bad**: `getByText('OAuth Required')` (matches badge + error message)
  - ✅ **Good**: `locator('[data-slot="badge"]').getByText('OAuth Required')` (specific element)

### Common E2E Testing Patterns

#### API Key Setup Pattern
```javascript
// Handle API key setup in every test
const apiKeyInput = page.getByPlaceholder(/sk-/);
if (await apiKeyInput.isVisible()) {
  const testApiKey = process.env.TEST_OPENAI_API_KEY;
  if (testApiKey && testApiKey.startsWith('sk-')) {
    await apiKeyInput.fill(testApiKey);
    await page.getByRole('button', { name: 'Save API Key' }).click();
    await page.waitForLoadState('networkidle');
  }
}
```

#### Settings Dialog Navigation
```javascript
// Open settings using robust selector
const settingsButton = page.locator('button').filter({ has: page.locator('svg') }).first();
await settingsButton.click();
await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

// Navigate to specific tab
await page.getByRole('tab', { name: 'MCP' }).click();
```

#### MCP Server Testing Pattern
```javascript
// Add MCP server with proper form handling
await page.getByRole('button', { name: 'Add Server' }).click();
await page.getByPlaceholder('My MCP Server').fill('Test Server');
await page.getByPlaceholder('https://example.com/mcp').fill('https://hf.co/mcp');
await page.getByRole('button', { name: 'Test Connection' }).click();
```

### OAuth Flow Testing
- **Flexible URL Validation**: OAuth may redirect to HuggingFace OR return to callback
- **Callback Pattern**: Expect `/oauth/callback` with `state=` parameter as success indicator
- **Tab Handling**: Use `page.context().waitForEvent('page')` for OAuth popups

### Mobile Testing Gotchas
- **Tab Navigation**: Use `getByRole('tab')` instead of text selectors
- **Button Accessibility**: Prefer `getByRole('button', { name: /pattern/i })` over text matching
- **Viewport Verification**: Always verify mobile dimensions (393x852 for iPhone 15)
- **Touch Interactions**: Mobile Chrome handles touch events properly in Playwright

### Performance & Reliability
- **Fast Test Execution**: Critical tests run in ~25 seconds (8 tests)
- **Auto-Retry**: Playwright handles flaky elements with built-in retries
- **Wait Strategies**: Use `waitForLoadState('networkidle')` after API key setup
- **Timeout Management**: 20s timeout for individual assertions, 25min total workflow timeout

### CI/CD Integration
- **GitHub Actions**: Dedicated E2E workflow separate from iOS deployment
- **Environment Variables**: `TEST_OPENAI_API_KEY`, `TEST_HF_USERNAME`, `TEST_HF_PASSWORD`
- **Artifact Collection**: Screenshots, videos, traces uploaded on failure
- **Reporter Integration**: Use `--reporter=github` for CI-friendly output

### Common Failures & Solutions
1. **"Hidden sm:inline" Text**: Use role-based selectors instead of text
2. **Multiple Element Matches**: Add more specific parent selectors
3. **OAuth URL Changes**: Expect callback URLs, not original OAuth URLs
4. **Settings Dialog Close**: Mobile dialogs may need Escape key or specific selectors
5. **API Key Required**: Always handle API key setup at start of each test

### Example Workflow Commands
```bash
# Local development testing
pnpm dev                    # Start dev server
pnpm test                   # Run all tests (full suite)
pnpm test:dev               # Run tests with fresh dev server

# Critical test verification
pnpm test tests/e2e/smoke.spec.ts tests/e2e/hf-mcp-server-investigation.spec.ts --timeout=20000

# Individual test debugging
pnpm test --debug           # Open test in debug mode
pnpm test --headed          # Run with visible browser
```

These patterns ensure robust, fast, and reliable E2E testing that covers both desktop and mobile use cases while following 2025 accessibility-first testing best practices.