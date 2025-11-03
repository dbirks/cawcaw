import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { Preferences } from '@capacitor/preferences';
import { generateText } from 'ai';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import {
  type ChatDb,
  appendMessage as dbAppendMessage,
  createConversation as dbCreateConversation,
  deleteConversation as dbDeleteConversation,
  getAllConversations as dbGetAllConversations,
  getConversation as dbGetConversation,
  getMessages as dbGetMessages,
  updateConversationTitle as dbUpdateConversationTitle,
  updateMessages as dbUpdateMessages,
  openChatDb,
} from './chatDb';

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

/**
 * ConversationStorage manages chat conversations using SQLite with WAL mode.
 *
 * Storage details:
 * - iOS: Database stored in Application Support (backed up by iCloud Backup)
 * - Android: Database stored in internal app storage
 * - WAL mode enabled for better concurrency and crash-safety
 * - Automatic checkpointing on app backgrounding
 */
class ConversationStorage {
  private db: ChatDb | null = null;
  private currentConversationId: string | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    // Prevent multiple concurrent initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        // Open SQLite database with WAL mode
        this.db = await openChatDb();

        // Load current conversation ID from Preferences (lightweight key-value store)
        const currentResult = await Preferences.get({ key: CURRENT_CONVERSATION_KEY });
        if (currentResult?.value) {
          this.currentConversationId = currentResult.value;
        }

        // If no current conversation or it doesn't exist, create a new one
        if (!this.currentConversationId) {
          await this.createNewConversation();
        } else {
          const conversation = await dbGetConversation(this.db, this.currentConversationId);
          if (!conversation) {
            await this.createNewConversation();
          }
        }
      } catch (error) {
        console.error('Failed to initialize conversation storage:', error);
        // Create a new conversation if initialization fails
        if (this.db) {
          await this.createNewConversation();
        }
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): ChatDb {
    if (!this.db) {
      throw new Error('ConversationStorage not initialized. Call initialize() first.');
    }
    return this.db;
  }

  async createNewConversation(): Promise<Conversation> {
    const db = this.ensureInitialized();
    const now = Date.now();
    const newConversation: Conversation = {
      id: `conv_${now}_${Math.random().toString(36).substr(2, 9)}`,
      title: 'New Conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    await dbCreateConversation(db, {
      id: newConversation.id,
      title: newConversation.title,
      createdAt: newConversation.createdAt,
    });

    this.currentConversationId = newConversation.id;
    await Preferences.set({
      key: CURRENT_CONVERSATION_KEY,
      value: newConversation.id,
    });

    return newConversation;
  }

  async getCurrentConversation(): Promise<Conversation | null> {
    if (!this.currentConversationId) return null;

    const db = this.ensureInitialized();
    const convRow = await dbGetConversation(db, this.currentConversationId);
    if (!convRow) return null;

    const messageRows = await dbGetMessages(db, this.currentConversationId);
    const messages: Message[] = messageRows.map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant' | 'system',
      parts: JSON.parse(row.parts),
      timestamp: row.created_at,
      provider: (row.provider as 'openai' | 'anthropic' | undefined) ?? undefined,
    }));

    return {
      id: convRow.id,
      title: convRow.title ?? 'New Conversation',
      messages,
      createdAt: convRow.created_at,
      updatedAt: convRow.updated_at,
    };
  }

  async setCurrentConversation(conversationId: string): Promise<void> {
    const db = this.ensureInitialized();
    const conversation = await dbGetConversation(db, conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    this.currentConversationId = conversationId;
    await Preferences.set({
      key: CURRENT_CONVERSATION_KEY,
      value: conversationId,
    });
  }

  async addMessage(message: Message): Promise<void> {
    const conversation = await this.getCurrentConversation();
    if (!conversation) {
      throw new Error('No current conversation');
    }

    const db = this.ensureInitialized();
    await dbAppendMessage(db, {
      id: message.id,
      conversationId: conversation.id,
      role: message.role,
      parts: message.parts,
      createdAt: message.timestamp,
      provider: message.provider,
    });

    // Auto-generate title after first user message
    if (
      conversation.messages.length === 0 &&
      message.role === 'user' &&
      conversation.title === 'New Conversation'
    ) {
      // Don't await this - let it run in background
      this.generateConversationTitle(conversation.id).catch((error) => {
        console.error('Failed to generate conversation title:', error);
      });
    }
  }

  async updateMessages(messages: Message[]): Promise<void> {
    const conversation = await this.getCurrentConversation();
    if (!conversation) {
      throw new Error('No current conversation');
    }

    const db = this.ensureInitialized();
    await dbUpdateMessages(
      db,
      conversation.id,
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
        timestamp: m.timestamp,
        provider: m.provider,
      }))
    );

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
  }

  async generateConversationTitle(conversationId: string): Promise<void> {
    const db = this.ensureInitialized();
    const convRow = await dbGetConversation(db, conversationId);
    if (!convRow) return;

    const messageRows = await dbGetMessages(db, conversationId);
    if (messageRows.length === 0) return;

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
      const contextMessages = messageRows.slice(0, 3);
      const contextText = contextMessages
        .map((row) => {
          try {
            const parts = JSON.parse(row.parts);
            const textPart = parts.find((p: { type: string }) => p.type === 'text');
            return textPart?.text || '';
          } catch {
            return '';
          }
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

      // Update the conversation title in database
      await dbUpdateConversationTitle(db, conversationId, title);
    } catch (error) {
      console.error('Failed to generate title:', error);
      // Fallback: use first few words of first message
      const firstUserMessage = messageRows.find((m) => m.role === 'user');
      if (firstUserMessage) {
        try {
          const parts = JSON.parse(firstUserMessage.parts);
          const textPart = parts.find((p: { type: string }) => p.type === 'text');
          if (textPart?.text) {
            const words = textPart.text.split(' ').slice(0, 5).join(' ');
            const fallbackTitle = words + (textPart.text.split(' ').length > 5 ? '...' : '');
            await dbUpdateConversationTitle(db, conversationId, fallbackTitle);
          }
        } catch (parseError) {
          console.error('Failed to parse message parts for fallback title:', parseError);
        }
      }
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const db = this.ensureInitialized();
    await dbDeleteConversation(db, conversationId);

    // If we deleted the current conversation, switch to another or create new
    if (this.currentConversationId === conversationId) {
      const conversations = await this.getAllConversations();
      if (conversations.length > 0) {
        this.currentConversationId = conversations[0].id;
        await Preferences.set({
          key: CURRENT_CONVERSATION_KEY,
          value: this.currentConversationId,
        });
      } else {
        await this.createNewConversation();
      }
    }
  }

  async getAllConversations(): Promise<Conversation[]> {
    const db = this.ensureInitialized();
    const convRows = await dbGetAllConversations(db);

    // Convert to Conversation objects (populate message count but not full messages for performance)
    return convRows.map((row) => ({
      id: row.id,
      title: row.title ?? 'New Conversation',
      messages: new Array(row.messageCount).fill(null).map((_, i) => ({
        id: `placeholder-${i}`,
        role: 'user' as const,
        parts: [],
        timestamp: 0,
      })), // Placeholder array with correct length for count display
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const db = this.ensureInitialized();
    const conversation = await dbGetConversation(db, conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    await dbUpdateConversationTitle(db, conversationId, title.trim() || 'New Conversation');
  }

  /**
   * Get the underlying database connection.
   * Use this for advanced operations or maintenance tasks.
   */
  getDb(): ChatDb | null {
    return this.db;
  }
}

export const conversationStorage = new ConversationStorage();
