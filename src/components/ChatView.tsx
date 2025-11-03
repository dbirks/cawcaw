import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, stepCountIs, tool, experimental_transcribe as transcribe } from 'ai';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import {
  BotIcon,
  CheckIcon,
  Loader2Icon,
  MicIcon,
  MicOffIcon,
  PencilIcon,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SelectGroup, SelectLabel } from '@/components/ui/select';

import { cn } from '@/lib/utils';
import { conversationStorage, type Message as StoredMessage } from '@/services/conversationStorage';
import { mcpManager } from '@/services/mcpManager';
import type { MCPServerConfig, MCPServerStatus } from '@/types/mcp';
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
  provider?: 'openai' | 'anthropic'; // Track which provider generated this message
}

export default function ChatView() {
  // Existing state
  const [apiKey, setApiKey] = useState<string>('');
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>('');
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(true);
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string>('New Chat');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [editedTitle, setEditedTitle] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'anthropic'>('openai');

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

  // Ref for auto-scrolling to latest messages
  const conversationRef = useRef<HTMLDivElement>(null);

  // Filter models based on available API keys
  const availableModels = useMemo(() => {
    const models = AVAILABLE_MODELS.filter((model) => {
      if (model.provider === 'openai') return !!apiKey;
      if (model.provider === 'anthropic') return !!anthropicApiKey;
      return false;
    });

    // If no API keys are set, show all models (for settings view)
    return models.length > 0 ? models : AVAILABLE_MODELS;
  }, [apiKey, anthropicApiKey]);

  useEffect(() => {
    // Check if we have a stored API key and initialize MCP
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

        // Load provider preference
        const providerResult = await SecureStoragePlugin.get({ key: 'selected_provider' });
        if (providerResult?.value) {
          setSelectedProvider(providerResult.value as 'openai' | 'anthropic');
        }

        // Load selected model
        const modelResult = await SecureStoragePlugin.get({ key: 'selected_model' });
        if (modelResult?.value) {
          setSelectedModel(modelResult.value);
        }

        // Load STT model preference
        const sttModelResult = await SecureStoragePlugin.get({ key: 'stt_model' });
        if (sttModelResult?.value) {
          setSttModel(sttModelResult.value);
        }

        // Initialize conversation storage
        await conversationStorage.initialize();

        // Load current conversation
        const currentConversation = await conversationStorage.getCurrentConversation();
        if (currentConversation) {
          setCurrentConversationId(currentConversation.id);
          setMessages(currentConversation.messages);
          setConversationTitle(currentConversation.title);
        }

        // Initialize MCP servers and load data
        await mcpManager.loadConfigurations();
        await mcpManager.connectToEnabledServers();

        // Load server data for compact selector
        const servers = mcpManager.getServerConfigs();
        const statuses = mcpManager.getServerStatuses();
        setAvailableServers(servers);
        setServerStatuses(statuses);
      } catch (error) {
        console.log('Initialization error:', error);
      }
    };
    initialize();

    // Cleanup MCP connections on unmount
    return () => {
      mcpManager.cleanup();
    };
  }, []);

  // Update selected model when API keys change to ensure it's valid
  useEffect(() => {
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
  }, [apiKey, anthropicApiKey, availableModels, selectedModel]);

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
      // Save to conversation storage
      conversationStorage.updateMessages(newMessages as StoredMessage[]).catch((error) => {
        console.error('Failed to save message:', error);
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

  const addSystemMessage = (content: string) => {
    const systemMessage: UIMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      parts: [{ type: 'text', text: content }],
      timestamp: Date.now(),
    };
    setMessages((prev) => {
      const newMessages = [...prev, systemMessage];
      // Save to conversation storage
      conversationStorage.updateMessages(newMessages as StoredMessage[]).catch((error) => {
        console.error('Failed to save message:', error);
      });
      return newMessages;
    });
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Check if we have the appropriate API key for the selected provider
    const currentApiKey = selectedProvider === 'openai' ? apiKey : anthropicApiKey;
    if (!currentApiKey) {
      console.error(`No API key available for provider: ${selectedProvider}`);
      return;
    }

    const trimmedContent = content.trim();

    // Check for /mcp command - handle various forms
    if (trimmedContent.toLowerCase().startsWith('/mcp')) {
      await handleMcpCommand(trimmedContent);
      return;
    }

    // Create user message with parts structure
    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ type: 'text', text: trimmedContent }],
      timestamp: Date.now(),
    };

    setMessages((prev) => {
      const newMessages = [...prev, userMessage];
      // Save to conversation storage
      conversationStorage.updateMessages(newMessages as StoredMessage[]).catch((error) => {
        console.error('Failed to save message:', error);
      });
      return newMessages;
    });
    setStatus('submitted');

    try {
      // Create the appropriate provider client
      const providerClient =
        selectedProvider === 'openai'
          ? createOpenAI({ apiKey: currentApiKey })
          : createAnthropic({ apiKey: currentApiKey });

      // Get tools from MCP manager
      const mcpTools = await mcpManager.getAllTools();
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

      setStatus('streaming');

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

      setMessages((prev) => {
        const newMessages = [...prev, assistantMessage];
        // Save to conversation storage
        conversationStorage.updateMessages(newMessages as StoredMessage[]).catch((error) => {
          console.error('Failed to save message:', error);
        });
        return newMessages;
      });
      setStatus('ready');
    } catch (error) {
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
        // Save to conversation storage
        conversationStorage.updateMessages(newMessages as StoredMessage[]).catch((error) => {
          console.error('Failed to save message:', error);
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
      currentRecording.mediaRecorder.stop();
      return;
    }

    try {
      // Request microphone permission and start recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create MediaRecorder to capture audio
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      // Collect audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      // Handle recording completion
      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setCurrentRecording(null);
        try {
          // Create audio blob from chunks
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });

          // Convert to ArrayBuffer for transcription
          const audioData = new Uint8Array(await audioBlob.arrayBuffer());

          // Set processing status
          setStatus('submitted');

          // Transcribe using OpenAI Whisper (always use OpenAI for transcription)
          if (!apiKey) {
            console.error('No OpenAI API key available for transcription');
            setStatus('error');
            return;
          }

          const openai = createOpenAI({ apiKey });
          const transcript = await transcribe({
            model: openai.transcription(sttModel), // Use selected STT model from settings
            audio: audioData,
          });

          const transcribedText = transcript.text?.trim();
          if (transcribedText) {
            // Send the transcribed message
            await sendMessage(transcribedText);
          } else {
            setStatus('error');
          }
        } catch (error) {
          console.error('Transcription error:', error);
          setStatus('error');
        } finally {
          // Stop all tracks to release microphone
          stream.getTracks().forEach((track) => {
            track.stop();
          });
        }
      };

      // Start recording until manually stopped
      mediaRecorder.start();
      setIsRecording(true);
      setCurrentRecording({ mediaRecorder, stream });
    } catch (error) {
      console.error('Voice input error:', error);
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
  const scrollToBottom = useCallback(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, []);

  // Scroll to bottom when messages change or status changes
  useEffect(() => {
    // Scroll when:
    // 1. New messages are added
    // 2. AI starts streaming (status becomes 'streaming')
    // 3. AI finishes streaming (status becomes 'ready')
    scrollToBottom();
  }, [scrollToBottom]);

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

  const handleNewConversation = async () => {
    // Don't create a new conversation here - Sidebar already created it
    // Just load the current conversation from storage (matches handleSelectConversation pattern)
    const conversation = await conversationStorage.getCurrentConversation();
    if (conversation) {
      setCurrentConversationId(conversation.id);
      setConversationTitle(conversation.title);
      setMessages(conversation.messages);
      setInput('');
    }
  };

  const handleSelectConversation = async (_conversationId: string) => {
    const conversation = await conversationStorage.getCurrentConversation();
    if (conversation) {
      setCurrentConversationId(conversation.id);
      setConversationTitle(conversation.title);
      setMessages(conversation.messages);
    }
  };

  const handleEditTitle = () => {
    setEditedTitle(conversationTitle);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    if (!currentConversationId) return;

    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== conversationTitle) {
      try {
        await conversationStorage.updateConversationTitle(currentConversationId, trimmed);
        setConversationTitle(trimmed);
      } catch (error) {
        console.error('Failed to update title:', error);
      }
    }
    setIsEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setIsEditingTitle(false);
    setEditedTitle('');
  };

  // Show Settings screen
  if (showSettings) {
    return <Settings onClose={() => setShowSettings(false)} />;
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
      <div className="flex-1 flex flex-col h-full">
        {/* Fixed Header with safe area */}
        <div className="border-b pb-3 pt-4 px-4 flex justify-between items-center safe-top flex-shrink-0">
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
                  className="h-8 text-base font-semibold"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleSaveTitle}
                >
                  <CheckIcon className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <h1 className="text-xl font-semibold truncate">{conversationTitle}</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-0 hover:opacity-100 transition-opacity"
                  onClick={handleEditTitle}
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Main Conversation - scrollable area */}
        <div ref={conversationRef} className="flex-1 overflow-auto">
          <Conversation className="px-4">
            <ConversationContent className="safe-x h-full">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>Start a conversation with AI</p>
                </div>
              ) : (
                <div className="space-y-4">
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
                                    <ToolOutput
                                      output={
                                        <Response>
                                          {typeof part.output === 'object' && part.output !== null
                                            ? JSON.stringify(part.output, null, 2)
                                            : String(part.output || '')}
                                        </Response>
                                      }
                                      errorText={part.errorText}
                                    />
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
                      </MessageContent>
                      {message.role === 'assistant' ? (
                        <Avatar className="size-8 ring ring-1 ring-border">
                          <AvatarFallback
                            className={
                              message.provider === 'anthropic'
                                ? 'bg-[#C15F3C] text-white'
                                : 'bg-black text-white dark:bg-white dark:text-black'
                            }
                          >
                            {message.provider === 'anthropic' ? (
                              <AnthropicIcon size={16} />
                            ) : (
                              <OpenAIIcon size={16} />
                            )}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
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
                      <Avatar className="size-8 ring ring-1 ring-border">
                        <AvatarFallback
                          className={
                            selectedProvider === 'anthropic'
                              ? 'bg-[#C15F3C] text-white'
                              : 'bg-black text-white dark:bg-white dark:text-black'
                          }
                        >
                          {selectedProvider === 'anthropic' ? (
                            <AnthropicIcon size={16} />
                          ) : (
                            <OpenAIIcon size={16} />
                          )}
                        </AvatarFallback>
                      </Avatar>
                    </Message>
                  )}
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>

        {/* Fixed Input Area with safe area */}
        <div className="border-t pt-4 pb-6 safe-bottom safe-x flex-shrink-0">
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
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isRecording ? "🎤 Recording... Click 'Stop' to finish" : 'Type your message...'
              }
              disabled={isRecording || status === 'streaming'}
              className={cn('min-h-[48px]', isRecording && 'bg-red-50 dark:bg-red-950/20')}
            />
            <PromptInputToolbar className="flex items-center justify-between gap-2 p-2">
              {/* Left side: Contextual controls */}
              <div className="flex items-center gap-1">
                {/* Model selector - always visible with label */}
                <PromptInputModelSelect value={selectedModel} onValueChange={handleModelSelect}>
                  <PromptInputModelSelectTrigger className="h-9 gap-1.5">
                    <BotIcon size={14} className="shrink-0" />
                    <span className="text-xs font-medium">
                      <span className="hidden sm:inline">Model: </span>
                      <PromptInputModelSelectValue placeholder="Select model" />
                    </span>
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {availableModels.filter((m) => m.provider === 'openai').length > 0 && (
                      <SelectGroup>
                        <SelectLabel>OpenAI Models</SelectLabel>
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
                        <SelectLabel>Anthropic Models</SelectLabel>
                        {availableModels
                          .filter((m) => m.provider === 'anthropic')
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
                      className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <McpIcon size={14} className="shrink-0" />
                      <span className="text-xs font-medium">
                        {(() => {
                          const enabledCount = availableServers.filter((s) => s.enabled).length;
                          return enabledCount === 0
                            ? 'Tools'
                            : `${enabledCount} ${enabledCount === 1 ? 'Tool' : 'Tools'}`;
                        })()}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
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
              <div className="flex items-center gap-1">
                {/* Voice input - moved next to submit */}
                <Button
                  type="button"
                  variant={isRecording ? 'destructive' : 'ghost'}
                  size="icon"
                  className={cn('h-9 w-9 shrink-0 transition-all', isRecording && 'animate-pulse')}
                  onClick={handleVoiceInput}
                  disabled={status === 'submitted' && !isRecording}
                  title={isRecording ? 'Stop recording' : 'Start voice input'}
                >
                  {isRecording ? (
                    <MicOffIcon size={16} />
                  ) : status === 'submitted' && !isRecording ? (
                    <Loader2Icon size={16} className="animate-spin" />
                  ) : (
                    <MicIcon size={16} />
                  )}
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
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
