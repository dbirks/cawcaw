import { useState, useEffect } from 'react';
import { generateText, tool, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Settings, Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import MCPSettings from './MCPSettings';
import { mcpManager } from '@/services/mcpManager';
import MarkdownRenderer from './MathRenderer';

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
}

export default function ChatView() {
  const [apiKey, setApiKey] = useState<string>('');
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(true);
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());

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

  const clearApiKey = async () => {
    try {
      await SecureStoragePlugin.remove({ key: 'openai_api_key' });
      setApiKey('');
      setTempApiKey('');
      setShowApiKeyInput(true);
    } catch (error) {
      console.error('Failed to clear API key:', error);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !apiKey) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const openai = createOpenAI({ apiKey });
      
      // Create demo tools for testing MCP functionality (works on mobile)
      const tools = {
        calculator: tool({
          description: 'Perform basic mathematical calculations',
          inputSchema: z.object({
            expression: z.string().describe('Mathematical expression to evaluate (e.g., "2 + 2", "10 * 5")')
          }),
          execute: async ({ expression }: { expression: string }) => {
            try {
              // Simple safe evaluation for demo purposes
              const result = Function(`"use strict"; return (${expression.replace(/[^0-9+\-*/.() ]/g, '')})`)();
              return { calculation: expression, result: result.toString() };
            } catch {
              return { calculation: expression, result: 'Error: Invalid expression' };
            }
          }
        }),
        timeInfo: tool({
          description: 'Get current time and date information',
          inputSchema: z.object({
            timezone: z.string().optional().describe('Timezone (optional, defaults to local)')
          }),
          execute: async ({ timezone }: { timezone?: string }) => {
            const now = new Date();
            return {
              currentTime: now.toLocaleString(),
              timestamp: now.getTime(),
              timezone: timezone || 'local'
            };
          }
        }),
        textAnalyzer: tool({
          description: 'Analyze text for word count, character count, etc.',
          inputSchema: z.object({
            text: z.string().describe('Text to analyze')
          }),
          execute: async ({ text }: { text: string }) => {
            return {
              text: text,
              wordCount: text.split(/\s+/).filter((word: string) => word.length > 0).length,
              characterCount: text.length,
              characterCountNoSpaces: text.replace(/\s/g, '').length
            };
          }
        })
      };

      const result = await generateText({
        model: openai('gpt-4o-mini'),
        messages: [...messages, userMessage].map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        tools,
        stopWhen: stepCountIs(5) // Enable multi-step: AI can use tools and then respond
      });

      // Extract tool calls from the result (multi-step approach)
      const toolCalls: ToolCall[] = [];
      if (result.steps) {
        for (const step of result.steps) {
          if (step.toolCalls) {
            for (const toolCall of step.toolCalls) {
              const toolResult = step.toolResults?.find(r => r.toolCallId === toolCall.toolCallId);
              toolCalls.push({
                id: toolCall.toolCallId,
                name: toolCall.toolName,
                input: ((toolCall as any).input || (toolCall as any).args || (toolCall as any).arguments || {}) as Record<string, unknown>,
                result: toolResult
              });
            }
          }
        }
      }

      const newMessages: Message[] = [];

      // Add tool calls as separate message if they exist
      if (toolCalls.length > 0) {
        const toolCallMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '', // Empty content for tool-only message
          toolCalls: toolCalls
        };
        newMessages.push(toolCallMessage);
      }

      // Add AI response as separate message if there's text content
      if (result.text && result.text.trim()) {
        const assistantMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: result.text
        };
        newMessages.push(assistantMessage);
      }

      setMessages(prev => [...prev, ...newMessages]);
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your API key and try again.',
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleToolCallExpansion = (toolCallId: string) => {
    const newExpanded = new Set(expandedToolCalls);
    if (newExpanded.has(toolCallId)) {
      newExpanded.delete(toolCallId);
    } else {
      newExpanded.add(toolCallId);
    }
    setExpandedToolCalls(newExpanded);
  };

  const ToolCallDisplay = ({ toolCall }: { toolCall: ToolCall }) => {
    const isExpanded = expandedToolCalls.has(toolCall.id);
    
    return (
      <div className="mt-2">
        <button
          onClick={() => toggleToolCallExpansion(toolCall.id)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <Wrench className="h-3 w-3" />
          <span className="font-mono">{toolCall.name}</span>
        </button>
        
        {isExpanded && (
          <div className="mt-2 p-3 bg-muted rounded-md text-xs space-y-2">
            <div>
              <span className="font-medium text-foreground">Input:</span>
              <pre className="mt-1 overflow-x-auto">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
            {toolCall.result !== undefined && toolCall.result !== null && (
              <div>
                <span className="font-medium text-foreground">Result:</span>
                <pre className="mt-1 overflow-x-auto">
                  {typeof toolCall.result === 'string' 
                    ? toolCall.result 
                    : JSON.stringify(toolCall.result, null, 2)
                  }
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Show MCP Settings screen
  if (showSettings) {
    return <MCPSettings onClose={() => setShowSettings(false)} />;
  }

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
              <Button 
                onClick={saveApiKey} 
                className="w-full"
                disabled={!tempApiKey.trim()}
              >
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
      {/* Header */}
      <div className="border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">caw caw</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearApiKey}
          >
            Change API Key
          </Button>
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1">
        <div className="min-h-full flex flex-col justify-end p-2">
          <div className="space-y-3 max-w-3xl mx-auto w-full">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Start a conversation with AI</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}>
                {message.role === 'assistant' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                )}
                <Card className={`max-w-[80%] py-0 rounded-2xl ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-muted'
                }`}>
                  <CardContent className="px-3 py-2">
                    {message.content && (
                      <div>
                        <MarkdownRenderer content={message.content} />
                      </div>
                    )}
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className={`space-y-1 ${message.content ? 'mt-2' : ''}`}>
                        {message.toolCalls.map((toolCall) => (
                          <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                {message.role === 'user' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>You</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8">
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <Card className="bg-muted py-0 rounded-2xl">
                <CardContent className="px-3 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          </div>
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4">
        <form onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage(input);
            setInput('');
          }
        }} className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[44px] resize-none"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) {
                    sendMessage(input);
                    setInput('');
                  }
                }
              }}
            />
            <Button type="submit" disabled={!input.trim() || isLoading}>
              Send
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}