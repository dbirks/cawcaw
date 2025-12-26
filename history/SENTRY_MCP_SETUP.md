# Sentry MCP Server Setup for Claude Code

**Date**: 2025-12-26
**Purpose**: Integration of Sentry's official MCP server with Claude Code for error monitoring and tracking

## Overview

Sentry provides an **official MCP server** with two integration options:
1. **Remote Hosted Server** (Recommended) - Managed by Sentry at `https://mcp.sentry.dev/mcp`
2. **Local STDIO Mode** - Self-hosted using npm package `@sentry/mcp-server`

## Recommended Approach: Remote Hosted Server

### Prerequisites
- Claude Code CLI installed
- Sentry account with organization access
- OAuth authentication (handled automatically during setup)

### Installation Command

```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

This command will:
1. Add the Sentry MCP server to your Claude Code configuration
2. Prompt for OAuth authentication with Sentry
3. Configure the connection automatically

### Authentication Flow
- Uses OAuth 2.1 for secure authentication
- Required scopes: `org:read`, `project:read`, `project:write`, `team:read`, `team:write`, `event:write`
- No manual token management needed

### Advantages of Remote Hosted
- ✅ Always up-to-date (Sentry manages the server)
- ✅ No local installation or npm dependencies
- ✅ Lower friction setup
- ✅ OAuth-based authentication
- ✅ Handles 30+ million requests/month (proven scalability)

## Alternative: Local STDIO Mode

### Installation

```bash
npx @sentry/mcp-server@latest --access-token=YOUR_SENTRY_USER_TOKEN
```

For self-hosted Sentry deployments:
```bash
npx @sentry/mcp-server@latest --access-token=YOUR_SENTRY_USER_TOKEN --host=sentry.example.com
```

### Configuration File Location

**Linux**: `~/.config/Claude/claude_desktop_config.json`

### Configuration Format

```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": [
        "@sentry/mcp-server@latest",
        "--access-token",
        "YOUR_SENTRY_USER_TOKEN"
      ]
    }
  }
}
```

For self-hosted deployments:
```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": [
        "@sentry/mcp-server@latest",
        "--access-token",
        "YOUR_SENTRY_USER_TOKEN",
        "--host",
        "sentry.example.com"
      ]
    }
  }
}
```

### Creating a Sentry User Auth Token

1. Navigate to Sentry → Settings → Auth Tokens
2. Create a new User Auth Token
3. Grant the following scopes:
   - `org:read`
   - `project:read`
   - `project:write`
   - `team:read`
   - `team:write`
   - `event:write`
4. Copy the token and use it in the configuration

## Sentry MCP Server Features

The Sentry MCP server provides **16+ tool calls and prompts** including:

### Error Monitoring
- Retrieve and analyze error issues
- Get issue context and stack traces
- Access error patterns and trends

### Issue Management
- Create and update issues
- Assign issues to team members
- Add comments and tags

### Performance Monitoring
- Query performance metrics
- Analyze slow transactions
- Identify performance bottlenecks

### Seer AI Integration
- Trigger Seer Analysis for automatic fix recommendations
- Get AI-powered insights into error causes
- Receive suggested solutions

## Organization Configuration

For the **birks** organization on Sentry:

### Environment Variables (STDIO Mode)
```bash
export SENTRY_ORG="birks"
export SENTRY_AUTH_TOKEN="your-token-here"
```

### Configuration with Environment Variables
```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": [
        "@sentry/mcp-server@latest",
        "--access-token",
        "${SENTRY_AUTH_TOKEN}"
      ],
      "env": {
        "SENTRY_ORG": "birks"
      }
    }
  }
}
```

## Testing the Configuration

### Remote Hosted Server
After running the installation command, Claude Code will automatically:
1. Add the server to your configuration
2. Initiate OAuth flow
3. Test the connection
4. Display available tools

### STDIO Mode
1. Restart Claude Code after editing the configuration
2. Check for Sentry MCP server in the available tools list
3. Test basic functionality (e.g., list projects, retrieve issues)

## Verification Steps

1. **Check MCP Server Status**:
   - Open Claude Code
   - Look for Sentry in the MCP servers list
   - Verify connection status is "Connected"

2. **Test Basic Tool Calls**:
   - List Sentry projects
   - Retrieve recent issues
   - Query error patterns

3. **Verify OAuth**:
   - Confirm authentication was successful
   - Check that organization access is granted
   - Verify correct scopes are enabled

## Troubleshooting

### Common Issues

1. **OAuth Authentication Failed**:
   - Ensure you're logged into Sentry in your browser
   - Check that the organization "birks" exists and you have access
   - Verify network connectivity to `https://mcp.sentry.dev`

2. **STDIO Mode Token Issues**:
   - Verify the auth token has all required scopes
   - Check that the token hasn't expired
   - Confirm the token belongs to the correct organization

3. **Server Not Appearing**:
   - Restart Claude Code after configuration changes
   - Check configuration file syntax (valid JSON)
   - Review Claude Code logs for errors

## Performance & Scalability

Sentry's hosted MCP server:
- Handles **30+ million requests per month** (as of August 2025)
- Provides automatic monitoring of MCP server connections
- Collects information about resource access and tool executions
- Tracks errors across the entire MCP pipeline

## Recent Updates (2025)

- **August 2025**: Sentry launched MCP Server Monitoring tools
- **MCP 1.0**: Claude Code gained native support for remote hosted MCP servers
- **Hosted Server**: Sentry now manages the remote MCP server infrastructure

## Next Steps

1. **Install using the remote hosted option** (recommended):
   ```bash
   claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
   ```

2. **Authenticate with OAuth** when prompted

3. **Test the integration** by querying Sentry data through Claude Code

4. **Explore available tools** and capabilities

## References

- [Sentry MCP Server Documentation](https://docs.sentry.io/product/sentry-mcp/)
- [Sentry MCP STDIO GitHub](https://github.com/getsentry/sentry-mcp-stdio)
- [NPM Package: @sentry/mcp-server](https://www.npmjs.com/package/@sentry/mcp-server)
- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp)
- [Sentry MCP Server Press Release](https://sentry.io/about/press-releases/sentry-launches-monitoring-tool-for-mcp-servers%20/)

## Summary

✅ **Sentry has an official MCP server**
✅ **Remote hosted option is recommended** (easier setup, always updated)
✅ **OAuth authentication** (no manual token management)
✅ **16+ tools available** (error monitoring, issue management, Seer AI)
✅ **Proven scalability** (30M+ requests/month)
✅ **Simple installation** via `claude mcp add` command

**Installation Command**:
```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

This setup will enable Claude Code to interact with your Sentry organization ("birks") for error monitoring, issue tracking, and AI-powered debugging assistance.
