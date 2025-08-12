import { useState, useEffect } from 'react';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function ChatView() {
  const [apiKey, setApiKey] = useState<string>('');
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(true);
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Check if we have a stored API key
    const stored = localStorage.getItem('openai_api_key');
    if (stored) {
      setApiKey(stored);
      setShowApiKeyInput(false);
    }
  }, []);

  const saveApiKey = () => {
    if (tempApiKey.trim()) {
      setApiKey(tempApiKey);
      localStorage.setItem('openai_api_key', tempApiKey);
      setShowApiKeyInput(false);
    }
  };

  const clearApiKey = () => {
    setApiKey('');
    setTempApiKey('');
    localStorage.removeItem('openai_api_key');
    setShowApiKeyInput(true);
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
      const { text } = await generateText({
        model: openai('gpt-3.5-turbo'),
        messages: [...messages, userMessage].map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: text,
      };

      setMessages(prev => [...prev, assistantMessage]);
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

  if (showApiKeyInput) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-2xl font-bold text-center">AI Chat App</h2>
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">AI Chat</h1>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={clearApiKey}
        >
          Change API Key
        </Button>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2 max-w-3xl mx-auto">
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
                <Card className={`max-w-[80%] ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  <CardContent className="p-3">
                    <p className="whitespace-pre-wrap">{message.content}</p>
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
              <Card className="bg-muted">
                <CardContent className="p-3">
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