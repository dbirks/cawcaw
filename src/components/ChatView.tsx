import { createOpenAI } from '@ai-sdk/openai';
import { generateText, stepCountIs, tool, experimental_transcribe as transcribe } from 'ai';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { BotIcon, MicIcon, MicOffIcon, Settings as SettingsIcon, Loader2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { z } from 'zod';
// AI Elements imports
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageAvatar, MessageContent } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputButton,
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

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

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
  const [toolsModalOpen, setToolsModalOpen] = useState<boolean>(false);
  const [availableServers, setAvailableServers] = useState<MCPServerConfig[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Map<string, MCPServerStatus>>(new Map());
  const [modelModalOpen, setModelModalOpen] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  const [status, setStatus] = useState<'ready' | 'submitted' | 'streaming' | 'error'>('ready');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [currentRecording, setCurrentRecording] = useState<{
    mediaRecorder: MediaRecorder;
    stream: MediaStream;
  } | null>(null);

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

        // Initialize MCP servers
        await mcpManager.loadConfigurations();
        await mcpManager.connectToEnabledServers();
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

  const sendMessage = async (content: string) => {
    if (!content.trim() || !apiKey) return;

    // Create user message with parts structure
    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ type: 'text', text: content.trim() }],
    };

    setMessages((prev) => [...prev, userMessage]);
    setStatus('submitted');

    try {
      const openai = createOpenAI({ apiKey });

      // Get tools from MCP manager
      const mcpTools = await mcpManager.getAllTools();
      const tools: Record<string, ReturnType<typeof tool<any, any>>> = {};

      // Convert MCP tools to AI SDK format
      for (const [toolName, toolDef] of Object.entries(mcpTools)) {
        const inputSchema = toolDef.inputSchema || { type: 'object', properties: {} };
        
        tools[toolName] = tool({
          description: toolDef.description || `Tool from ${toolDef._mcpServerName}`,
          inputSchema: z.object(
            Object.fromEntries(
              Object.entries(inputSchema.properties || {}).map(([key, prop]) => [
                key,
                prop.type === 'string' 
                  ? z.string().describe(prop.description || key)
                  : prop.type === 'number'
                  ? z.number().describe(prop.description || key)
                  : z.unknown().describe(prop.description || key)
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

  const toggleToolsModal = async () => {
    if (!toolsModalOpen) {
      // Load server data when opening modal
      const servers = mcpManager.getServerConfigs();
      const statuses = mcpManager.getServerStatuses();
      setAvailableServers(servers);
      setServerStatuses(statuses);
    }
    setToolsModalOpen(!toolsModalOpen);
  };

  const toggleServerEnabled = async (serverId: string, enabled: boolean) => {
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

  const toggleModelModal = () => {
    setModelModalOpen(!modelModalOpen);
  };

  const handleModelSelect = async (modelId: string) => {
    setSelectedModel(modelId);
    setModelModalOpen(false);

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
      <Conversation className="flex-1 overflow-hidden px-4">
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
                              <ToolInput input={part.input} />
                              {part.state === 'output-available' && (
                                <ToolOutput
                                  output={<Response>{String(part.output || '')}</Response>}
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
                  <MessageAvatar
                    src={message.role === 'assistant' ? '/robot-icon.png' : '/user-icon.png'}
                    name={message.role === 'assistant' ? 'Assistant' : 'You'}
                  />
                </Message>
              ))}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Fixed Input Area with safe area */}
      <div className="border-t py-4 safe-bottom safe-x flex-shrink-0">
        <PromptInput 
          onSubmit={handleFormSubmit}
          className={isRecording ? 'ring-2 ring-red-500 ring-opacity-50 shadow-lg shadow-red-200 dark:shadow-red-900/20' : ''}
        >
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isRecording ? "🎤 Recording... Click 'Stop' to finish" : "Type your message..."}
            disabled={isRecording || status === 'streaming'}
            className={isRecording ? 'bg-red-50 dark:bg-red-950/20' : ''}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              {/* MCP Tools button */}
              <PromptInputButton type="button" onClick={toggleToolsModal}>
                <McpIcon size={16} />
                <span>MCP</span>
              </PromptInputButton>
              {/* Enhanced Microphone button with recording state */}
              <PromptInputButton 
                type="button" 
                onClick={handleVoiceInput}
                disabled={status === 'submitted' && !isRecording}
                variant={isRecording ? 'default' : 'ghost'}
                className={isRecording ? 'bg-red-500 text-white animate-pulse hover:bg-red-600' : ''}
              >
                {isRecording ? (
                  <MicOffIcon size={16} />
                ) : status === 'submitted' && !isRecording ? (
                  <Loader2Icon size={16} className="animate-spin" />
                ) : (
                  <MicIcon size={16} />
                )}
                <span>{isRecording ? 'Stop' : status === 'submitted' && !isRecording ? 'Processing...' : 'Mic'}</span>
              </PromptInputButton>
              {/* Model switcher button with text label */}
              <PromptInputButton type="button" onClick={toggleModelModal}>
                <BotIcon size={16} />
                <span>Model</span>
              </PromptInputButton>
            </PromptInputTools>
            <PromptInputSubmit disabled={!input.trim() || status === 'streaming'} status={status} />
          </PromptInputToolbar>
        </PromptInput>
      </div>

      {/* MCP Server Selection Modal */}
      <Dialog open={toolsModalOpen} onOpenChange={setToolsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>MCP Server Selection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enable or disable MCP servers to control which tools are available to the AI.
            </p>
            <div className="space-y-3">
              {availableServers.map((server) => {
                const status = serverStatuses.get(server.id);
                const isConnected = status?.connected || false;
                const toolCount = status?.toolCount || 0;
                const hasError = status?.error;

                return (
                  <div key={server.id} className="flex items-center justify-between py-3 px-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium">{server.name}</h4>
                        {server.readonly && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">Built-in</span>
                        )}
                        {isConnected && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            {toolCount} tools
                          </span>
                        )}
                        {hasError && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                            Error
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{server.description}</p>
                      {hasError && (
                        <p className="text-xs text-red-600 mt-1">{status.error}</p>
                      )}
                    </div>
                    <Switch
                      checked={server.enabled}
                      onCheckedChange={(enabled) => toggleServerEnabled(server.id, enabled)}
                    />
                  </div>
                );
              })}
              
              {availableServers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No MCP servers configured.</p>
                  <p className="text-xs mt-1">Go to Settings → Tools & MCP to add servers.</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setToolsModalOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Model Selection Modal */}
      <Dialog open={modelModalOpen} onOpenChange={setModelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select AI Model</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose an OpenAI model for chat conversations:
            </p>
            <div className="space-y-2">
              {/* GPT-4.1 Models */}
              <div className="space-y-1">
                <h4 className="text-sm font-medium">GPT-4.1 (Latest)</h4>
                <div className="space-y-1 ml-4">
                  <button
                    type="button"
                    onClick={() => handleModelSelect('gpt-4.1')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${
                      selectedModel === 'gpt-4.1' ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <div className="font-medium">GPT-4.1</div>
                    <div className="text-xs text-muted-foreground">Most capable, 1M context</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModelSelect('gpt-4.1-mini')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${
                      selectedModel === 'gpt-4.1-mini' ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <div className="font-medium">GPT-4.1 Mini</div>
                    <div className="text-xs text-muted-foreground">
                      Fast, cost-effective, beats GPT-4o
                    </div>
                  </button>
                </div>
              </div>

              {/* GPT-4o Models */}
              <div className="space-y-1">
                <h4 className="text-sm font-medium">GPT-4o (Multimodal)</h4>
                <div className="space-y-1 ml-4">
                  <button
                    type="button"
                    onClick={() => handleModelSelect('gpt-4o')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${
                      selectedModel === 'gpt-4o' ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <div className="font-medium">GPT-4o</div>
                    <div className="text-xs text-muted-foreground">Multimodal flagship model</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModelSelect('gpt-4o-mini')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${
                      selectedModel === 'gpt-4o-mini' ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <div className="font-medium">GPT-4o Mini</div>
                    <div className="text-xs text-muted-foreground">
                      Fast, affordable, 128K context
                    </div>
                  </button>
                </div>
              </div>

              {/* GPT-4 Models */}
              <div className="space-y-1">
                <h4 className="text-sm font-medium">GPT-4</h4>
                <div className="space-y-1 ml-4">
                  <button
                    type="button"
                    onClick={() => handleModelSelect('gpt-4-turbo')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${
                      selectedModel === 'gpt-4-turbo' ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <div className="font-medium">GPT-4 Turbo</div>
                    <div className="text-xs text-muted-foreground">
                      Optimized for speed and cost
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModelSelect('gpt-4')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${
                      selectedModel === 'gpt-4' ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <div className="font-medium">GPT-4</div>
                    <div className="text-xs text-muted-foreground">Original GPT-4</div>
                  </button>
                </div>
              </div>

              {/* o-series Reasoning Models */}
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Reasoning Models</h4>
                <div className="space-y-1 ml-4">
                  <button
                    type="button"
                    onClick={() => handleModelSelect('o1')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${
                      selectedModel === 'o1' ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <div className="font-medium">o1</div>
                    <div className="text-xs text-muted-foreground">Advanced reasoning</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModelSelect('o3-mini')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${
                      selectedModel === 'o3-mini' ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <div className="font-medium">o3 Mini</div>
                    <div className="text-xs text-muted-foreground">Compact reasoning model</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setModelModalOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
