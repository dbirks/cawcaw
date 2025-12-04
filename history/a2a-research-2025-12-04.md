# A2A (Agent-to-Agent) Protocol Research
**Date**: 2025-12-04
**Ticket**: cawcaw-dks

## Executive Summary

The A2A (Agent-to-Agent) Protocol is a Linux Foundation standard (originally from Google) that enables AI agents to communicate and collaborate. While not officially supported in Vercel AI SDK yet, there's a community implementation available and active development interest.

## 1. Vercel AI SDK A2A Support Status

### Current Status: ❌ No Official Support

- **GitHub Discussion**: [#6639](https://github.com/vercel/ai/discussions/6639) - Community requesting A2A integration similar to MCP tools
- **Tracking Issue**: #7442 - Formal issue created to track A2A integration
- **Community Provider**: ✅ Available - `a2a-ai-provider` by DracoBlue

### Community Implementation: a2a-ai-provider

**Repository**: https://github.com/DracoBlue/a2a-ai-provider
**Status**: Alpha (not production-ready)
**License**: MIT
**Compatibility**: Vercel AI SDK v5+

**Installation**:
```bash
pnpm install a2a-ai-provider
pnpm install ai
```

**Usage Example (Non-Streaming)**:
```javascript
import { a2a } from "a2a-ai-provider";
import { generateText } from "ai";

const chatId = "unique-chat-id";
const result = await generateText({
  model: a2a('https://your-a2a-server.example.com/.well-known/agent-card.json'),
  prompt: 'What is love?',
  providerOptions: {
    "a2a": { "contextId": chatId }
  },
});
```

**Usage Example (Streaming)**:
```javascript
import { a2a } from "a2a-ai-provider";
import { streamText } from "ai";

const chatId = "unique-chat-id";
const streamResult = streamText({
  model: a2a('https://your-a2a-server.example.com/.well-known/agent-card.json'),
  prompt: 'What is love?',
  providerOptions: {
    "a2a": { "contextId": chatId }
  },
});

await streamResult.consumeStream();
console.log(await streamResult.content);
```

**Key Requirements**:
- Must provide `contextId` in provider options for conversation tracking
- Agent endpoint must serve agent card at `/.well-known/agent-card.json`

## 2. A2A Protocol Overview

### What is A2A?

**Definition**: Open standard for seamless communication and collaboration between AI agents
**Maintainer**: Linux Foundation (originally developed by Google)
**Specification**: https://a2a-protocol.org/latest/

### Core Capabilities

1. **Agent Discovery**: Agents advertise capabilities via "Agent Card" (JSON)
   - Located at `/.well-known/agent.json` on each domain
   - Contains agent metadata, capabilities, skills, and connection info
   - **Current Limitation**: One agent per domain

2. **Task Management**: Oriented towards task completion
   - Defined task lifecycle (create, update, complete)
   - Can complete immediately or over time
   - JSON-RPC 2.0 API for communication

3. **Security**: OpenAPI-aligned security schemes
   - API keys
   - OAuth 2.0
   - OpenID Connect Discovery

4. **Interoperability**: Framework-agnostic
   - Works with LangGraph, CrewAI, Semantic Kernel
   - Agents don't share internal memory, tools, or logic
   - Universal, decentralized standard

### A2A vs MCP (Complementary Protocols)

| Feature | A2A | MCP |
|---------|-----|-----|
| **Purpose** | Agent-to-Agent communication | Agent-to-Tools communication |
| **Developed By** | Google (now Linux Foundation) | Anthropic |
| **Use Case** | Multi-agent collaboration | Tool/service integration |
| **Relationship** | Complementary - operate at different layers |

**Note**: OpenAI and Anthropic both support MCP but were noticeably absent from A2A announcement partners.

## 3. Public A2A Servers for Testing

### 🔧 A2A Inspector (Recommended)

**Purpose**: Web-based tool to test any A2A agent
**Features**:
- Examine agent capabilities
- Send test messages
- View agent responses
- **Repository**: https://github.com/a2aproject/a2a-inspector

### 📚 Google Codelabs Demo

**URL**: https://codelabs.developers.google.com/intro-a2a-purchasing-concierge
**Scenario**: Purchasing concierge communicating with food seller agents

**Demo Agents**:
1. **Burger Seller Agent**
   - Framework: CrewAI
   - Deployed on: Cloud Run
   - Agent Card: `https://burger-agent-xxxxxxxxx.us-central1.run.app/.well-known/agent.json`

2. **Pizza Seller Agent**
   - Framework: LangGraph
   - Deployed on: Cloud Run
   - Agent Card: `https://pizza-agent-xxxxxxxxx.us-central1.run.app/.well-known/agent.json`

**How to Test**:
1. Navigate to `{agent-url}/.well-known/agent.json` in browser
2. View agent card with capabilities
3. Send messages via A2A client using provided SDK
4. Interact through Gradio UI in tutorial

### 📦 A2A Samples Repository

**Repository**: https://github.com/a2aproject/a2a-samples
**License**: Apache-2.0
**Contents**:
- Code samples and demos
- Local demo setup instructions
- Extension examples
- Jupyter notebooks

**Related Tools**:
- [A2A Specification](https://github.com/a2aproject/A2A) - Protocol docs
- [a2a-python](https://github.com/a2aproject/a2a-python) - Python SDK
- [a2a-inspector](https://github.com/a2aproject/a2a-inspector) - UI inspection tool

### 🏠 Local Demo (agent2agent.info)

**Documentation**: https://agent2agent.info/docs/demo/
**Requirements**:
- Python 3.12+
- UV package manager
- Google API key

**Setup**:
```bash
cd demo
echo "GOOGLE_API_KEY=your-key" > .env
uv run main.py
```

**Access**: http://localhost:12000

## 4. Implementation Considerations for caw caw

### Pros ✅

1. **Community Provider Available**: `a2a-ai-provider` works with AI SDK v5
2. **Familiar API**: Uses same `generateText`/`streamText` pattern as existing providers
3. **Complementary to MCP**: We already support MCP, A2A would enable agent-to-agent scenarios
4. **Framework Agnostic**: Works with any A2A-compliant agent
5. **Security Built-in**: OAuth, API keys supported

### Cons / Challenges ❌

1. **Alpha Status**: `a2a-ai-provider` not production-ready
2. **No Official Support**: Not officially supported by Vercel AI SDK team
3. **Limited Adoption**: OpenAI/Anthropic not announced as partners
4. **One Agent Per Domain**: Current protocol limitation
5. **Additional Complexity**: New provider type, agent discovery, context management

### Technical Integration Path

**Option 1: Use Community Provider (Recommended for Testing)**
```typescript
// Install
// pnpm install a2a-ai-provider

// Usage in ChatView.tsx
import { a2a } from "a2a-ai-provider";
import { generateText } from "ai";

const conversationId = currentConversation.id;
const result = await generateText({
  model: a2a(agentCardUrl), // e.g., 'https://example.com/.well-known/agent-card.json'
  messages,
  providerOptions: {
    a2a: { contextId: conversationId }
  },
});
```

**Option 2: Wait for Official Support**
- Monitor GitHub issue #7442
- Wait for Vercel AI SDK to add native A2A support
- More stable, better integration

**Option 3: Custom Implementation**
- Implement A2A JSON-RPC 2.0 client directly
- More control but significant development effort
- Would need to handle agent discovery, task lifecycle, security

### UI/UX Considerations

1. **Provider Selection**: Add "A2A Agent" to provider dropdown in Settings
2. **Agent Configuration**:
   - Input field for agent card URL
   - Auto-discovery of agent capabilities
   - Display agent metadata (name, skills, etc.)
3. **Conversation Context**: Ensure `contextId` passed for conversation continuity
4. **Error Handling**: Handle agent unavailability, discovery failures
5. **Security**: Store agent URLs in Capacitor Secure Storage

### Storage Schema Extension

```typescript
// Add to Capacitor Secure Storage keys
interface A2AConfig {
  enabled: boolean;
  agentCardUrl: string;
  agentMetadata?: {
    name: string;
    description: string;
    capabilities: string[];
  };
}

// Storage key: 'a2a_config'
```

## 5. Recommendations

### Short-term (Testing & Validation)
1. ✅ **Install and test `a2a-ai-provider`** locally
2. ✅ **Test with Google Codelabs demo agents** (burger/pizza sellers)
3. ✅ **Use A2A Inspector** to understand agent discovery
4. ✅ **Create prototype branch** with basic A2A integration

### Medium-term (Implementation)
1. **Monitor official support**: Track Vercel AI SDK issue #7442
2. **Add A2A provider option** to Settings → LLM Provider tab
3. **Implement agent discovery UI** for agent card URLs
4. **Test with multiple A2A agents** (LangGraph, CrewAI, etc.)

### Long-term (Production)
1. **Wait for stable release** of either:
   - Official Vercel AI SDK support, OR
   - `a2a-ai-provider` exits alpha status
2. **Build agent marketplace** (optional): Curated list of A2A agents
3. **Multi-agent workflows** (advanced): Coordinate multiple agents for complex tasks

## 6. Key Resources

### Documentation
- A2A Protocol: https://a2a-protocol.org/latest/
- A2A Specification: https://github.com/a2aproject/A2A
- Google Developer Blog: https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/

### SDKs & Tools
- Python SDK: https://github.com/a2aproject/a2a-python
- Community AI SDK Provider: https://github.com/DracoBlue/a2a-ai-provider
- A2A Inspector: https://github.com/a2aproject/a2a-inspector
- Samples: https://github.com/a2aproject/a2a-samples

### Testing Resources
- Google Codelabs: https://codelabs.developers.google.com/intro-a2a-purchasing-concierge
- Demo App: https://agent2agent.info/docs/demo/
- Awesome A2A List: https://github.com/pab1it0/awesome-a2a

### Vercel AI SDK
- Discussion: https://github.com/vercel/ai/discussions/6639
- Tracking Issue: #7442

## 7. Security Considerations

⚠️ **Important**: When building production applications with A2A:
- Treat external agents as potentially untrusted entities
- Validate all external agent data
- Sanitize inputs before processing
- Implement rate limiting
- Use secure communication (HTTPS, authentication)
- Review agent capabilities before granting access

## Conclusion

A2A is a promising protocol for multi-agent collaboration, but it's still early days:
- ✅ **Feasible**: Community provider exists and works with AI SDK v5
- ⚠️ **Alpha Status**: Not production-ready yet
- 🔬 **Recommended Next Step**: Build proof-of-concept with Google Codelabs demo agents
- ⏳ **Production Timeline**: Wait for stable release or official Vercel support

The protocol complements our existing MCP integration well - MCP gives agents tools, A2A lets agents talk to each other.
