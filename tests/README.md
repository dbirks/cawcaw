# Testing Setup

## MCP OAuth Flow Tests

The MCP OAuth flow tests require HuggingFace credentials to complete successfully.

### Setup Instructions

1. **Copy environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Add your test credentials** to `.env`:
   ```env
   # For MCP OAuth tests
   TEST_HF_USERNAME=your_actual_huggingface_username
   TEST_HF_PASSWORD=your_actual_huggingface_password

   # For conversation flow tests (optional)
   TEST_OPENAI_API_KEY=sk-your-actual-openai-api-key
   ```

3. **Create HuggingFace OAuth App** (if needed):
   - Go to https://huggingface.co/settings/applications
   - Create a new OAuth application
   - Set redirect URI to match your app's OAuth callback URL

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific tests
pnpm test tests/e2e/mcp-oauth-flow.spec.ts      # MCP OAuth flow
pnpm test tests/e2e/conversation-flow.spec.ts   # Conversation flow

# Run tests in headed mode (see browser)
pnpm test --headed
```

## Conversation Flow Tests

The conversation flow tests can run with or without a real OpenAI API key.

### With API Key (Full Testing)
- Complete conversation flow with real OpenAI API calls
- Verifies actual AI responses
- Tests end-to-end functionality

### Without API Key (UI Testing Only)
- Tests all UI interactions and elements
- Verifies error handling for invalid API keys
- Confirms interface works correctly

## Test Behavior

### MCP OAuth Flow Tests
- **With credentials**: Complete OAuth flow with HuggingFace
- **Without credentials**: Skip OAuth login, show helpful messages
- **OAuth errors**: Include error handling scenarios

### Conversation Flow Tests
- **With API key**: Full conversation testing with real AI responses
- **Without API key**: UI flow testing with expected API errors

### Files to Update

- **`.env`** - Add your actual test credentials (never commit this file)
- **`.env.example`** - Template file with placeholder values (safe to commit)

### Security Notes

- Never commit real credentials to the repository
- Use `.env` for actual credentials (this file is gitignored)
- The test will skip OAuth steps if credentials are not provided
