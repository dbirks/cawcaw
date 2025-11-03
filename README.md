# caw caw

A modern, cross-platform AI chat application built with React and Capacitor. Chat with OpenAI's GPT models and Anthropic's Claude using your own API keys, with support for the Model Context Protocol (MCP) to connect AI to external tools and services.

## Features

- 💬 **Multi-Provider AI Chat** - Support for both OpenAI (GPT-4, GPT-4o, o3) and Anthropic (Claude) models
- 🎤 **Voice Input** - Speech-to-text with multiple transcription models (Whisper, GPT-4o transcribe)
- 🔐 **Secure Storage** - API keys stored locally using secure platform storage
- 📱 **Native Mobile Apps** - iOS with Android support via Capacitor 7
- 🔧 **MCP Integration** - Connect AI to external tools via Model Context Protocol
- 🎨 **Modern UI** - Built with React 19, Tailwind CSS v4, and ShadCN/UI components
- ⚡ **Fast & Lightweight** - Built with Vite and TypeScript for optimal performance
- 🌓 **Dark Mode** - System-aware theme with light/dark mode support

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [pnpm](https://pnpm.io/) package manager
- For iOS: macOS with [Xcode](https://developer.apple.com/xcode/)

### Installation

```bash
# Clone the repository
git clone https://github.com/dbirks/cawcaw.git
cd cawcaw

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at `http://localhost:5173`

### First Run Setup

1. Open the app in your browser
2. Enter your OpenAI API key (get one from [OpenAI Platform](https://platform.openai.com/api-keys))
3. Optionally add your Anthropic API key for Claude models
4. Start chatting!

Your API keys are stored securely on your device and never sent to any third-party servers besides OpenAI/Anthropic.

## Development

### Available Commands

```bash
# Development
pnpm dev              # Start dev server (port 5173)
pnpm build            # Build for production
pnpm preview          # Preview production build

# Code Quality
pnpm lint             # Run linting
pnpm lint:fix         # Fix linting issues
pnpm format           # Format code
pnpm check            # Run all quality checks

# Testing
pnpm test             # Run E2E tests with Playwright
pnpm test:dev         # Run tests with fresh dev server
```

### Mobile Development

```bash
# Build and sync to mobile platforms
pnpm build:mobile     # Build web assets and sync

# iOS Development
pnpm cap:sync:ios     # Sync to iOS
pnpm cap:open:ios     # Open in Xcode
pnpm cap:run:ios      # Build and run on iOS device/simulator

# Diagnostics
pnpm cap:doctor       # Check Capacitor setup
pnpm cap:ls           # List installed plugins
```

## Model Context Protocol (MCP)

This app supports the [Model Context Protocol](https://modelcontextprotocol.io), allowing AI models to access external tools and data sources.

### What is MCP?

MCP enables AI assistants to:
- Search documentation and APIs
- Access financial data
- Check domain availability
- Run code analysis tools
- And much more...

### Adding MCP Servers

1. Open **Settings** → **Tools & MCP** tab
2. Click **Add Server**
3. Enter server details (name, URL, transport type)
4. Click **Test Connection** to verify
5. Enable the server to make tools available to AI

For a curated list of public MCP servers, see: [awesome-remote-mcp-servers](https://github.com/jaw9c/awesome-remote-mcp-servers)

### CORS on Mobile

The app includes a hybrid HTTP client that automatically bypasses CORS restrictions on native mobile platforms using Capacitor's native HTTP capabilities. This means all public MCP servers work perfectly in iOS/Android apps, while gracefully falling back to standard browser behavior on web.

## Project Structure

```
cawcaw/
├── src/
│   ├── components/      # React components
│   │   ├── ChatView.tsx       # Main chat interface
│   │   ├── Settings.tsx       # Settings dialog
│   │   ├── Sidebar.tsx        # Conversation sidebar
│   │   ├── ui/                # ShadCN UI components
│   │   └── icons/             # Icon components
│   ├── services/        # Business logic
│   │   ├── mcpManager.ts      # MCP server management
│   │   └── conversationStorage.ts  # Chat history
│   └── utils/           # Utility functions
├── ios/                 # iOS native project
├── tests/e2e/          # Playwright E2E tests
└── public/             # Static assets
```

## Architecture

### Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + ShadCN/UI
- **AI Integration**: Vercel AI SDK v5.0 (OpenAI & Anthropic providers)
- **Mobile**: Capacitor 7
- **Code Quality**: Biome (linting, formatting, imports)
- **Testing**: Playwright (E2E)

### Key Design Decisions

- **Client-side architecture**: No backend server needed - API calls go directly from the app to AI providers
- **Secure storage**: API keys stored using Capacitor Secure Storage Plugin
- **Mobile-first**: Designed for iOS with responsive web support
- **Accessibility**: ARIA labels, keyboard navigation, semantic HTML
- **Tool integration**: MCP protocol for extensibility

## Deployment

### iOS App Store / TestFlight

This project includes automated iOS deployment via GitHub Actions and Fastlane. See [iOS-DEPLOYMENT.md](./iOS-DEPLOYMENT.md) for complete setup instructions.

**Quick overview:**
1. Join Apple Developer Program ($99/year)
2. Run setup script: `./scripts/setup-ios-deployment.sh`
3. Configure GitHub secrets (see iOS-DEPLOYMENT.md)
4. Push to main branch → automatic TestFlight upload!

No Mac required for CI/CD - everything runs on GitHub's macOS runners.

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository** on GitHub
2. **Create a feature branch**: `git checkout -b feature/my-new-feature`
3. **Make your changes**:
   - Write clear, focused commits
   - Follow the existing code style
   - Add tests for new features
   - Update documentation as needed
4. **Run quality checks**: `pnpm check` and `pnpm test`
5. **Commit your changes**: Use [conventional commits](https://www.conventionalcommits.org/)
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `test:` for tests
   - `refactor:` for refactoring
6. **Push to your fork**: `git push origin feature/my-new-feature`
7. **Open a Pull Request** with a clear description of your changes

### Development Guidelines

- **Code Style**: We use Biome for linting and formatting. Run `pnpm check` before committing.
- **TypeScript**: Maintain strict type safety. Avoid `any` types.
- **Testing**: Add E2E tests for new user-facing features.
- **Accessibility**: Ensure all interactive elements have proper ARIA labels.
- **Mobile**: Test on iOS (physical device or simulator) for UI changes.
- **Commit Often**: Make small, focused commits with clear messages.

### Areas for Contribution

- 🐛 Bug fixes and performance improvements
- ✨ New AI provider integrations
- 🔧 Additional MCP server implementations
- 📱 Android platform support
- 🧪 Test coverage improvements
- 📖 Documentation enhancements
- 🎨 UI/UX improvements
- ♿ Accessibility improvements

### Getting Help

- 📝 Open an [issue](https://github.com/dbirks/cawcaw/issues) for bugs or feature requests
- 💬 Start a [discussion](https://github.com/dbirks/cawcaw/discussions) for questions
- 📖 Check existing issues and PRs before creating new ones

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Acknowledgments

- [Vercel AI SDK](https://sdk.vercel.ai/) for AI integration
- [Capacitor](https://capacitorjs.com/) for cross-platform mobile development
- [ShadCN/UI](https://ui.shadcn.com/) for beautiful UI components
- [Model Context Protocol](https://modelcontextprotocol.io/) for tool integration
- [Tailwind CSS](https://tailwindcss.com/) for styling

---

**Built with ❤️ by the caw caw team**
