# GitHub Copilot Instructions for caw caw

**Note**: This project uses [bd (beads)](https://github.com/steveyegge/beads) for issue tracking. Use `bd` commands instead of markdown TODOs. See AGENTS.md for workflow details.

## Project Overview

This is a cross-platform AI chat application built with React + Capacitor for iOS deployment. The app allows users to chat with AI using their own OpenAI and Anthropic API keys with MCP (Model Context Protocol) server integration for external tools.

## Tech Stack

- **Language**: TypeScript
- **Frontend**: React 19 + Vite
- **Styling**: Tailwind CSS v4 + ShadCN/UI components
- **AI Integration**: Vercel AI SDK v5.0
- **Mobile**: Capacitor 7 for iOS
- **Code Quality**: Biome for linting/formatting
- **Package Manager**: pnpm

## Coding Guidelines

### Code Quality
- Run `pnpm check && pnpm build` before committing
- Use Biome for linting and formatting
- Follow conventional commit messages (capitalize first word after prefix)
- Commit after EVERY chunk of work

### Testing
- E2E tests use Playwright with mobile-first approach (iPhone 15 viewport)
- Critical tests: `smoke.spec.ts` + `hf-mcp-server-investigation.spec.ts`
- Use role-based selectors: `getByRole()` > `getByText()` > CSS selectors

### Git Workflow
- Push by default after committing
- Watch GitHub Actions until TestFlight deployment completes
- Always commit `.beads/issues.jsonl` with code changes

## Issue Tracking with bd

**CRITICAL**: This project uses **bd** for ALL task tracking. Do NOT create markdown TODO lists.

### Essential Commands

```bash
# Find work
bd ready --json

# Create and manage
bd create "Title" -t bug|feature|task -p 0-4 --json
bd update <id> --status in_progress --json
bd close <id> --reason "Done" --json
```

### Workflow

1. **Check ready work**: `bd ready --json`
2. **Claim task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** `bd create "Found bug" -p 1 --deps discovered-from:<parent-id> --json`
5. **Complete**: `bd close <id> --reason "Done" --json`

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

## Project Structure

```
cawcaw/
├── src/
│   ├── components/      # React components
│   │   ├── ChatView.tsx # Main chat interface
│   │   ├── Settings.tsx # Tabbed settings
│   │   └── ui/          # ShadCN components
│   ├── services/        # Business logic
│   │   ├── mcpManager.ts
│   │   └── conversationStorage.ts
│   └── utils/           # Utilities
├── ios/                 # iOS native project
├── tests/e2e/          # Playwright tests
└── .beads/
    └── issues.jsonl    # Issue tracking (DO COMMIT)
```

## CLI Help

Run `bd <command> --help` to see all available flags for any command.

## Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Commit after every chunk of work
- ✅ Run `pnpm check && pnpm build` before committing
- ✅ Use Tailwind CSS classes over custom CSS
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT accumulate uncommitted changes

---

**For detailed workflows and advanced features, see [AGENTS.md](../AGENTS.md)**
