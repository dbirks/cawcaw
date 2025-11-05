# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**For detailed development notes, architecture details, and best practices, see [agents.md](./agents.md).**

## Quick Reference

### Development Commands
```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm check            # Run all code quality checks
pnpm test             # Run E2E tests
```

### Mobile Development
```bash
pnpm build:mobile     # Build and sync to mobile platforms
pnpm cap:open:ios     # Open in Xcode
pnpm cap:run:ios      # Run on iOS device/simulator
```

### Important Notes
- **Update CLAUDE.md**: Always document technical changes and architecture updates here
- **Commit frequently**: After every logical chunk of work
- **Code quality**: Run `pnpm check` AND `pnpm build` before committing to catch TypeScript errors
- **Use Biome**: For linting, formatting, and import organization
- **Tailwind CSS**: Always prefer Tailwind classes over custom CSS
- **Mobile-first**: Test on iOS for UI changes (uses `h-dvh` for viewport)
- **Conventional commits**: Use `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`

### Key Architecture Points
- **Client-side only**: No backend server - direct API calls to OpenAI/Anthropic
- **Secure storage**: API keys stored via Capacitor Secure Storage
- **Multi-provider**: Supports both OpenAI and Anthropic models
- **MCP integration**: External tools via Model Context Protocol
- **AI SDK v5.0**: Uses `generateText` with tool integration
- **SQLite with WAL**: Persistent conversation storage with Write-Ahead Logging

#### SQLite Storage Architecture
- **Database**: `@capacitor-community/sqlite` v7.0.2 with WAL mode enabled
- **iOS**: Stored in Application Support (included in iCloud Backup)
- **Android**: Internal app storage (~25MB Auto Backup cap)
- **Schema**: `conversations` + `messages` with foreign key cascade
- **Checkpointing**: Auto on app backgrounding via `@capacitor/app` listener
- **Service files**:
  - `src/services/chatDb.ts` - Core SQLite connection and DAO layer
  - `src/services/conversationStorage.ts` - Public API wrapping SQLite
  - `src/hooks/useChatDb.ts` - React hook for lifecycle management
- **Important**: No migration from pre-SQLite data (fresh start)
- **Best practice**: Use `conversationStorage` API, not direct DB access

**Critical SQLite Implementation Details** (fixes applied 2025-11-05):
- **Connection Management**: MUST use `checkConnectionsConsistency()` + `isConnection()` before `createConnection()` to prevent "connection already exists" errors on app reload
- **PRAGMA Methods**: ALL PRAGMA statements MUST use `execute()` (not `query()`) per official API docs
- **PRAGMA Ordering**: MUST execute ALL PRAGMAs BEFORE any transactions to prevent "safety level may not be changed inside a transaction" error
- **Migrations**: DDL statements (CREATE TABLE, CREATE INDEX) are atomic and do NOT need explicit BEGIN/COMMIT wrapper
- **Connection Retrieval**: Use `retrieveConnection()` for existing connections instead of creating duplicate connections

### Testing Best Practices
- **Use `getByRole()`**: Primary selector for accessibility
- **Mobile selectors**: Account for `hidden sm:inline` patterns
- **Strict mode**: Use `exact: true` when multiple elements match
- **API key automation**: Tests use `TEST_OPENAI_API_KEY` env var

For complete documentation, see [agents.md](./agents.md).
