import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

const CONVERSATIONS_STORAGE_KEY = 'chat_conversations';
const CURRENT_CONVERSATION_KEY = 'current_conversation_id';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: Array<{
    type: 'text' | 'reasoning' | string;
    text?: string;
    toolName?: string;
    input?: Record<string, unknown>;
    output?: unknown;
    state?: 'input-available' | 'input-streaming' | 'output-available' | 'output-error';
    errorText?: string;
  }>;
  timestamp: number;
  provider?: 'openai' | 'anthropic'; // Track which provider generated this message
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

class ConversationStorage {
  private conversations: Map<string, Conversation> = new Map();
  private currentConversationId: string | null = null;

  async initialize(): Promise<void> {
    try {
      // Load all conversations
      const result = await SecureStoragePlugin.get({ key: CONVERSATIONS_STORAGE_KEY });
      if (result?.value) {
        const conversationsArray = JSON.parse(result.value) as Conversation[];
        this.conversations = new Map(conversationsArray.map((c) => [c.id, c]));
      }

      // Load current conversation ID
      const currentResult = await SecureStoragePlugin.get({ key: CURRENT_CONVERSATION_KEY });
      if (currentResult?.value) {
        this.currentConversationId = currentResult.value;
      }

      // If no current conversation, create a new one
      if (!this.currentConversationId || !this.conversations.has(this.currentConversationId)) {
        await this.createNewConversation();
      }
    } catch (error) {
      console.error('Failed to initialize conversation storage:', error);
      // Create a new conversation if initialization fails
      await this.createNewConversation();
    }
  }

