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
- **Commit frequently**: After every logical chunk of work
- **Code quality**: Run `pnpm check` before committing
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

### Testing Best Practices
- **Use `getByRole()`**: Primary selector for accessibility
- **Mobile selectors**: Account for `hidden sm:inline` patterns
- **Strict mode**: Use `exact: true` when multiple elements match
- **API key automation**: Tests use `TEST_OPENAI_API_KEY` env var

For complete documentation, see [agents.md](./agents.md).
