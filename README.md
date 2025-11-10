# cawcaw

A cross-platform AI chat client that works with OpenAI and Anthropic APIs. Runs as a web app or native iOS app using your own API keys. Supports the Model Context Protocol (MCP) for connecting AI models to external tools.

## Overview

This is a client-side application—no backend server required. API calls go directly from your device to OpenAI or Anthropic. API keys are stored locally using platform-specific secure storage.

The app is built with React and Capacitor 7, which means it runs in a browser or as a native iOS app from the same codebase. Android support is possible but not currently implemented.

## What it does

- Chat with GPT-4, GPT-4o, o3-mini, and Claude models
- Voice input using Whisper or GPT-4o transcription
- Persistent conversation history stored locally (SQLite on mobile, IndexedDB in browser)
- Connect AI to external tools via MCP servers (documentation search, weather data, code analysis, etc.)
- System-aware dark/light themes

## Installation

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173` and enter your OpenAI API key to start. Anthropic API key is optional.

## Development commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm preview          # Preview production build

# Code quality
pnpm check            # Lint, format, organize imports (Biome)
pnpm test             # E2E tests (Playwright)

# Mobile
pnpm build:mobile     # Build and sync to iOS
pnpm cap:open:ios     # Open Xcode
pnpm cap:run:ios      # Run on iOS device/simulator
```

## Model Context Protocol (MCP)

MCP lets AI models call external tools and access data sources. This app can connect to MCP servers over HTTP/SSE.

To add a server:
1. Settings → Tools & MCP
2. Add Server → enter name, URL, transport type
3. Test connection and enable

See [awesome-remote-mcp-servers](https://github.com/jaw9c/awesome-remote-mcp-servers) for public servers.

The app includes a hybrid HTTP client that bypasses CORS on iOS using Capacitor's native HTTP. Web builds use standard fetch with CORS restrictions.

## Project structure

```
cawcaw/
├── src/
│   ├── components/           # React components
│   │   ├── ChatView.tsx      # Main chat UI
│   │   ├── Settings.tsx      # Settings dialog
│   │   ├── Sidebar.tsx       # Conversation list
│   │   └── ui/               # ShadCN components
│   ├── services/
│   │   ├── mcpManager.ts     # MCP client
│   │   ├── chatDb.ts         # SQLite connection
│   │   └── conversationStorage.ts  # Chat persistence API
│   └── hooks/                # React hooks
├── ios/                      # iOS native project
├── tests/e2e/               # Playwright tests
└── .github/workflows/       # CI/CD
```

## Architecture notes

**Frontend**: React 19, TypeScript, Vite
**Styling**: Tailwind CSS v4, ShadCN/UI
**AI SDK**: Vercel AI SDK v5.0 with OpenAI and Anthropic providers
**Mobile**: Capacitor 7
**Storage**: SQLite (iOS/Android) with Write-Ahead Logging, IndexedDB fallback for web
**Testing**: Playwright for E2E
**Code quality**: Biome for linting/formatting

**Key decisions**:
- Client-only architecture means no server to run or maintain
- API keys stored via Capacitor Secure Storage Plugin (iOS Keychain on iOS)
- Conversation data stored in SQLite on mobile with WAL mode enabled
- MCP integration uses standard HTTP/SSE transport
- Uses Capacitor's native HTTP on mobile to bypass CORS restrictions

## Storage implementation

The app uses different storage mechanisms depending on platform:

**iOS/Android**: SQLite via `@capacitor-community/sqlite` v7.0.2
- WAL mode enabled for better concurrent access
- Stored in Application Support directory (iOS) / internal storage (Android)
- Schema: `conversations` and `messages` tables with foreign key constraints
- Auto-checkpoint on app backgrounding

**Web**: IndexedDB fallback (not yet implemented)

Storage layer is abstracted through `conversationStorage.ts` so the UI doesn't need to know which backend is in use.

## License

MIT License - see LICENSE file.