  async createNewConversation(): Promise<Conversation> {
    const now = Date.now();
    const newConversation: Conversation = {
      id: `conv_${now}_${Math.random().toString(36).substr(2, 9)}`,
      title: 'New Conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    this.conversations.set(newConversation.id, newConversation);
    this.currentConversationId = newConversation.id;

    await this.save();
    return newConversation;
  }

  async getCurrentConversation(): Promise<Conversation | null> {
    if (!this.currentConversationId) return null;
    return this.conversations.get(this.currentConversationId) || null;
  }

  async setCurrentConversation(conversationId: string): Promise<void> {
    if (!this.conversations.has(conversationId)) {
      throw new Error('Conversation not found');
    }
    this.currentConversationId = conversationId;
    await SecureStoragePlugin.set({
      key: CURRENT_CONVERSATION_KEY,
      value: conversationId,
    });
  }

  async addMessage(message: Message): Promise<void> {
    const conversation = await this.getCurrentConversation();
    if (!conversation) {
      throw new Error('No current conversation');
    }

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();

    // Auto-generate title after first user message
    if (
      conversation.messages.length === 1 &&
      message.role === 'user' &&
      conversation.title === 'New Conversation'
    ) {
      // Don't await this - let it run in background
      this.generateConversationTitle(conversation.id).catch((error) => {
        console.error('Failed to generate conversation title:', error);
      });
    }

    await this.save();
  }

  async updateMessages(messages: Message[]): Promise<void> {
    const conversation = await this.getCurrentConversation();
    if (!conversation) {
      throw new Error('No current conversation');
    }

    conversation.messages = messages;
    conversation.updatedAt = Date.now();

    // Auto-generate title if this is the first update with messages
    if (messages.length > 0 && conversation.title === 'New Conversation') {
      const firstUserMessage = messages.find((m) => m.role === 'user');
      if (firstUserMessage) {
        // Don't await this - let it run in background
        this.generateConversationTitle(conversation.id).catch((error) => {
          console.error('Failed to generate conversation title:', error);
        });
      }
    }

    await this.save();
  }

  async generateConversationTitle(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.messages.length === 0) return;

    try {
      // Get title model preference (defaults to 'same' which means use current provider)
      const titleModelResult = await SecureStoragePlugin.get({ key: 'title_model' });
      const titleModel = titleModelResult?.value || 'same';

      // Determine which provider and model to use
      let providerType: 'openai' | 'anthropic';
      let modelName: string;
      let apiKey: string;

      if (titleModel === 'same') {
        // Use current provider
        const providerResult = await SecureStoragePlugin.get({ key: 'selected_provider' });
        providerType = (providerResult?.value as 'openai' | 'anthropic') || 'openai';

        const selectedModelResult = await SecureStoragePlugin.get({ key: 'selected_model' });
        modelName = selectedModelResult?.value || 'gpt-4o-mini';

        // Get the appropriate API key
        const keyResult = await SecureStoragePlugin.get({
          key: providerType === 'openai' ? 'openai_api_key' : 'anthropic_api_key',
        });
        if (!keyResult?.value) {
          console.warn(`No API key available for ${providerType} title generation`);
          return;
        }
        apiKey = keyResult.value;
      } else {
        // Use specific model
        modelName = titleModel;

        // Determine provider based on model name
        if (modelName.startsWith('claude-')) {
          providerType = 'anthropic';
          const anthropicKeyResult = await SecureStoragePlugin.get({ key: 'anthropic_api_key' });
          if (!anthropicKeyResult?.value) {
            console.warn('No Anthropic API key available for title generation');
            return;
          }
          apiKey = anthropicKeyResult.value;
        } else {
          providerType = 'openai';
          const openaiKeyResult = await SecureStoragePlugin.get({ key: 'openai_api_key' });
          if (!openaiKeyResult?.value) {
            console.warn('No OpenAI API key available for title generation');
            return;
          }
          apiKey = openaiKeyResult.value;
        }
      }

      // Get the first few messages for context (max 3)
      const contextMessages = conversation.messages.slice(0, 3);
      const contextText = contextMessages
        .map((msg) => {
          const textPart = msg.parts.find((p) => p.type === 'text');
          return textPart?.text || '';
        })
        .filter((text) => text.trim())
        .join('\n');

      if (!contextText.trim()) return;

      // Create the appropriate provider client
      const providerClient =
        providerType === 'openai' ? createOpenAI({ apiKey }) : createAnthropic({ apiKey });

      const result = await generateText({
        model: providerClient(modelName),
        messages: [
          {
            role: 'system',
            content:
              'Generate a short, concise title (max 5 words) for this conversation. Respond with only the title, no quotes or extra text.',
          },
          {
            role: 'user',
            content: `Conversation excerpt:\n${contextText}`,
          },
        ],
      });

      const title = result.text.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present

      // Update the conversation title
      conversation.title = title;
      conversation.updatedAt = Date.now();
      await this.save();
    } catch (error) {
      console.error('Failed to generate title:', error);
      // Fallback: use first few words of first message
      const firstUserMessage = conversation.messages.find((m) => m.role === 'user');
      if (firstUserMessage) {
        const textPart = firstUserMessage.parts.find((p) => p.type === 'text');
        if (textPart?.text) {
          const words = textPart.text.split(' ').slice(0, 5).join(' ');
          conversation.title = words + (textPart.text.split(' ').length > 5 ? '...' : '');
          await this.save();
        }
      }
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    this.conversations.delete(conversationId);

    // If we deleted the current conversation, switch to another or create new
    if (this.currentConversationId === conversationId) {
      const conversations = this.getAllConversations();
      if (conversations.length > 0) {
        this.currentConversationId = conversations[0].id;
      } else {
        await this.createNewConversation();
      }
    }

    await this.save();
  }

  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    conversation.title = title.trim() || 'New Conversation';
    conversation.updatedAt = Date.now();
    await this.save();
  }

  private async save(): Promise<void> {
    try {
      const conversationsArray = Array.from(this.conversations.values());
      await SecureStoragePlugin.set({
        key: CONVERSATIONS_STORAGE_KEY,
        value: JSON.stringify(conversationsArray),
      });

      if (this.currentConversationId) {
        await SecureStoragePlugin.set({
          key: CURRENT_CONVERSATION_KEY,
          value: this.currentConversationId,
        });
      }
    } catch (error) {
      console.error('Failed to save conversations:', error);
      throw error;
    }
  }
}

export const conversationStorage = new ConversationStorage();
