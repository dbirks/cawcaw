# Web Search Tool Integration Research
**Date**: December 24, 2025
**BD Issue**: cawcaw-wst
**Status**: Research Complete

## Executive Summary

This document provides a comprehensive analysis of web search integration options for the caw caw AI chat application. After researching available TypeScript/JavaScript libraries, APIs, and integration patterns, I've identified multiple viable approaches with varying trade-offs based on cost, complexity, and client-side constraints.

**Recommended Approach**: Use an MCP (Model Context Protocol) web search server with the existing MCP integration architecture already implemented in the app.

---

## Table of Contents

1. [Background & Context](#background--context)
2. [Research Findings](#research-findings)
3. [Available Options](#available-options)
4. [Recommended Solution](#recommended-solution)
5. [Implementation Plan](#implementation-plan)
6. [Alternatives Considered](#alternatives-considered)
7. [Security & Privacy Considerations](#security--privacy-considerations)
8. [References](#references)

---

## Background & Context

### Current Architecture

The caw caw app is a client-side React application that:
- Runs entirely in the browser (web) and as a mobile app (iOS via Capacitor)
- Uses Vercel AI SDK v5.0 for AI provider integration (OpenAI and Anthropic)
- Already has MCP (Model Context Protocol) support for external tools
- Stores API keys securely using Capacitor Secure Storage
- No backend server - all API calls are made directly from the client

### Existing Tool System

The app currently integrates tools through the MCP system:
- **mcpManager.ts** handles MCP server connections
- Tools are converted to AI SDK format using `tool()` helper with Zod schemas
- Built-in tools mentioned: calculator, time, text analyzer
- External MCP servers can be added via Settings → Tools & MCP tab
- HTTP/SSE transport supported for MCP servers
- OAuth 2.1 support for authenticated MCP servers

### Key Constraint

**Client-side execution**: Any web search solution must work from the browser/mobile app without requiring a custom backend server. This creates CORS (Cross-Origin Resource Sharing) challenges for direct API calls to most search services.

---

## Research Findings

### 1. TypeScript/JavaScript Web Search Libraries

#### DuckDuckGo Libraries

**[@pikisoft/duckduckgo-search](https://www.npmjs.com/package/@pikisoft/duckduckgo-search)**
- Full TypeScript support with type definitions
- Modern async/await Promise-based API
- Supports web, image, video, and news search
- **Limitation**: Designed for Node.js server-side usage

**[ddgs (EudaLabs)](https://github.com/EudaLabs/ddgs)**
- Node.js library for DuckDuckGo search functionality
- Advanced request handling to prevent rate limiting
- Extensive test coverage
- **Limitation**: Node.js only, not browser-compatible

**[DuckDuckJS](https://github.com/RajDave-Dev/DuckDuckJS)**
- AI chat and search for text using DuckDuckGo.com
- JavaScript/TypeScript support
- **Limitation**: Server-side only

**[duck-duck-scrape](https://github.com/Snazzah/duck-duck-scrape)**
- Most popular option (50 npm dependents)
- Utilizes DuckDuckGo's spice APIs
- Supports stocks, weather, currency conversion
- **Limitation**: Node.js-based web scraping

**Key Insight**: All DuckDuckGo libraries are designed for Node.js server-side usage and will encounter CORS issues when used directly from browser clients.

#### CORS Challenge

Per [MDN CORS documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), browsers enforce same-origin policy restrictions. Most search APIs do not enable CORS headers for browser requests, requiring either:
1. A backend proxy server (conflicts with our client-side architecture)
2. A CORS proxy service (security/reliability concerns)
3. Alternative approaches (MCP servers, provider-native search)

### 2. Commercial Search APIs

#### SerpAPI

**[serpapi](https://www.npmjs.com/package/serpapi)** - [Official library](https://serpapi.com/integrations/javascript)
- Written in TypeScript with comprehensive test suite
- Supports Node.js 7.10.1+ and Deno
- ES Module (ESM) and CommonJS support
- Scrapes multiple search engines (Google, Bing, DuckDuckGo, etc.)
- **Pricing**: Paid service (starts at $50/month for 5,000 searches)
- **Limitation**: CORS-restricted, requires API key, requires backend proxy for client-side usage

**Pros**:
- Reliable, well-maintained official library
- Comprehensive search engine support
- Good documentation

**Cons**:
- Monthly subscription cost ($50+ for meaningful usage)
- Requires backend proxy for client-side use
- API key management complexity

### 3. Vercel AI SDK Native Options

#### OpenAI Search Models

**[gpt-4o-search-preview](https://platform.openai.com/docs/models/gpt-4o-search-preview)** and **[gpt-4o-mini-search-preview](https://platform.openai.com/docs/models/gpt-4o-mini-search-preview)**

- Native web search capability built into OpenAI models
- Already available in the caw caw app (see `AVAILABLE_MODELS` in ChatView.tsx)
- Large context window (128,000 tokens)
- Global localization support via `user_location` parameter
- Structured JSON outputs

**Pricing**: Standard token fees + per-tool-call web search fee

**Integration**: Would work immediately with existing AI SDK integration - no additional libraries needed.

**Current Status**: Already implemented in the app UI, just needs to be tested/documented.

#### Exa AI Search Tool

**[Exa AI](https://docs.exa.ai/reference/vercel)** - Vercel AI SDK integration
- Adds web search tool to LLMs in a few lines of code
- Works directly with AI SDK by Vercel
- Advanced filtering: domain, date ranges, content types, locations
- **Limitation**: Requires API key, paid service

### 4. MCP Web Search Servers

#### Existing MCP Web Search Implementations

**[web-search-mcp](https://github.com/mrkrsl/web-search-mcp)**
- Simple, locally hosted MCP server for web search
- Designed for use with local LLMs
- TypeScript-based

**[WebSearch-MCP](https://mcpservers.org/servers/mnhlt/WebSearch-MCP)**
- Listed in Awesome MCP Servers directory
- Provides web search capability over stdio transport
- Integrates with WebSearch Crawler API

**[Multi-engine MCP Web Search Server](https://medium.com/@gabrimatic/introducing-mcp-web-search-tool-bridging-ai-assistants-to-real-time-web-information-5df9ab92ad02)**
- Comprehensive web search using multiple engines
- Prioritizes Bing, Brave, and DuckDuckGo
- No API keys required for basic functionality
- Multiple tools for different use cases

**Key Advantage**: Leverages existing MCP infrastructure already built into caw caw app.

### 5. MCP Ecosystem Context

**Industry Adoption (2025)**:
- December 2025: Anthropic donated MCP to Agentic AI Foundation (Linux Foundation)
- Co-founded by Anthropic, Block, OpenAI
- Support from Google, Microsoft, AWS, Cloudflare, Bloomberg
- [One Year of MCP announcement](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)

**OpenAI Integration (March 2025)**:
- Official MCP adoption across OpenAI products
- ChatGPT desktop app support
- OpenAI Agents SDK integration
- Responses API compatibility

**Google Support (April 2025)**:
- Confirmed MCP support in upcoming Gemini models
- Infrastructure integration planned

**Security Note**: April 2025 research identified security concerns with MCP including prompt injection and tool permission issues. Implementation should follow security best practices.

---

## Available Options

### Option 1: MCP Web Search Server (RECOMMENDED)

**Approach**: Deploy/use an existing MCP web search server and connect it via the app's existing MCP integration.

**Pros**:
- ✅ Leverages existing MCP infrastructure (mcpManager.ts already built)
- ✅ No new client-side code architecture needed
- ✅ User can choose to self-host or use hosted MCP server
- ✅ No CORS issues (MCP server acts as backend proxy)
- ✅ Multiple search engine support possible
- ✅ Aligned with industry standards (OpenAI, Anthropic, Google adoption)
- ✅ Can be free if self-hosted or using free MCP services

**Cons**:
- ⚠️ Requires user to set up MCP server (unless we provide a default hosted one)
- ⚠️ Depends on external service availability
- ⚠️ Security considerations (prompt injection, tool permissions)

**Implementation Complexity**: Low (reuses existing MCP system)

**Cost**: Free (self-hosted) or variable (hosted service)

### Option 2: OpenAI Search Models

**Approach**: Use gpt-4o-search-preview or gpt-4o-mini-search-preview models that have native web search.

**Pros**:
- ✅ Already implemented in the app (models listed in AVAILABLE_MODELS)
- ✅ Zero additional code needed
- ✅ No external dependencies
- ✅ Works seamlessly with existing chat flow
- ✅ Best UX (transparent to user)

**Cons**:
- ⚠️ Only works with OpenAI, not Anthropic
- ⚠️ Per-tool-call search fee (on top of token costs)
- ⚠️ Limited control over search behavior
- ⚠️ Model-dependent (requires specific model selection)

**Implementation Complexity**: None (already done)

**Cost**: OpenAI token costs + per-search-call fees

### Option 3: SerpAPI with Backend Proxy

**Approach**: Build a simple backend proxy service to handle SerpAPI requests and bypass CORS.

**Pros**:
- ✅ Reliable commercial API
- ✅ Multiple search engines supported
- ✅ Good documentation and TypeScript support

**Cons**:
- ❌ Requires building/deploying backend service (conflicts with client-side architecture)
- ❌ Monthly subscription cost ($50+)
- ❌ Infrastructure management overhead
- ❌ API key security concerns

**Implementation Complexity**: High (requires backend development)

**Cost**: $50+/month subscription + hosting costs

### Option 4: Custom DuckDuckGo Client Library

**Approach**: Create a browser-compatible DuckDuckGo scraper using client-side HTTP requests.

**Pros**:
- ✅ No API costs
- ✅ No external dependencies

**Cons**:
- ❌ CORS will block direct requests to DuckDuckGo
- ❌ Would require CORS proxy (unreliable)
- ❌ Violates DuckDuckGo Terms of Service
- ❌ Fragile (breaks if DuckDuckGo changes HTML structure)
- ❌ Not intended for commercial use

**Implementation Complexity**: High (with low reliability)

**Cost**: Free (but likely won't work)

---

## Recommended Solution

### Primary Recommendation: MCP Web Search Server

**Why this is the best option**:

1. **Architectural Alignment**: The app already has comprehensive MCP support built in (mcpManager.ts, OAuth flow, settings UI, tool integration with AI SDK). Adding web search as an MCP tool requires minimal new code.

2. **User Choice**: Users can:
   - Self-host a free MCP web search server
   - Use a hosted MCP service (free or paid)
   - Configure their own preferred search backend

3. **Zero Client-Side Changes**: The existing tool system in ChatView.tsx automatically converts MCP tools to AI SDK format and executes them. No modifications needed.

4. **Industry Standard**: With MCP adoption by OpenAI (March 2025), Google (April 2025), and donation to Linux Foundation (December 2025), MCP is becoming the de facto standard for AI tool integration.

5. **Security**: MCP server acts as a backend proxy, solving CORS issues while keeping the client simple.

### Secondary Recommendation: Document OpenAI Search Models

The app already supports `gpt-4o-search-preview` and `gpt-4o-mini-search-preview` models (see lines 71-72 in ChatView.tsx). These models have native web search capability.

**Action**: Simply document this feature for users and ensure it's tested.

**Use Case**: For users who want zero-configuration web search and are already using OpenAI.

---

## Implementation Plan

### Phase 1: MCP Web Search Server Integration (Primary)

#### Step 1: Research & Select MCP Server Implementation

**Options to evaluate**:

1. **[mrkrsl/web-search-mcp](https://github.com/mrkrsl/web-search-mcp)**
   - TypeScript-based
   - Designed for local hosting
   - Simple setup

2. **Multi-engine MCP server** (mentioned in [Medium article](https://medium.com/@gabrimatic/introducing-mcp-web-search-tool-bridging-ai-assistants-to-real-time-web-information-5df9ab92ad02))
   - Supports Bing, Brave, DuckDuckGo
   - No API keys for basic usage
   - Multiple search tools

3. **Custom implementation**
   - Build our own using @modelcontextprotocol/sdk
   - Integrate duck-duck-scrape or similar library
   - Full control over functionality

**Recommendation**: Start with option #2 (multi-engine server) if available, fallback to #1 for quick testing, consider #3 for production deployment.

#### Step 2: Set Up Development Environment

1. Clone/install chosen MCP server
2. Configure local testing environment
3. Test MCP server with stdio or HTTP transport
4. Verify search functionality with various queries

#### Step 3: Create Quick Setup Guide

Add to Settings → Tools & MCP → Quick Setup:

```typescript
// Example quick setup entry
{
  name: "Web Search (DuckDuckGo)",
  description: "Add web search capability using DuckDuckGo",
  url: "https://example.com/mcp-web-search", // or local URL
  transportType: "http-streamable",
  requiresAuth: false,
}
```

#### Step 4: Documentation

Create user documentation:
- How to enable web search MCP server
- Self-hosting instructions (optional)
- Example queries that benefit from web search
- Privacy/security considerations

#### Step 5: Testing

Test scenarios:
- "What's the current price of Bitcoin?"
- "Who won the Super Bowl this year?"
- "What are the top news stories today?"
- "Search for React 19 documentation"

Verify:
- Tool calls appear in message UI
- Search results are properly formatted
- Error handling works correctly
- MCP server connection status updates

### Phase 2: Document OpenAI Search Models (Secondary)

#### Step 1: Verify Functionality

1. Select `gpt-4o-search-preview` or `gpt-4o-mini-search-preview` model
2. Test queries requiring web search
3. Verify search tool calls appear in UI
4. Document pricing implications

#### Step 2: Update Documentation

1. Add section to user guide explaining search-enabled models
2. Note the per-search-call pricing
3. Provide examples of when web search is beneficial
4. Compare with MCP approach (cost, features, limitations)

### Phase 3: Advanced Features (Future)

1. **Search Result Caching**: Cache recent search results to reduce API calls
2. **Search Domain Filtering**: Allow users to restrict/prioritize certain domains
3. **Search Result Customization**: Format search results with custom templates
4. **Multiple Search Backends**: Support switching between DuckDuckGo, Brave, Bing
5. **Privacy Mode**: Option to use privacy-focused search engines only

---

## Alternatives Considered

### Why NOT SerpAPI?

- **Cost**: $50/month minimum for 5,000 searches is expensive for individual users
- **Backend Requirement**: Requires deploying a proxy service (conflicts with client-side architecture)
- **Complexity**: Adds infrastructure management overhead

**When to reconsider**: If building a commercial hosted version of caw caw with backend infrastructure, SerpAPI becomes viable.

### Why NOT Direct DuckDuckGo Scraping?

- **CORS**: Browser same-origin policy blocks direct requests
- **Terms of Service**: DuckDuckGo doesn't provide official API; scraping violates ToS
- **Reliability**: HTML scraping breaks easily when site structure changes
- **Legal/Ethical**: Not intended for commercial or automated use

**When to reconsider**: Never. Use MCP approach or official APIs.

### Why NOT Custom Backend?

- **Architecture Conflict**: App is designed to run client-side only
- **Deployment Overhead**: Requires hosting, monitoring, scaling backend service
- **Maintenance Burden**: Additional codebase to maintain
- **Cost**: Server hosting fees

**When to reconsider**: If pivoting to a traditional client-server architecture.

### Why NOT Exa AI?

- **Cost**: Requires paid subscription
- **Single Provider**: Locked into one search service
- **API Key Management**: Additional key to secure and manage

**When to reconsider**: If Exa offers superior search quality worth the cost, or if integrating as an optional premium feature.

---

## Security & Privacy Considerations

### MCP Security Issues (April 2025)

Security researchers identified several MCP vulnerabilities:

1. **Prompt Injection**: Malicious search results could inject prompts
2. **Tool Permission Issues**: Combining tools could exfiltrate data
3. **Lookalike Tools**: Fake tools could replace trusted ones

**Mitigations**:
- Only allow MCP servers from trusted sources
- Display MCP server details in settings UI
- Require explicit user action to enable MCP servers
- Sandbox MCP tool execution (if possible)
- Monitor for suspicious tool behavior

### Search Privacy

**User Considerations**:
- Search queries reveal user interests/activities
- Self-hosted MCP servers provide maximum privacy
- Hosted MCP services may log search queries
- OpenAI search models send queries to OpenAI

**Recommendations**:
- Document privacy implications of each option
- Allow users to choose their search backend
- Support self-hosted MCP servers for privacy-conscious users
- Consider adding privacy mode (no query logging)

### API Key Security

**Current Implementation** (per CLAUDE.md):
- API keys stored using Capacitor Secure Storage
- Never committed or hardcoded
- Passed directly to providers via AI SDK

**For MCP Servers**:
- MCP server URLs stored in secure storage
- OAuth tokens managed by mcpOAuthManager
- No API keys needed for free search services

---

## References

### DuckDuckGo Libraries
- [ddgs (EudaLabs)](https://github.com/EudaLabs/ddgs)
- [DuckDuckJS](https://github.com/RajDave-Dev/DuckDuckJS)
- [duck-duck-scrape](https://github.com/Snazzah/duck-duck-scrape)
- [@pikisoft/duckduckgo-search](https://www.npmjs.com/package/@pikisoft/duckduckgo-search)

### SerpAPI
- [SerpApi JavaScript/TypeScript Library](https://serpapi.com/blog/announcing-our-new-library-for-javascript-and-typescript/)
- [SerpApi Integration Docs](https://serpapi.com/integrations/javascript)
- [serpapi npm package](https://www.npmjs.com/package/serpapi)
- [GitHub: serpapi-javascript](https://github.com/serpapi/serpapi-javascript)

### Vercel AI SDK
- [AI SDK by Vercel](https://ai-sdk.dev/docs/introduction)
- [Exa AI SDK Integration](https://docs.exa.ai/reference/vercel)
- [Node: Web Search Agent](https://ai-sdk.dev/cookbook/node/web-search-agent)

### OpenAI Search Models
- [GPT-4o Search Preview Model](https://platform.openai.com/docs/models/gpt-4o-search-preview)
- [GPT-4o mini Search Preview Model](https://platform.openai.com/docs/models/gpt-4o-mini-search-preview)
- [OpenAI Web Search (Medium)](https://cobusgreyling.medium.com/openai-web-search-5376e9a2d6d8)

### MCP Resources
- [web-search-mcp (GitHub)](https://github.com/mrkrsl/web-search-mcp)
- [Model Context Protocol Servers](https://github.com/modelcontextprotocol/servers)
- [MCP One Year Anniversary](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)
- [WebSearch-MCP (Awesome MCP Servers)](https://mcpservers.org/servers/mnhlt/WebSearch-MCP)
- [Introducing MCP Web Search Tool (Medium)](https://medium.com/@gabrimatic/introducing-mcp-web-search-tool-bridging-ai-assistants-to-real-time-web-information-5df9ab92ad02)
- [Top 10 Best MCP Servers 2025](https://cyberpress.org/best-mcp-servers/)

### CORS Resources
- [Cross-Origin Resource Sharing (CORS) - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [What is CORS? - AWS](https://aws.amazon.com/what-is/cross-origin-resource-sharing/)

---

## Next Steps

1. **Review this research** with the team/user
2. **Select MCP server implementation** for testing
3. **Set up development environment** for MCP web search
4. **Test integration** with existing MCP system
5. **Create PR** with MCP quick setup configuration
6. **Document** OpenAI search models as alternative
7. **Update user documentation** with web search capabilities

---

**Document Status**: Research Complete
**Created**: December 24, 2025
**Last Updated**: December 24, 2025
**Author**: Claude (AI Assistant)
**BD Issue**: cawcaw-wst
