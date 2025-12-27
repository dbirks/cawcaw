import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { generateText, stepCountIs, tool, experimental_transcribe as transcribe } from 'ai';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { ArrowUpIcon, Cpu, MicIcon, PencilIcon, Plus, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
// AI Elements imports
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from '@/components/ai-elements/prompt-input';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning'; // For reasoning models like o1 and o3-mini
import { Response } from '@/components/ai-elements/response';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { AnthropicIcon } from '@/components/icons/AnthropicIcon';
import { McpIcon } from '@/components/icons/McpIcon';
import { OpenAIIcon } from '@/components/icons/OpenAIIcon';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LoadingMessage } from '@/components/ui/bouncing-dots';
// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LiveAudioVisualizer } from '@/components/ui/LiveAudioVisualizer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { acpManager } from '@/services/acpManager';
import {
  type Conversation as ConversationData,
  conversationStorage,
  type Message as StoredMessage,
} from '@/services/conversationStorage';
import { debugLogger } from '@/services/debugLogger';
import { getLocalAICapability } from '@/services/localAICapabilities';
import { localAIService } from '@/services/localAIService';
import { mcpManager } from '@/services/mcpManager';
import type {
  ACPMessage,
  ACPPermissionKind,
  ACPPermissionRequest,
  ACPPlan,
  ACPServerConfig,
  ACPToolCall,
} from '@/types/acp';
import type { MCPServerConfig, MCPServerStatus } from '@/types/mcp';
import { isModelCached } from '@/utils/modelCacheManager';
import { LocalAIProgressCard } from './LocalAIProgressCard';
import Settings from './Settings';
import Sidebar, { SidebarToggle } from './Sidebar';

// Available AI models (both OpenAI and Anthropic)
const AVAILABLE_MODELS = [
  // OpenAI Models
  { value: 'gpt-4o', label: 'gpt-4o', provider: 'openai' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini', provider: 'openai' },
  { value: 'gpt-4.1', label: 'gpt-4.1', provider: 'openai' },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini', provider: 'openai' },
  { value: 'o4-mini', label: 'o4-mini', provider: 'openai' },
  { value: 'o3', label: 'o3', provider: 'openai' },
  { value: 'o3-mini', label: 'o3-mini', provider: 'openai' },
  { value: 'gpt-4o-search-preview', label: 'gpt-4o (Web Search)', provider: 'openai' },
  { value: 'gpt-4o-mini-search-preview', label: 'gpt-4o-mini (Web Search)', provider: 'openai' },
  { value: 'gpt-5', label: 'gpt-5', provider: 'openai' },
  { value: 'gpt-5-mini', label: 'gpt-5-mini', provider: 'openai' },
  { value: 'gpt-5-nano', label: 'gpt-5-nano', provider: 'openai' },

  // Anthropic Models - Claude 4.5 Series
  {
    value: 'claude-sonnet-4-5-20250929',
    label: 'Claude Sonnet 4.5',
    provider: 'anthropic',
  },
  {
    value: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    provider: 'anthropic',
  },

  // Anthropic Models - Claude 4 Series
  {
    value: 'claude-opus-4-1-20250805',
    label: 'Claude Opus 4.1',
    provider: 'anthropic',
  },
  {
    value: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    provider: 'anthropic',
  },

  // Local Models
  {
    value: 'gemma-3-270m-local',
    label: 'Gemma 3 270M (Local)',
    provider: 'local',
  },
] as const;

// Updated interfaces for AI Elements compatibility
interface MessagePart {
  type: 'text' | string; // string to allow for 'tool-*' types
  text?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  state?: 'input-available' | 'input-streaming' | 'output-available' | 'output-error';
  errorText?: string;
}

interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  timestamp?: number;
  provider?: 'openai' | 'anthropic' | 'acp' | 'local'; // Track which provider generated this message

  // ACP-specific fields
  acpToolCalls?: ACPToolCall[];
  acpPlan?: ACPPlan;
  acpSessionId?: string;
}

