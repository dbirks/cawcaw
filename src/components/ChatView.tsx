import { createOpenAI } from '@ai-sdk/openai';
import { generateText, stepCountIs, tool, experimental_transcribe as transcribe } from 'ai';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import {
  BotIcon,
  Loader2Icon,
  MicIcon,
  MicOffIcon,
  Settings as SettingsIcon,
  User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
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
import { McpIcon } from '@/components/icons/McpIcon';
import { OpenAIIcon } from '@/components/icons/OpenAIIcon';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LoadingMessage } from '@/components/ui/bouncing-dots';
// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { mcpManager } from '@/services/mcpManager';
import type { MCPServerConfig, MCPServerStatus } from '@/types/mcp';
import Settings from './Settings';

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
}

export default function ChatView() {
  // Existing state
  const [apiKey, setApiKey] = useState<string>('');
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(true);
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  // const [isLoading, setIsLoading] = useState<boolean>(false); // Replaced with status state
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // New state for AI Elements features
  const [availableServers, setAvailableServers] = useState<MCPServerConfig[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Map<string, MCPServerStatus>>(new Map());
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  const [status, setStatus] = useState<'ready' | 'submitted' | 'streaming' | 'error'>('ready');
  const [mcpPopoverOpen, setMcpPopoverOpen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [currentRecording, setCurrentRecording] = useState<{
    mediaRecorder: MediaRecorder;
    stream: MediaStream;
  } | null>(null);

  // Ref for auto-scrolling to latest messages
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if we have a stored API key and initialize MCP
    const initialize = async () => {
      try {
        // Load API key
        const result = await SecureStoragePlugin.get({ key: 'openai_api_key' });
        if (result?.value) {
          setApiKey(result.value);
          setShowApiKeyInput(false);
        }

        // Load selected model
        const modelResult = await SecureStoragePlugin.get({ key: 'selected_model' });
        if (modelResult?.value) {
          setSelectedModel(modelResult.value);
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
    };
    setMessages((prev) => [...prev, userMessage]);

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
    };
    setMessages((prev) => [...prev, systemMessage]);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !apiKey) return;

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
    };

    setMessages((prev) => [...prev, userMessage]);
    setStatus('submitted');

    try {
      const openai = createOpenAI({ apiKey });

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
        model: openai(selectedModel),
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
      };

      setMessages((prev) => [...prev, assistantMessage]);
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
      };

      setMessages((prev) => [...prev, errorMessage]);
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

          // Transcribe using OpenAI Whisper
          const openai = createOpenAI({ apiKey });
          const transcript = await transcribe({
            model: openai.transcription('whisper-1'), // Use Whisper model
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
  const scrollToBottom = () => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  };

  // Scroll to bottom when messages change or status changes
  useEffect(() => {
    // Scroll when:
    // 1. New messages are added
    // 2. AI starts streaming (status becomes 'streaming')
    // 3. AI finishes streaming (status becomes 'ready')
    scrollToBottom();
  }, [messages.length, status]);

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
    <div className="h-dvh bg-background flex flex-col">
      {/* Fixed Header with safe area */}
      <div className="border-b pb-4 pt-8 flex justify-between items-center safe-top safe-x flex-shrink-0">
        <h1 className="text-xl font-semibold">caw caw</h1>
        <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
          <SettingsIcon className="h-4 w-4" />
        </Button>
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
                              {(part.state === 'input-streaming' || part.state === 'input-available') && (
                                <div className="p-4">
                                  <LoadingMessage message="Running tool" />
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
                      <AvatarFallback className="bg-black text-white dark:bg-white dark:text-black">
                        <OpenAIIcon size={16} />
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
                      <LoadingMessage message="AI is thinking" />
                    </div>
                  </MessageContent>
                  <Avatar className="size-8 ring ring-1 ring-border">
                    <AvatarFallback className="bg-black text-white dark:bg-white dark:text-black">
                      <OpenAIIcon size={16} />
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
          className={
            isRecording
              ? 'ring-2 ring-red-500 ring-opacity-50 shadow-lg shadow-red-200 dark:shadow-red-900/20'
              : ''
          }
        >
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isRecording ? "🎤 Recording... Click 'Stop' to finish" : 'Type your message...'
            }
            disabled={isRecording || status === 'streaming'}
            className={isRecording ? 'bg-red-50 dark:bg-red-950/20' : ''}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              {/* MCP Server selector */}
              <Popover open={mcpPopoverOpen} onOpenChange={setMcpPopoverOpen}>
                <PopoverTrigger asChild>
                  <PromptInputButton>
                    <McpIcon size={16} />
                    <span className="hidden md:inline">Model Context Protocol</span>
                    <span className="hidden sm:inline md:hidden">
                      {(() => {
                        const enabledCount = availableServers.filter((s) => s.enabled).length;
                        return enabledCount === 0
                          ? 'No tools'
                          : enabledCount === 1
                            ? '1 tool'
                            : `${enabledCount} tools`;
                      })()}
                    </span>
                  </PromptInputButton>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-1">
                    {availableServers.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No servers configured
                      </div>
                    ) : (
                      availableServers.map((server) => {
                        const status = serverStatuses.get(server.id);
                        return (
                          <button
                            key={server.id}
                            type="button"
                            className="flex items-center justify-between w-full cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground border-none bg-transparent"
                            onClick={() => toggleServerEnabled(server.id)}
                          >
                            <div className="flex items-center gap-2">
                              <span>{server.name}</span>
                              {!status?.connected && (
                                <span className="text-xs text-muted-foreground">
                                  {status?.error ? 'Error' : 'Disconnected'}
                                </span>
                              )}
                            </div>
                            <div className="flex size-4 items-center justify-center">
                              {server.enabled && <div className="size-2 rounded-full bg-primary" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {/* Enhanced Microphone button with recording state */}
              <PromptInputButton
                type="button"
                onClick={handleVoiceInput}
                disabled={status === 'submitted' && !isRecording}
                variant={isRecording ? 'default' : 'ghost'}
                className={
                  isRecording ? 'bg-red-500 text-white animate-pulse hover:bg-red-600' : ''
                }
              >
                {isRecording ? (
                  <MicOffIcon size={16} />
                ) : status === 'submitted' && !isRecording ? (
                  <Loader2Icon size={16} className="animate-spin" />
                ) : (
                  <MicIcon size={16} />
                )}
                <span className="hidden sm:inline">
                  {isRecording
                    ? 'Stop'
                    : status === 'submitted' && !isRecording
                      ? 'Processing...'
                      : 'Mic'}
                </span>
              </PromptInputButton>
              {/* Model selector */}
              <PromptInputModelSelect value={selectedModel} onValueChange={handleModelSelect}>
                <PromptInputModelSelectTrigger>
                  <BotIcon size={16} />
                  <div className="hidden sm:block">
                    <PromptInputModelSelectValue placeholder="Select model" />
                  </div>
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  <PromptInputModelSelectItem value="gpt-4.1">gpt-4.1</PromptInputModelSelectItem>
                  <PromptInputModelSelectItem value="gpt-4.1-mini">
                    gpt-4.1-mini
                  </PromptInputModelSelectItem>
                  <PromptInputModelSelectItem value="gpt-4o">gpt-4o</PromptInputModelSelectItem>
                  <PromptInputModelSelectItem value="gpt-4o-mini">
                    gpt-4o-mini
                  </PromptInputModelSelectItem>
                  <PromptInputModelSelectItem value="o4-mini">o4-mini</PromptInputModelSelectItem>
                  <PromptInputModelSelectItem value="o3">o3</PromptInputModelSelectItem>
                  <PromptInputModelSelectItem value="o3-mini">o3-mini</PromptInputModelSelectItem>
                  <PromptInputModelSelectItem value="gpt-4o-with-web-search">
                    gpt-4o + Web Search
                  </PromptInputModelSelectItem>
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
            </PromptInputTools>
            <PromptInputSubmit disabled={!input.trim() || status === 'streaming'} status={status} />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}