export default function ChatView({ initialConversationId }: { initialConversationId: string }) {
  // Existing state
  const [apiKey, setApiKey] = useState<string>('');
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>('');
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(true);
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>(initialConversationId);
  const [conversationTitle, setConversationTitle] = useState<string>('New Chat');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [editedTitle, setEditedTitle] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'anthropic' | 'local'>(
    'openai'
  );
  const [isLocalAIAvailable, setIsLocalAIAvailable] = useState<boolean>(false);

  // Local AI state
  const [localAIProgress, setLocalAIProgress] = useState<{
    progress: number;
    stage: string;
    downloadSpeed?: string;
    modelName?: string;
    modelSize?: string;
  } | null>(null);
  const [_streamingLocalText, setStreamingLocalText] = useState<string>('');

  // New state for AI Elements features
  const [availableServers, setAvailableServers] = useState<MCPServerConfig[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Map<string, MCPServerStatus>>(new Map());
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4-5-20250929');
  const [sttModel, setSttModel] = useState<string>('gpt-4o-mini-transcribe');
  const [status, setStatus] = useState<'ready' | 'submitted' | 'streaming' | 'error'>('ready');
  const [mcpPopoverOpen, setMcpPopoverOpen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [currentRecording, setCurrentRecording] = useState<{
    mediaRecorder: MediaRecorder;
    stream: MediaStream;
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false); // Track initialization completion

  // ACP state
  const [chatMode, setChatMode] = useState<'chat' | 'acp'>('chat');
  const [acpServers, setAcpServers] = useState<ACPServerConfig[]>([]);
  const [selectedAcpServer, setSelectedAcpServer] = useState<string | null>(null);
  const [currentAcpSessionId, setCurrentAcpSessionId] = useState<string | null>(null);
  const [pendingPermissionRequest, setPendingPermissionRequest] =
    useState<ACPPermissionRequest | null>(null);

  // Ref for auto-scrolling to latest messages
  const conversationRef = useRef<HTMLDivElement>(null);

  // Filter models based on available API keys and local AI capability
  const availableModels = useMemo(() => {
    const models = AVAILABLE_MODELS.filter((model) => {
      if (model.provider === 'openai') return !!apiKey;
      if (model.provider === 'anthropic') return !!anthropicApiKey;
      if (model.provider === 'local') return isLocalAIAvailable;
      return false;
    });

    // If no API keys are set, show all models (for settings view)
    return models.length > 0 ? models : AVAILABLE_MODELS;
  }, [apiKey, anthropicApiKey, isLocalAIAvailable]);

  useEffect(() => {
    // Load conversation data and initialize settings
    const initialize = async () => {
      try {
        // Load OpenAI API key
        const result = await SecureStoragePlugin.get({ key: 'openai_api_key' });
        if (result?.value) {
          setApiKey(result.value);
          setShowApiKeyInput(false);
        }

        // Load Anthropic API key
        const anthropicResult = await SecureStoragePlugin.get({ key: 'anthropic_api_key' });
        if (anthropicResult?.value) {
          setAnthropicApiKey(anthropicResult.value);
        }

        // Load selected model first
        const modelResult = await SecureStoragePlugin.get({ key: 'selected_model' });
        if (modelResult?.value) {
          setSelectedModel(modelResult.value);
          // Auto-determine provider from model
          const model = AVAILABLE_MODELS.find((m) => m.value === modelResult.value);
          if (model) {
            setSelectedProvider(model.provider);
          }
        }

        // Load provider preference as fallback (for backwards compatibility)
        const providerResult = await SecureStoragePlugin.get({ key: 'selected_provider' });
        if (providerResult?.value && !modelResult?.value) {
          setSelectedProvider(providerResult.value as 'openai' | 'anthropic');
        }

        // Load STT model preference
        const sttModelResult = await SecureStoragePlugin.get({ key: 'stt_model' });
        if (sttModelResult?.value) {
          setSttModel(sttModelResult.value);
        }

        // Load conversation data using the initialized conversation ID from App
        console.log('[ChatView] Loading conversation data for ID:', initialConversationId);
        const currentConversation =
          await conversationStorage.getConversationById(initialConversationId);
        if (currentConversation) {
          setMessages(currentConversation.messages);
          setConversationTitle(currentConversation.title);
          console.log('[ChatView] Loaded conversation:', currentConversation.title);
        }

        // Initialize MCP servers and load data
        debugLogger.info('mcp', '🔄 Loading MCP configurations on startup');
        await mcpManager.loadConfigurations();
        await mcpManager.connectToEnabledServers();

        // Load server data for compact selector
        const servers = mcpManager.getServerConfigs();
        const statuses = mcpManager.getServerStatuses();
        debugLogger.info('mcp', '✅ MCP servers initialized', {
          totalServers: servers.length,
          enabledServers: servers.filter((s) => s.enabled).length,
          connectedServers: Array.from(statuses.values()).filter((s) => s.connected).length,
        });
        setAvailableServers(servers);
        setServerStatuses(statuses);

        // Initialize ACP manager and load servers
        debugLogger.info('acp', '🔄 Loading ACP configurations on startup');
        await acpManager.initialize();
        const acpServerConfigs = acpManager.getServers();
        debugLogger.info('acp', '✅ ACP servers initialized', {
          totalServers: acpServerConfigs.length,
          enabledServers: acpServerConfigs.filter((s) => s.enabled).length,
        });
        setAcpServers(acpServerConfigs);

        // Connect to enabled ACP servers
        await acpManager.connectToEnabledServers();

        // Check local AI capability
        debugLogger.info('chat', '🔍 Checking local AI capability...');
        const localCapability = await getLocalAICapability();
        debugLogger.info('chat', '✅ Local AI capability check complete', {
          available: localCapability.available,
          reason: localCapability.reason,
        });
        setIsLocalAIAvailable(localCapability.available);

        // Check if local model is cached (for logging only)
        const cached = await isModelCached();
        debugLogger.info(
          'chat',
          `📦 Local model cache status: ${cached ? 'Cached' : 'Not cached'}`
        );
      } catch (error) {
        debugLogger.error('mcp', '❌ Failed to initialize MCP servers', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        console.error('Initialization error:', error);
      } finally {
        // Mark initialization as complete after all settings are loaded
        setIsInitialized(true);
      }
    };
    initialize();

    // Cleanup MCP connections on unmount
    return () => {
      mcpManager.cleanup();
    };
  }, [initialConversationId]);

  // Update selected model when API keys change to ensure it's valid
  // Only run this after initialization is complete to avoid overwriting saved model preference
  useEffect(() => {
    // Don't run until initialization is complete (saved model has been loaded from storage)
    if (!isInitialized) return;

    // Check if current selected model is still available
    const isCurrentModelAvailable = availableModels.some((m) => m.value === selectedModel);

    if (!isCurrentModelAvailable && availableModels.length > 0) {
      // Set smart default based on available API keys
      let defaultModel: string;

      if (apiKey && !anthropicApiKey) {
        // Only OpenAI key: default to gpt-5-mini
        defaultModel = 'gpt-5-mini';
      } else if (anthropicApiKey && !apiKey) {
        // Only Anthropic key: default to Claude Sonnet 4.5
        defaultModel = 'claude-sonnet-4-5-20250929';
      } else {
        // Both keys or fallback: default to Claude Sonnet 4.5
        defaultModel = 'claude-sonnet-4-5-20250929';
      }

      // Make sure the default model is actually available
      const modelToSet =
        availableModels.find((m) => m.value === defaultModel)?.value || availableModels[0].value;

      setSelectedModel(modelToSet);

      // Save the new default
      SecureStoragePlugin.set({ key: 'selected_model', value: modelToSet }).catch((err) => {
        console.error('Failed to save default model:', err);
      });
    }
  }, [isInitialized, apiKey, anthropicApiKey, availableModels, selectedModel]);

  const saveApiKey = async () => {
    if (tempApiKey.trim()) {
      try {
        await SecureStoragePlugin.set({ key: 'openai_api_key', value: tempApiKey });
        setApiKey(tempApiKey);
        setShowApiKeyInput(false);
      } catch (error) {
        console.error('Failed to save API key:', error);
      }
    }
  };

  const handleMcpCommand = async (command: string) => {
    // Parse /mcp command more flexibly: "/mcp <url>" or variations
    let commandText = command.toLowerCase().startsWith('/mcp ')
      ? command
          .slice(5)
          .trim() // Remove "/mcp " prefix
      : command.toLowerCase() === '/mcp'
        ? '' // Just "/mcp" with no args
        : command.slice(4).trim(); // Remove "/mcp" prefix for other forms

    if (!commandText) {
      addSystemMessage(
        '❌ Please provide a full MCP endpoint URL. Example: `/mcp example.com/mcp`'
      );
      return;
    }

    // Handle common patterns like "add example.com"
    if (commandText.toLowerCase().startsWith('add ')) {
      commandText = commandText.slice(4).trim();
    }

    // Extract URL - could be just the URL or URL with additional params
    const parts = commandText.split(/\s+/);
    let url = parts[0];

    // If URL doesn't have protocol, assume https
    if (!url.match(/^https?:\/\//)) {
      url = `https://${url}`;
    }

    // Use the exact endpoint the user provided - don't modify it

    // Generate a friendly name from the URL
    let hostname = '';
    try {
      hostname = new URL(url).hostname;
      // Validate the URL properly
    } catch {
      addSystemMessage(
        '❌ Invalid URL format. Please provide a complete MCP endpoint like `https://example.com/mcp`'
      );
      return;
    }

    const name = parts[1] || hostname;
    const transportType = (parts[2] as 'http-streamable' | 'sse') || 'http-streamable';

    // Add user message showing the command
    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ type: 'text', text: command }],
      timestamp: Date.now(),
    };
    setMessages((prev) => {
      const newMessages = [...prev, userMessage];
      // Save to conversation storage with retry logic
      saveMessagesToStorage(newMessages).catch((error) => {
        console.error('Failed to save user message after all retries:', error);
      });
      return newMessages;
    });

    // Add system message indicating we're testing the connection
    addSystemMessage(`🔄 Testing connection to ${hostname}...`);
    setStatus('submitted');

    try {
      // Test the server with OAuth discovery
      const testResult = await mcpManager.testServerWithOAuthDiscovery({
        name,
        url,
        transportType,
        description: `Added via /mcp command from chat`,
        enabled: false, // Don't enable automatically
      });

      if (testResult.connectionSuccess) {
        // Show success and ask for confirmation
        const authInfo = testResult.requiresAuth
          ? '\n🔐 OAuth authentication will be required.'
          : '';
        const confirmMessage = `✅ Successfully connected to ${hostname}!${authInfo}\n\nAdd this MCP server to your configuration?`;

        if (confirm(confirmMessage)) {
          // Add the server
          await mcpManager.addServer({
            name,
            url,
            transportType,
            description: `Added via /mcp command from chat`,
            enabled: true,
            requiresAuth: testResult.requiresAuth,
          });

          // Refresh server data
          const servers = mcpManager.getServerConfigs();
          const statuses = mcpManager.getServerStatuses();
          setAvailableServers(servers);
          setServerStatuses(statuses);

          const authNote = testResult.requiresAuth
            ? ' You can authenticate via Settings → Tools & MCP.'
            : '';
          addSystemMessage(`✅ Added "${name}" to your MCP servers!${authNote}`);
        } else {
          addSystemMessage('👍 No problem! You can always add it later through Settings.');
        }
      } else {
        // Show more natural error information
        addSystemMessage(`❌ Couldn't connect to ${hostname}`);
        if (testResult.error) {
          addSystemMessage(`Details: ${testResult.error}`);
        }

        if (testResult.detailedError) {
          console.error('Detailed MCP connection error:', testResult.detailedError);
        }
      }
    } catch (error) {
      console.error('Failed to test MCP server:', error);
      addSystemMessage(`❌ Something went wrong while testing ${hostname}`);
      if (error instanceof Error) {
        addSystemMessage(`Error: ${error.message}`);
      }
    } finally {
      setStatus('ready');
    }
  };

  /**
   * Save messages to storage with retry logic.
   * Ensures messages are persisted even if initial save fails.
   */
  const saveMessagesToStorage = async (messages: UIMessage[], retries = 3): Promise<void> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await conversationStorage.updateMessages(messages as StoredMessage[]);
        return; // Success!
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Save Attempt ${attempt}/${retries}] Failed to save messages:`, errorMsg);
        debugLogger.error('chat', `❌ Save attempt ${attempt}/${retries} failed`, {
          error: errorMsg,
          messageCount: messages.length,
        });

        // If this was the last attempt, log critical error
        if (attempt === retries) {
          console.error('CRITICAL: All save attempts exhausted. Messages may be lost!');
          debugLogger.error('chat', '🚨 CRITICAL: All save attempts exhausted', {
            error: errorMsg,
            messageCount: messages.length,
            lastMessageId: messages[messages.length - 1]?.id,
          });
          // Still throw so caller knows it failed
          throw error;
        }

        // Wait before retrying (exponential backoff: 100ms, 200ms, 400ms)
        await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** (attempt - 1)));
      }
    }
  };

  const addSystemMessage = (content: string) => {
    const systemMessage: UIMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      parts: [{ type: 'text', text: content }],
      timestamp: Date.now(),
    };
    setMessages((prev) => {
      const newMessages = [...prev, systemMessage];
      // Save to conversation storage with retry logic
      saveMessagesToStorage(newMessages).catch((error) => {
        console.error('Failed to save system message after all retries:', error);
      });
      return newMessages;
    });
  };

  const handlePermissionResponse = async (
    requestId: string,
    optionId: string,
    kind: ACPPermissionKind
  ) => {
    if (!currentAcpSessionId) {
      debugLogger.error('acp', '❌ No active ACP session for permission response');
      console.error('No active ACP session');
      return;
    }

    try {
      debugLogger.info('acp', `📤 Sending permission response: ${kind}`, { requestId, optionId });

      // Send response to agent via acpManager
      await acpManager.respondToPermission(currentAcpSessionId, requestId, optionId);

      debugLogger.info('acp', '✅ Permission response sent successfully');
      setPendingPermissionRequest(null);
    } catch (error) {
      debugLogger.error('acp', '❌ Failed to send permission response:', error);
      console.error('Permission response error:', error);
      alert(
        `Failed to respond to permission request: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const sendAcpMessage = async (content: string) => {
    if (!selectedAcpServer) {
      alert('Please select an ACP agent');
      return;
    }

    try {
      debugLogger.info('acp', '🚀 Starting ACP message send', {
        serverId: selectedAcpServer,
        contentLength: content.length,
        hasSession: !!currentAcpSessionId,
      });

      setStatus('submitted');

      // Add user message to UI
      const userMessage: UIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        parts: [{ type: 'text', text: content }],
        timestamp: Date.now(),
        provider: 'acp',
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      // Save user message
      await saveMessagesToStorage(updatedMessages).catch((error) => {
        console.error('Failed to save user message:', error);
      });

      // Convert to ACP message format
      const acpMessages: ACPMessage[] = updatedMessages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'agent',
        content: [{ type: 'text', text: msg.parts.find((p) => p.type === 'text')?.text || '' }],
      }));

      // Create session if needed
      let sessionId = currentAcpSessionId;
      if (!sessionId) {
        debugLogger.info('acp', '📝 Creating new ACP session');
        const session = await acpManager.createSession(selectedAcpServer, { cwd: '/' });
        sessionId = session.id;
        setCurrentAcpSessionId(sessionId);
        debugLogger.info('acp', '✅ Session created:', sessionId);
      }

      // Stream response from ACP agent
      const agentMessageId = `agent-${Date.now()}`;
      let agentContent = '';
      const toolCalls: ACPToolCall[] = [];
      let agentPlan: ACPPlan | null = null;

      setStatus('streaming');

      debugLogger.info('acp', '📡 Starting message stream');
      const stream = acpManager.sendPrompt(sessionId, acpMessages);

      for await (const update of stream) {
        debugLogger.info('acp', '📥 Received update:', update.type);

        switch (update.type) {
          case 'agent_message_chunk':
            if (update.text) {
              agentContent += update.text;
              setMessages((prev) => {
                const existing = prev.find((m) => m.id === agentMessageId);
                if (existing) {
                  return prev.map((m) =>
                    m.id === agentMessageId
                      ? {
                          ...m,
                          parts: [{ type: 'text', text: agentContent }],
                        }
                      : m
                  );
                }
                return [
                  ...prev,
                  {
                    id: agentMessageId,
                    role: 'assistant' as const,
                    parts: [{ type: 'text', text: agentContent }],
                    timestamp: Date.now(),
                    provider: 'acp' as const,
                    acpToolCalls: toolCalls,
                    acpPlan: agentPlan || undefined,
                    acpSessionId: sessionId,
                  },
                ];
              });
            }
            break;

          case 'tool_call':
          case 'tool_call_update':
            if (update.toolCall) {
              const existingIndex = toolCalls.findIndex(
                (tc) => tc.toolCallId === update.toolCall?.toolCallId
              );
              if (existingIndex >= 0) {
                toolCalls[existingIndex] = update.toolCall;
              } else {
                toolCalls.push(update.toolCall);
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMessageId ? { ...m, acpToolCalls: [...toolCalls] } : m
                )
              );
            }
            break;

          case 'plan':
            if (update.plan) {
              agentPlan = update.plan;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMessageId ? { ...m, acpPlan: agentPlan || undefined } : m
                )
              );
            }
            break;

          case 'thought':
            debugLogger.info('acp', '💭 Agent thought:', update.thought);
            break;

          case 'permission_request':
            if (update.permissionRequest) {
              debugLogger.info('acp', '🔐 Permission request received:', update.permissionRequest);
              setPendingPermissionRequest(update.permissionRequest);
            }
            break;
        }
      }

      // Save final conversation
      const finalMessages = [...updatedMessages];
      const agentMessage = messages.find((m) => m.id === agentMessageId);
      if (agentMessage) {
        finalMessages.push(agentMessage);
      }

      await saveMessagesToStorage(finalMessages).catch((error) => {
        console.error('Failed to save conversation:', error);
      });

      setStatus('ready');
      debugLogger.info('acp', '✅ ACP message flow completed');
    } catch (error) {
      debugLogger.error('acp', '❌ ACP message error:', error);
      console.error('ACP message error:', error);

      const errorMessage: UIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        timestamp: Date.now(),
        provider: 'acp',
      };

      setMessages((prev) => {
        const newMessages = [...prev, errorMessage];
        saveMessagesToStorage(newMessages).catch((err) => {
          console.error('Failed to save error message:', err);
        });
        return newMessages;
      });

      setStatus('error');
    }
  };

  const sendLocalMessage = async (content: string) => {
    debugLogger.info('chat', '🤖 Starting local AI message send', {
      contentLength: content.length,
      modelState: localAIService.getState(),
    });

    // Create user message
    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ type: 'text', text: content }],
      timestamp: Date.now(),
    };

    setMessages((prev) => {
      const newMessages = [...prev, userMessage];
      saveMessagesToStorage(newMessages).catch((error) => {
        console.error('Failed to save user message:', error);
      });
      return newMessages;
    });
    setStatus('submitted');

    try {
      // Initialize model if not ready
      if (!localAIService.isReady()) {
        debugLogger.info('chat', '📥 Initializing local AI model...');
        setStatus('streaming'); // Show loading state during model download

        await localAIService.initialize(
          {
            modelId: 'onnx-community/gemma-3-270m-it-ONNX',
            device: 'webgpu',
            dtype: 'q4f16', // CRITICAL: Avoid q4/fp32 crashes
          },
          (progress, stage, downloadSpeed, modelName, modelSize) => {
            debugLogger.info('chat', `📊 Model loading: ${stage} - ${Math.round(progress * 100)}%`);
            // Update progress UI (progress is 0-1 from Transformers.js, LocalAIProgressCard converts to %)
            setLocalAIProgress({ progress, stage, downloadSpeed, modelName, modelSize });
          }
        );

        debugLogger.info('chat', '✅ Local AI model ready');
        setLocalAIProgress(null); // Clear progress after loading
      }

      setStatus('streaming');

      // Convert messages to simple text format for local model
      const conversationHistory = messages
        .concat(userMessage)
        .map((msg) => {
          const textPart = msg.parts.find((p) => p.type === 'text');
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          return `${role}: ${textPart?.text || ''}`;
        })
        .join('\n\n');

      const prompt = `${conversationHistory}\n\nAssistant:`;

      debugLogger.info('chat', '🚀 Calling local AI generate', {
        promptLength: prompt.length,
      });

      // Generate response
      const startTime = Date.now();
      const assistantMessageId = (Date.now() + 1).toString();

      // Reset streaming text
      setStreamingLocalText('');

      // Create initial assistant message for streaming
      const initialAssistantMessage: UIMessage = {
        id: assistantMessageId,
        role: 'assistant',
        parts: [{ type: 'text', text: '' }],
        timestamp: Date.now(),
        provider: 'local',
      };

      setMessages((prev) => [...prev, initialAssistantMessage]);

      const result = await localAIService.generate(
        prompt,
        {
          maxNewTokens: 256,
          temperature: 0.7,
          topP: 0.9,
        },
        (token) => {
          // Stream tokens to UI in real-time
          setStreamingLocalText((prev) => {
            const newText = prev + token;
            // Update message in place
            setMessages((msgs) =>
              msgs.map((m) =>
                m.id === assistantMessageId ? { ...m, parts: [{ type: 'text', text: newText }] } : m
              )
            );
            return newText;
          });
        }
      );

      const duration = Date.now() - startTime;

      debugLogger.info('chat', '✅ Local AI response received', {
        duration: `${duration}ms`,
        textLength: result.text.length,
        tokensPerSecond: result.stats.tokensPerSecond,
      });

      // Final update with complete text (in case streaming missed anything)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId ? { ...m, parts: [{ type: 'text', text: result.text }] } : m
        )
      );

      // Save final messages to storage
      const finalMessages = await conversationStorage.getCurrentConversation();
      if (finalMessages) {
        await saveMessagesToStorage(finalMessages.messages as UIMessage[]).catch((error) => {
          console.error('Failed to save assistant message:', error);
        });
      }

      setStatus('ready');
      debugLogger.info('chat', '✅ Local AI message flow completed');
    } catch (error) {
      debugLogger.error('chat', '❌ Local AI error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      const errorMessage: UIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: `Sorry, local AI encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Try switching to OpenAI or Anthropic.`,
          },
        ],
        timestamp: Date.now(),
        provider: 'local',
      };

      setMessages((prev) => {
        const newMessages = [...prev, errorMessage];
        saveMessagesToStorage(newMessages).catch((err) => {
          console.error('Failed to save error message:', err);
        });
        return newMessages;
      });

      setStatus('error');
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    debugLogger.info('chat', '💬 Starting message send', {
      contentLength: content.trim().length,
      chatMode,
      selectedProvider: chatMode === 'chat' ? selectedProvider : 'acp',
      selectedModel: chatMode === 'chat' ? selectedModel : selectedAcpServer,
      currentConversationId,
    });

    const trimmedContent = content.trim();

    // Check for /mcp command - handle various forms
    if (trimmedContent.toLowerCase().startsWith('/mcp')) {
      await handleMcpCommand(trimmedContent);
      return;
    }

    // Handle ACP mode
    if (chatMode === 'acp') {
      await sendAcpMessage(trimmedContent);
      return;
    }

    // Handle Chat mode (OpenAI/Anthropic/Local)
    // Handle local provider separately (no API key needed)
    if (selectedProvider === 'local') {
      debugLogger.info('chat', '🤖 Using local AI provider');
      await sendLocalMessage(trimmedContent);
      return;
    }

    // Check if we have the appropriate API key for cloud providers
    const currentApiKey = selectedProvider === 'openai' ? apiKey : anthropicApiKey;
    if (!currentApiKey) {
      debugLogger.error('chat', '❌ No API key available', {
        selectedProvider,
        hasOpenAIKey: !!apiKey,
        hasAnthropicKey: !!anthropicApiKey,
      });
      console.error(`No API key available for provider: ${selectedProvider}`);
      return;
    }

    debugLogger.info('chat', '✅ API key validated', { provider: selectedProvider });

    // Create user message with parts structure
    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ type: 'text', text: trimmedContent }],
      timestamp: Date.now(),
    };

    setMessages((prev) => {
      const newMessages = [...prev, userMessage];
      // Save to conversation storage with retry logic
      saveMessagesToStorage(newMessages).catch((error) => {
        console.error('Failed to save user message after all retries:', error);
      });
      return newMessages;
    });
    setStatus('submitted');

    try {
      debugLogger.info('chat', '🔧 Creating provider client', {
        provider: selectedProvider,
        model: selectedModel,
      });

      // Create the appropriate provider client
      const providerClient =
        selectedProvider === 'openai'
          ? createOpenAI({ apiKey: currentApiKey })
          : createAnthropic({ apiKey: currentApiKey });

      debugLogger.info('chat', '✅ Provider client created', { provider: selectedProvider });

      // Get tools from MCP manager
      debugLogger.info('chat', '🔨 Fetching MCP tools');
      const mcpTools = await mcpManager.getAllTools();
      debugLogger.info('chat', '📦 MCP tools retrieved', {
        toolCount: Object.keys(mcpTools).length,
        toolNames: Object.keys(mcpTools),
      });
      // biome-ignore lint/suspicious/noExplicitAny: AI SDK tools require flexible typing
      const tools: Record<string, any> = {};

      // Convert MCP tools to AI SDK format
      for (const [toolName, toolDef] of Object.entries(mcpTools)) {
        const inputSchema = toolDef.inputSchema || { type: 'object', properties: {} };

        // Sanitize tool name for OpenAI: only letters, numbers, underscores, and hyphens
        const sanitizedToolName = toolName.replace(/[^a-zA-Z0-9_-]/g, '_');

        // Debug logging
        if (toolName !== sanitizedToolName) {
          console.log(`Tool name sanitized: "${toolName}" -> "${sanitizedToolName}"`);
        }

        tools[sanitizedToolName] = tool({
          description: toolDef.description || `Tool from ${toolDef._mcpServerName}`,
          inputSchema: z.object(
            Object.fromEntries(
              Object.entries(inputSchema.properties || {}).map(([key, prop]) => [
                key,
                prop.type === 'string'
                  ? z.string().describe(prop.description || key)
                  : prop.type === 'number'
                    ? z.number().describe(prop.description || key)
                    : z.unknown().describe(prop.description || key),
              ])
            )
          ),
          execute: async (args: Record<string, unknown>) => {
            try {
              return await mcpManager.callTool(toolName, args);
            } catch (error) {
              console.error(`Failed to execute tool ${toolName}:`, error);
              return { error: error instanceof Error ? error.message : 'Tool execution failed' };
            }
          },
        });
      }

      // Convert messages to the format expected by generateText
      const formattedMessages = messages.concat(userMessage).map((msg) => ({
        role: msg.role,
        content: msg.parts.find((p) => p.type === 'text')?.text || '',
      }));

      debugLogger.info('chat', '📝 Formatted messages for AI', {
        messageCount: formattedMessages.length,
        toolCount: Object.keys(tools).length,
      });

      setStatus('streaming');

      debugLogger.info('chat', '🚀 Calling generateText API', {
        provider: selectedProvider,
        model: selectedModel,
        hasTools: Object.keys(tools).length > 0,
      });

      const startTime = Date.now();
      const result = await generateText({
        model: providerClient(selectedModel),
        messages: formattedMessages,
        tools,
        stopWhen: stepCountIs(5), // Enable multi-step: AI can use tools and then respond
        providerOptions: {
          openai: {
            reasoningSummary: 'detailed', // Enable reasoning display for thinking models like o3-mini
          },
        },
      });
      const duration = Date.now() - startTime;

      debugLogger.info('chat', '✅ AI response received', {
        duration: `${duration}ms`,
        hasText: !!result.text,
        textLength: result.text?.length || 0,
        hasReasoning: !!result.reasoning && result.reasoning.length > 0,
        hasSteps: !!result.steps && result.steps.length > 0,
        stepCount: result.steps?.length || 0,
      });

      // Create assistant message with parts
      const assistantParts: MessagePart[] = [];

      // Add reasoning parts for thinking models like o3-mini
      if (result.reasoning && Array.isArray(result.reasoning) && result.reasoning.length > 0) {
        const reasoningText = result.reasoning.map((part) => part.text || '').join('\n\n');
        if (reasoningText.trim()) {
          assistantParts.push({
            type: 'reasoning',
            text: reasoningText,
          });
        }
      }

      // Extract tool calls from the result
      if (result.steps) {
        for (const step of result.steps) {
          if (step.toolCalls) {
            for (const toolCall of step.toolCalls) {
              const toolResult = step.toolResults?.find(
                (r) => r.toolCallId === toolCall.toolCallId
              );

              assistantParts.push({
                type: `tool-${toolCall.toolName}`,
                toolName: toolCall.toolName,
                input: (toolCall.input || {}) as Record<string, unknown>,
                output: toolResult,
                state: toolResult ? 'output-available' : 'output-error',
                errorText: toolResult ? undefined : 'Tool execution failed',
              });
            }
          }
        }
      }

      // Add text response if available
      if (result.text?.trim()) {
        assistantParts.push({
          type: 'text',
          text: result.text,
        });
      }

      const assistantMessage: UIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        parts: assistantParts,
        timestamp: Date.now(),
        provider: selectedProvider, // Track which provider generated this message
      };

      debugLogger.info('chat', '💾 Saving assistant message', {
        provider: selectedProvider,
        partsCount: assistantParts.length,
        messageId: assistantMessage.id,
      });

      setMessages((prev) => {
        const newMessages = [...prev, assistantMessage];
        // Save to conversation storage with retry logic
        saveMessagesToStorage(newMessages).catch((error) => {
          console.error('Failed to save assistant message after all retries:', error);
        });
        return newMessages;
      });
      setStatus('ready');
      debugLogger.info('chat', '✅ Chat message flow completed successfully');
    } catch (error) {
      debugLogger.error('chat', '❌ Chat error occurred', {
        error: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : undefined,
        stack: error instanceof Error ? error.stack : undefined,
        selectedProvider,
        selectedModel,
      });
      console.error('Chat error:', error);

      const errorMessage: UIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Sorry, I encountered an error. Please check your API key and try again.',
          },
        ],
        timestamp: Date.now(),
      };

      setMessages((prev) => {
        const newMessages = [...prev, errorMessage];
        // Save to conversation storage with retry logic
        saveMessagesToStorage(newMessages).catch((error) => {
          console.error('Failed to save error message after all retries:', error);
        });
        return newMessages;
      });
      setStatus('error');
    }
  };

  const handleSend = (content: string) => {
    sendMessage(content);
  };

  const handleVoiceInput = async () => {
    // If already recording, stop the current recording
    if (isRecording && currentRecording) {
      debugLogger.info('audio', '⏹️ Stopping recording (user clicked stop button)');
      // Haptic feedback for stopping
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (error) {
        // Haptics may not be available on all platforms
        console.debug('Haptics not available:', error);
      }
      currentRecording.mediaRecorder.stop();
      return;
    }

    debugLogger.info('audio', '🎤 Starting voice input', {
      sttModel,
      hasApiKey: !!apiKey,
      currentProvider: selectedProvider,
    });

    try {
      // Request microphone permission and start recording
      debugLogger.info('audio', '🔑 Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      debugLogger.info('audio', '✅ Microphone permission granted', {
        audioTracks: stream.getAudioTracks().length,
        trackSettings: stream.getAudioTracks()[0]?.getSettings(),
      });

      // Haptic feedback for starting recording
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (error) {
        // Haptics may not be available on all platforms
        console.debug('Haptics not available:', error);
      }

      // Create MediaRecorder to capture audio
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];
      debugLogger.info('audio', '🎙️ MediaRecorder created', {
        mimeType: mediaRecorder.mimeType,
        state: mediaRecorder.state,
      });

      // Collect audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          debugLogger.info('audio', '📊 Audio chunk received', {
            chunkSize: event.data.size,
            totalChunks: audioChunks.length,
          });
        }
      };

      // Handle recording completion
      mediaRecorder.onstop = async () => {
        debugLogger.info('audio', '🛑 Recording stopped, processing audio...');
        setIsRecording(false);
        setCurrentRecording(null);
        try {
          // Create audio blob from chunks
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          debugLogger.info('audio', '🎵 Audio blob created', {
            size: audioBlob.size,
            type: audioBlob.type,
            chunks: audioChunks.length,
          });

          // Convert to ArrayBuffer for transcription
          const audioData = new Uint8Array(await audioBlob.arrayBuffer());
          debugLogger.info('audio', '🔄 Converted to ArrayBuffer', {
            byteLength: audioData.byteLength,
          });

          // Set processing status
          setStatus('submitted');

          // Transcribe using OpenAI Whisper (always use OpenAI for transcription)
          if (!apiKey) {
            debugLogger.error('audio', '❌ No OpenAI API key available for transcription');
            setStatus('error');
            return;
          }

          debugLogger.info('audio', '🚀 Calling transcription API', {
            model: sttModel,
            audioSize: audioData.byteLength,
            provider: 'openai',
          });

          const openai = createOpenAI({ apiKey });
          const startTime = Date.now();
          const transcript = await transcribe({
            model: openai.transcription(sttModel), // Use selected STT model from settings
            audio: audioData,
          });
          const duration = Date.now() - startTime;

          debugLogger.info('audio', '✅ Transcription received', {
            duration: `${duration}ms`,
            textLength: transcript.text?.length || 0,
            hasText: !!transcript.text?.trim(),
          });

          const transcribedText = transcript.text?.trim();
          if (transcribedText) {
            debugLogger.info('audio', '📤 Sending transcribed message', {
              textPreview:
                transcribedText.substring(0, 50) + (transcribedText.length > 50 ? '...' : ''),
              fullLength: transcribedText.length,
            });
            // Send the transcribed message
            await sendMessage(transcribedText);
            debugLogger.info('audio', '✅ Message sent successfully');
          } else {
            debugLogger.warn('audio', '⚠️ Transcription returned empty text');
            setStatus('error');
          }
        } catch (error) {
          debugLogger.error('audio', '❌ Transcription error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          });
          setStatus('error');
        } finally {
          // Stop all tracks to release microphone
          stream.getTracks().forEach((track) => {
            track.stop();
          });
          debugLogger.info('audio', '🔌 Microphone released');
        }
      };

      // Start recording with timeslice to ensure continuous data collection
      // A timeslice of 1000ms ensures ondataavailable fires every second,
      // preventing browser from prematurely stopping the recording
      mediaRecorder.start(1000);
      setIsRecording(true);
      setCurrentRecording({ mediaRecorder, stream });
      debugLogger.info('audio', '▶️ Recording started successfully with 1s timeslice');
    } catch (error) {
      debugLogger.error('audio', '❌ Voice input error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });
      setIsRecording(false);
      setCurrentRecording(null);
      alert('Microphone access denied or not available');
    }
  };

  const toggleServerEnabled = async (serverId: string) => {
    const server = availableServers.find((s) => s.id === serverId);
    if (!server) return;

    const enabled = !server.enabled;
    try {
      await mcpManager.updateServer(serverId, { enabled });
      // Refresh server data
      const servers = mcpManager.getServerConfigs();
      const statuses = mcpManager.getServerStatuses();
      setAvailableServers(servers);
      setServerStatuses(statuses);
    } catch (error) {
      console.error('Failed to toggle server:', error);
    }
  };

  const handleModelSelect = async (modelId: string) => {
    setSelectedModel(modelId);

    // Determine provider from selected model
    const model = AVAILABLE_MODELS.find((m) => m.value === modelId);
    if (model) {
      setSelectedProvider(model.provider);
      try {
        await SecureStoragePlugin.set({ key: 'selected_provider', value: model.provider });
      } catch (error) {
        console.error('Failed to save selected provider:', error);
      }
    }

    // Save selected model to secure storage
    try {
      await SecureStoragePlugin.set({ key: 'selected_model', value: modelId });
    } catch (error) {
      console.error('Failed to save selected model:', error);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === 'ready') {
      handleSend(input);
      setInput('');
    }
  };

  // Auto-scroll to bottom when new messages arrive or AI starts thinking
  // biome-ignore lint/correctness/useExhaustiveDependencies: We intentionally want to scroll when messages or status changes
  useEffect(() => {
    if (conversationRef.current) {
      // Scroll when:
      // 1. New messages are added (messages array changes)
      // 2. AI starts streaming (status becomes 'streaming')
      // 3. AI finishes streaming (status becomes 'ready')
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages, status]);

  // Poll for title updates (in case it's generated in the background)
  useEffect(() => {
    if (!currentConversationId) return;

    const pollTitleUpdates = async () => {
      const conversation = await conversationStorage.getCurrentConversation();
      if (conversation && conversation.title !== conversationTitle) {
        setConversationTitle(conversation.title);
      }
    };

    // Poll every 500ms
    const interval = setInterval(pollTitleUpdates, 500);
    return () => clearInterval(interval);
  }, [currentConversationId, conversationTitle]);

  const handleNewConversation = async (conversation: ConversationData) => {
    console.log('[ChatView] handleNewConversation called with conversation:', conversation.id);
    // Use the conversation object passed directly from Sidebar (no database query needed)
    setCurrentConversationId(conversation.id);
    setConversationTitle(conversation.title);
    setMessages(conversation.messages);
    setInput('');
    console.log('[ChatView] State updated successfully');
  };

  const handleSelectConversation = async (_conversationId: string) => {
    const conversation = await conversationStorage.getCurrentConversation();
    if (conversation) {
      setCurrentConversationId(conversation.id);
      setConversationTitle(conversation.title);
      setMessages(conversation.messages);
    }
  };

  const handleNewConversationFromButton = async () => {
    try {
      console.log('[ChatView] Creating new conversation from navbar button...');
      const newConv = await conversationStorage.createNewConversation();
      console.log('[ChatView] New conversation created:', newConv.id);

      setCurrentConversationId(newConv.id);
      setConversationTitle(newConv.title);
      setMessages(newConv.messages);
      setInput('');
      console.log('[ChatView] State updated successfully');
    } catch (error) {
      console.error('[ChatView] Error creating new conversation:', error);
    }
  };

  const handleEditTitle = () => {
    setEditedTitle(conversationTitle);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    console.log('[handleSaveTitle] Called', {
      currentConversationId,
      editedTitle,
      conversationTitle,
    });
    if (!currentConversationId) {
      console.log('[handleSaveTitle] No conversation ID, returning early');
      return;
    }

    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== conversationTitle) {
      try {
        console.log('[handleSaveTitle] Updating title to:', trimmed);
        await conversationStorage.updateConversationTitle(currentConversationId, trimmed);
        setConversationTitle(trimmed);
        console.log('[handleSaveTitle] Title updated successfully');
      } catch (error) {
        console.error('Failed to update title:', error);
      }
    }
    console.log('[handleSaveTitle] Exiting edit mode');
    setIsEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setIsEditingTitle(false);
    setEditedTitle('');
  };

  const handleSettingsClose = async () => {
    // Reload MCP servers when Settings closes in case they were added/modified
    console.log('[ChatView] Settings closed, reloading MCP configurations...');
    await mcpManager.loadConfigurations();
    await mcpManager.connectToEnabledServers();

    const servers = mcpManager.getServerConfigs();
    const statuses = mcpManager.getServerStatuses();
    console.log('[ChatView] MCP servers reloaded:', servers.length, servers);
    setAvailableServers(servers);
    setServerStatuses(statuses);

    // Reload ACP servers when Settings closes in case they were added/modified
    console.log('[ChatView] Settings closed, reloading ACP configurations...');
    await acpManager.loadConfigurations();
    await acpManager.connectToEnabledServers();

    const acpServerConfigs = acpManager.getServers();
    console.log('[ChatView] ACP servers reloaded:', acpServerConfigs.length, acpServerConfigs);
    setAcpServers(acpServerConfigs);

    setShowSettings(false);
  };

  // Show Settings screen
  if (showSettings) {
    return <Settings onClose={handleSettingsClose} />;
  }

  // Show API Key input screen
  if (showApiKeyInput) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-2xl font-bold text-center">caw caw</h2>
            <p className="text-muted-foreground text-center">
              Enter your OpenAI API key to get started
            </p>
            <div className="space-y-4">
              <Input
                type="password"
                placeholder="sk-..."
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveApiKey();
                  }
                }}
              />
              <Button onClick={saveApiKey} className="w-full" disabled={!tempApiKey.trim()}>
                Save API Key
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Your API key is stored locally and never sent to our servers
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-background flex">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onOpenSettings={() => setShowSettings(true)}
        currentConversationId={currentConversationId}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Fixed Header with safe area */}
        <div className="border-b pb-3 px-4 flex justify-between items-center safe-top flex-shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <SidebarToggle onClick={() => setIsSidebarOpen(true)} />
            {isEditingTitle ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveTitle();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  onBlur={handleSaveTitle}
                  className="h-8 text-base font-semibold"
                  autoFocus
                />
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <h1 className="text-xl font-semibold truncate">{conversationTitle}</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground active:text-foreground"
                  onClick={handleEditTitle}
                  title="Edit title"
                >
                  <PencilIcon className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleNewConversationFromButton}
            title="New conversation"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Main Conversation - scrollable area */}
        <div ref={conversationRef} className="flex-1 overflow-y-auto overflow-x-hidden">
          <Conversation>
            <div className="w-full max-w-4xl mx-auto px-4 safe-x">
              <ConversationContent className="h-full">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p>Start a conversation with AI</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Local AI Download Progress */}
                    {localAIProgress && (
                      <div className="flex justify-center">
                        <LocalAIProgressCard
                          progress={localAIProgress.progress}
                          stage={localAIProgress.stage}
                          downloadSpeed={localAIProgress.downloadSpeed}
                          modelName={localAIProgress.modelName}
                          modelSize={localAIProgress.modelSize}
                        />
                      </div>
                    )}

                    {messages.map((message) => (
                      <Message key={message.id} from={message.role}>
                        <MessageContent>
                          {message.parts.map((part, idx) => {
                            if (part.type === 'text') {
                              return <Response key={`text-${idx}`}>{part.text || ''}</Response>;
                            } else if (part.type.startsWith('tool-')) {
                              return (
                                <Tool key={`tool-${idx}`} defaultOpen={false}>
                                  <ToolHeader
                                    type={part.type as `tool-${string}`}
                                    state={part.state || 'input-available'}
                                  />
                                  <ToolContent>
                                    <ToolInput input={part.input} toolType={part.type} />
                                    {(part.state === 'input-streaming' ||
                                      part.state === 'input-available') && (
                                      <div className="p-4">
                                        <LoadingMessage />
                                      </div>
                                    )}
                                    {part.state === 'output-available' && (
                                      <ToolOutput output={part.output} errorText={part.errorText} />
                                    )}
                                  </ToolContent>
                                </Tool>
                              );
                            } else if (part.type === 'reasoning') {
                              return (
                                <Reasoning key={`reasoning-${idx}`} defaultOpen={false}>
                                  <ReasoningTrigger />
                                  <ReasoningContent>{part.text || ''}</ReasoningContent>
                                </Reasoning>
                              );
                            }
                            return null;
                          })}

                          {/* ACP Agent Plan */}
                          {message.acpPlan && (
                            <div className="mt-3 rounded-lg border p-3 bg-muted/30">
                              <div className="text-xs font-semibold text-muted-foreground mb-2">
                                {message.acpPlan.title || 'Agent Plan'}
                              </div>
                              <div className="space-y-1">
                                {message.acpPlan.items.map((item) => (
                                  <div key={item.id} className="flex items-center gap-2 text-sm">
                                    <div
                                      className={cn(
                                        'h-4 w-4 flex items-center justify-center rounded-full text-xs font-semibold',
                                        item.status === 'completed' && 'bg-green-500 text-white',
                                        item.status === 'in_progress' && 'bg-blue-500 text-white',
                                        item.status === 'failed' && 'bg-red-500 text-white',
                                        item.status === 'pending' && 'bg-gray-300 dark:bg-gray-600',
                                        item.status === 'skipped' && 'bg-gray-200 dark:bg-gray-700'
                                      )}
                                    >
                                      {item.status === 'completed'
                                        ? '✓'
                                        : item.status === 'in_progress'
                                          ? '⋯'
                                          : item.status === 'failed'
                                            ? '✗'
                                            : '○'}
                                    </div>
                                    <span className="flex-1">{item.title}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* ACP Tool Calls */}
                          {message.acpToolCalls && message.acpToolCalls.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <div className="text-xs font-semibold text-muted-foreground">
                                Tool Calls
                              </div>
                              {message.acpToolCalls.map((toolCall) => (
                                <div
                                  key={toolCall.toolCallId}
                                  className="rounded-lg border p-3 space-y-2 bg-muted/20"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={cn(
                                          'h-2 w-2 rounded-full',
                                          toolCall.status === 'completed' && 'bg-green-500',
                                          toolCall.status === 'in_progress' && 'bg-blue-500',
                                          toolCall.status === 'failed' && 'bg-red-500',
                                          toolCall.status === 'pending' && 'bg-gray-300'
                                        )}
                                      />
                                      <span className="text-sm font-medium">{toolCall.title}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {toolCall.kind}
                                    </span>
                                  </div>

                                  {toolCall.path && (
                                    <div className="text-xs text-muted-foreground">
                                      Path:{' '}
                                      <code className="bg-muted px-1 rounded">{toolCall.path}</code>
                                    </div>
                                  )}

                                  {toolCall.diff && (
                                    <div className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto max-h-[200px] overflow-y-auto">
                                      {toolCall.diff.oldText && (
                                        <div className="text-red-600 dark:text-red-400">
                                          - {toolCall.diff.oldText}
                                        </div>
                                      )}
                                      <div className="text-green-600 dark:text-green-400">
                                        + {toolCall.diff.newText}
                                      </div>
                                    </div>
                                  )}

                                  {toolCall.terminal && (
                                    <div className="space-y-1">
                                      {toolCall.terminal.command && (
                                        <div className="text-xs">
                                          Command:{' '}
                                          <code className="bg-muted px-1 rounded">
                                            {toolCall.terminal.command}
                                          </code>
                                        </div>
                                      )}
                                      {toolCall.terminal.output && (
                                        <div className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto max-h-[200px] overflow-y-auto">
                                          {toolCall.terminal.output}
                                        </div>
                                      )}
                                      {toolCall.terminal.exitCode !== undefined && (
                                        <div className="text-xs text-muted-foreground">
                                          Exit Code: {toolCall.terminal.exitCode}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {toolCall.error && (
                                    <div className="text-xs text-red-600 dark:text-red-400">
                                      Error: {toolCall.error}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </MessageContent>
                        {message.role === 'assistant' ? null : (
                          <Avatar className="size-8 ring ring-1 ring-border">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              <User size={16} />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </Message>
                    ))}

                    {/* AI thinking indicator when streaming */}
                    {status === 'streaming' && (
                      <Message from="assistant">
                        <MessageContent>
                          <div className="p-3">
                            <LoadingMessage />
                          </div>
                        </MessageContent>
                      </Message>
                    )}
                  </div>
                )}
              </ConversationContent>
            </div>
            <ConversationScrollButton />
          </Conversation>
        </div>

        {/* Fixed Input Area with safe area */}
        <div className="border-t pt-4 pb-6 safe-bottom flex-shrink-0">
          <div className="w-full max-w-4xl mx-auto px-4 safe-x">
            {/* Mode Switcher */}
            <div className="flex items-center gap-2 mb-3">
              <Button
                variant={chatMode === 'chat' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChatMode('chat')}
                className="h-8"
              >
                Chat
              </Button>
              <Button
                variant={chatMode === 'acp' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChatMode('acp')}
                className="h-8"
              >
                ACP Agent
              </Button>

              {chatMode === 'acp' && (
                <Select value={selectedAcpServer || ''} onValueChange={setSelectedAcpServer}>
                  <SelectTrigger className="w-[200px] h-8">
                    <SelectValue placeholder="Select agent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {acpServers.filter((s) => s.enabled).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No enabled agents. Configure in Settings.
                      </div>
                    ) : (
                      acpServers
                        .filter((s) => s.enabled)
                        .map((server) => (
                          <SelectItem key={server.id} value={server.id}>
                            {server.name}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              )}

              {chatMode === 'acp' && status === 'streaming' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (currentAcpSessionId) {
                      acpManager.cancelSession(currentAcpSessionId);
                      setStatus('ready');
                    }
                  }}
                  className="h-8"
                >
                  Cancel
                </Button>
              )}
            </div>

            <PromptInput
              onSubmit={handleFormSubmit}
              className={cn(
                'transition-all duration-200',
                isRecording &&
                  'ring-2 ring-red-500 ring-opacity-50 shadow-lg shadow-red-200 dark:shadow-red-900/20'
              )}
            >
              <PromptInputTextarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Reset error state when user starts typing
                  if (status === 'error') {
                    setStatus('ready');
                  }
                }}
                placeholder={isRecording ? 'Recording...' : 'Type your message...'}
                disabled={isRecording || status === 'streaming'}
                className="min-h-[48px]"
              />
              <PromptInputToolbar className="flex items-center justify-between gap-2 p-2 min-w-0">
                {/* When recording: show full-width waveform that blocks other UI */}
                {isRecording && currentRecording ? (
                  <>
                    {/* Left side: Audio waveform */}
                    <div className="flex items-center flex-1 overflow-hidden min-w-0">
                      <LiveAudioVisualizer
                        mediaRecorder={currentRecording.mediaRecorder}
                        width={320}
                        height={40}
                        barColor="rgb(239 68 68)"
                        gap={3}
                        barWidth={4}
                      />
                    </div>

                    {/* Right side: Submit button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="default"
                        size="icon"
                        className="h-9 w-9 shrink-0 rounded-full bg-primary hover:bg-primary/90"
                        onClick={handleVoiceInput}
                        title="Send recording"
                      >
                        <ArrowUpIcon className="size-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Left side: Contextual controls */}
                    <div className="flex items-center gap-1 flex-1 overflow-hidden min-w-0">
                      {/* Model selector - icon only on mobile, full text on desktop */}
                      <PromptInputModelSelect
                        value={selectedModel}
                        onValueChange={handleModelSelect}
                      >
                        <PromptInputModelSelectTrigger className="h-9 gap-1.5 sm:max-w-[200px]">
                          {selectedProvider === 'anthropic' ? (
                            <AnthropicIcon size={14} className="shrink-0" />
                          ) : selectedProvider === 'local' ? (
                            <Cpu size={14} className="shrink-0" />
                          ) : (
                            <OpenAIIcon size={14} className="shrink-0" />
                          )}
                          <span className="hidden sm:inline text-xs font-medium truncate min-w-0">
                            <PromptInputModelSelectValue placeholder="Select model" />
                          </span>
                        </PromptInputModelSelectTrigger>
                        <PromptInputModelSelectContent>
                          {availableModels.filter((m) => m.provider === 'openai').length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="flex items-center gap-2">
                                <OpenAIIcon size={14} />
                                <span>OpenAI Models</span>
                              </SelectLabel>
                              {availableModels
                                .filter((m) => m.provider === 'openai')
                                .map((model) => (
                                  <PromptInputModelSelectItem key={model.value} value={model.value}>
                                    {model.label}
                                  </PromptInputModelSelectItem>
                                ))}
                            </SelectGroup>
                          )}
                          {availableModels.filter((m) => m.provider === 'anthropic').length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="flex items-center gap-2">
                                <AnthropicIcon size={14} />
                                <span>Anthropic Models</span>
                              </SelectLabel>
                              {availableModels
                                .filter((m) => m.provider === 'anthropic')
                                .map((model) => (
                                  <PromptInputModelSelectItem key={model.value} value={model.value}>
                                    {model.label}
                                  </PromptInputModelSelectItem>
                                ))}
                            </SelectGroup>
                          )}
                          {availableModels.filter((m) => m.provider === 'local').length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="flex items-center gap-2">
                                <Cpu size={14} />
                                <span>Local Models</span>
                              </SelectLabel>
                              {availableModels
                                .filter((m) => m.provider === 'local')
                                .map((model) => (
                                  <PromptInputModelSelectItem key={model.value} value={model.value}>
                                    {model.label}
                                  </PromptInputModelSelectItem>
                                ))}
                            </SelectGroup>
                          )}
                        </PromptInputModelSelectContent>
                      </PromptInputModelSelect>

                      {/* MCP Tools - with clear label */}
                      <Popover open={mcpPopoverOpen} onOpenChange={setMcpPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'h-9 gap-1.5 relative max-w-[120px]',
                              (() => {
                                // Check if any server has a warning/error
                                const hasWarnings = Array.from(serverStatuses.values()).some(
                                  (status) => status.error
                                );
                                return hasWarnings
                                  ? 'text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400'
                                  : 'text-muted-foreground hover:text-foreground';
                              })()
                            )}
                          >
                            <McpIcon size={14} className="shrink-0" />
                            <span className="text-xs font-medium truncate">MCP</span>
                            {(() => {
                              const enabledCount = availableServers.filter((s) => s.enabled).length;
                              return enabledCount > 0 ? (
                                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold border border-current rounded shrink-0 ml-1">
                                  {enabledCount}
                                </span>
                              ) : null;
                            })()}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-0" align="start">
                          <div className="p-1">
                            {availableServers.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">
                                No MCP servers configured. Add servers in Settings.
                              </div>
                            ) : (
                              availableServers.map((server) => {
                                const serverStatus = serverStatuses.get(server.id);
                                return (
                                  <button
                                    key={server.id}
                                    type="button"
                                    className="flex items-center justify-between w-full cursor-pointer rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground border-none bg-transparent transition-colors"
                                    onClick={() => toggleServerEnabled(server.id)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{server.name}</span>
                                      {!serverStatus?.connected && (
                                        <span className="text-xs text-muted-foreground">
                                          {serverStatus?.error ? '⚠️ Error' : '○ Disconnected'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex size-4 items-center justify-center">
                                      {server.enabled && (
                                        <div className="size-2 rounded-full bg-primary" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Right side: Input actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={handleVoiceInput}
                        disabled={status === 'submitted' || status === 'streaming'}
                        title="Start voice input"
                      >
                        <MicIcon size={16} />
                      </Button>

                      {/* Submit button - prominent style */}
                      <PromptInputSubmit
                        disabled={!input.trim() || status === 'streaming'}
                        status={status}
                        variant="default"
                        size="icon"
                        className="h-9 w-9 shrink-0 bg-primary hover:bg-primary/90"
                      />
                    </div>
                  </>
                )}
              </PromptInputToolbar>
            </PromptInput>
          </div>
        </div>
      </div>

      {/* Permission Request Dialog */}
      {pendingPermissionRequest && (
        <Dialog
          open={!!pendingPermissionRequest}
          onOpenChange={(open) => {
            if (!open) {
              // User closed dialog - treat as reject once
              const rejectOption = pendingPermissionRequest.options.find(
                (opt) => opt.kind === 'reject_once'
              );
              if (rejectOption) {
                handlePermissionResponse(
                  pendingPermissionRequest.requestId,
                  rejectOption.id,
                  'reject_once'
                );
              }
              setPendingPermissionRequest(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{pendingPermissionRequest.title}</DialogTitle>
              {pendingPermissionRequest.description && (
                <DialogDescription>{pendingPermissionRequest.description}</DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4">
              {/* File Path */}
              {pendingPermissionRequest.path && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">File Path</div>
                  <code className="text-sm">{pendingPermissionRequest.path}</code>
                </div>
              )}

              {/* Diff Preview */}
              {pendingPermissionRequest.diff && (
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Changes</div>
                  <div className="font-mono text-xs space-y-1 max-h-[300px] overflow-y-auto">
                    {pendingPermissionRequest.diff.oldText && (
                      <div className="text-red-600 dark:text-red-400">
                        - {pendingPermissionRequest.diff.oldText}
                      </div>
                    )}
                    <div className="text-green-600 dark:text-green-400">
                      + {pendingPermissionRequest.diff.newText}
                    </div>
                  </div>
                </div>
              )}

              {/* Permission Options */}
              <div className="grid grid-cols-2 gap-2">
                {pendingPermissionRequest.options.map((option) => (
                  <Button
                    key={option.id}
                    variant={option.kind.startsWith('allow') ? 'default' : 'destructive'}
                    onClick={() =>
                      handlePermissionResponse(
                        pendingPermissionRequest.requestId,
                        option.id,
                        option.kind
                      )
                    }
                    className="w-full flex flex-col items-center justify-center h-auto py-3"
                  >
                    <span className="font-semibold">{option.label}</span>
                    {option.description && (
                      <span className="text-xs opacity-70 mt-1">{option.description}</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
