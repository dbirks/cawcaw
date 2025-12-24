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
        // Try to recover: if DB opened but conversation creation failed, retry
        if (this.db) {
          try {
            await this.createNewConversation();
          } catch (recoveryError) {
            console.error('Failed to recover from initialization error:', recoveryError);
            throw new Error('Failed to initialize conversation storage. Please restart the app.');
          }
        } else {
          // DB failed to open - this is unrecoverable
          // Extract error details for better user feedback
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorDetails = errorMessage.toLowerCase();

          // Provide specific guidance based on error type
          let userMessage = 'Failed to initialize the chat database. ';

          if (errorDetails.includes('connection') || errorDetails.includes('already exists')) {
            userMessage +=
              'The database connection is in an invalid state. Please force-close and restart the app.';
          } else if (
            errorDetails.includes('not implemented') ||
            errorDetails.includes('not available')
          ) {
            userMessage += 'SQLite is not available on this platform. Please reinstall the app.';
          } else if (
            errorDetails.includes('permission') ||
            errorDetails.includes('access denied')
          ) {
            userMessage +=
              'Cannot access app storage. Please check Settings > [App Name] > Storage permissions.';
          } else if (errorDetails.includes('corrupt') || errorDetails.includes('malformed')) {
            userMessage +=
              'The database file is corrupted. Please reinstall the app to reset storage.';
          } else {
            // Generic fallback with technical details
            userMessage += `Technical details: ${errorMessage}`;
          }

          throw new Error(userMessage);
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

    console.log('[Title Check] Checking if we should generate title', {
      conversationId: conversation.id,
      currentTitle: conversation.title,
      newMessagesCount: messages.length,
      existingMessagesCount: conversation.messages.length,
      shouldGenerate: messages.length > 0 && conversation.title === 'New Conversation',
    });

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
      console.log('[Title Check] Title condition met', {
        hasUserMessage: !!firstUserMessage,
        userMessagePreview: firstUserMessage
          ? JSON.stringify(firstUserMessage).substring(0, 100)
          : 'none',
      });
      if (firstUserMessage) {
        // Don't await this - let it run in background
        console.log('[Title Check] Triggering title generation for:', conversation.id);
        this.generateConversationTitle(conversation.id).catch((error) => {
          console.error('Failed to generate conversation title:', error);
        });
      }
    } else {
      console.log('[Title Check] NOT generating title', {
        reason:
          messages.length === 0
            ? 'No messages'
            : conversation.title !== 'New Conversation'
              ? `Title already set to: "${conversation.title}"`
              : 'Unknown reason',
      });
    }
  }

  async generateConversationTitle(conversationId: string): Promise<void> {
    console.log('[Title Generation] ========== START ==========');
    console.log('[Title Generation] Starting title generation for conversation:', conversationId);

    try {
      const db = this.ensureInitialized();
      console.log('[Title Generation] Database initialized successfully');

      const convRow = await dbGetConversation(db, conversationId);
      if (!convRow) {
        console.error('[Title Generation] ❌ Conversation not found in database:', conversationId);
        return;
      }
      console.log('[Title Generation] ✅ Conversation found:', {
        id: convRow.id,
        title: convRow.title,
        createdAt: convRow.created_at,
      });

      const messageRows = await dbGetMessages(db, conversationId);
      console.log('[Title Generation] Retrieved messages:', {
        count: messageRows.length,
        messageIds: messageRows.map((m) => m.id),
      });

      if (messageRows.length === 0) {
        console.warn('[Title Generation] ⚠️ No messages found, cannot generate title');
        return;
      }

      console.log('[Title Generation] Proceeding with title generation...');

      try {
        // Get title model preference (defaults to 'same' which means use current provider)
        console.log('[Title Generation] Step 1: Getting title model preference from storage...');
        const titleModelResult = await SecureStoragePlugin.get({ key: 'title_model' });
        const titleModel = titleModelResult?.value || 'same';
        console.log('[Title Generation] ✅ Title model preference:', titleModel);

        // Determine which provider and model to use
        let providerType: 'openai' | 'anthropic';
        let modelName: string;
        let apiKey: string;

        console.log('[Title Generation] Step 2: Determining provider and model...');
        if (titleModel === 'same') {
          console.log('[Title Generation] Using "same as chat" - fetching current model...');
          // Use current provider - get model first, then determine provider from model
          const selectedModelResult = await SecureStoragePlugin.get({ key: 'selected_model' });
          modelName = selectedModelResult?.value || 'gpt-4o-mini';
          console.log('[Title Generation] Current model:', modelName);

          // Determine provider based on model name (more reliable than selected_provider)
          if (modelName.startsWith('claude-')) {
            providerType = 'anthropic';
          } else {
            providerType = 'openai';
          }
          console.log('[Title Generation] Provider determined from model name:', providerType);

          // Get the appropriate API key
          console.log('[Title Generation] Step 3: Fetching API key for provider:', providerType);
          const keyName = providerType === 'openai' ? 'openai_api_key' : 'anthropic_api_key';
          const keyResult = await SecureStoragePlugin.get({ key: keyName });

          if (!keyResult?.value) {
            console.error('[Title Generation] ❌ No API key found for provider:', providerType);
            console.error('[Title Generation] Storage key attempted:', keyName);
            throw new Error(`No API key available for ${providerType}`);
          }
          apiKey = keyResult.value;
          console.log('[Title Generation] ✅ API key found (length:', apiKey.length, ')');
        } else {
          console.log('[Title Generation] Using specific model:', titleModel);
          // Use specific model
          modelName = titleModel;

          // Determine provider based on model name
          if (modelName.startsWith('claude-')) {
            providerType = 'anthropic';
            console.log(
              '[Title Generation] Detected Anthropic model, fetching Anthropic API key...'
            );
            const anthropicKeyResult = await SecureStoragePlugin.get({ key: 'anthropic_api_key' });
            if (!anthropicKeyResult?.value) {
              console.error(
                '[Title Generation] ❌ No Anthropic API key available for title generation'
              );
              throw new Error('No Anthropic API key available');
            }
            apiKey = anthropicKeyResult.value;
            console.log(
              '[Title Generation] ✅ Anthropic API key found (length:',
              apiKey.length,
              ')'
            );
          } else {
            providerType = 'openai';
            console.log('[Title Generation] Detected OpenAI model, fetching OpenAI API key...');
            const openaiKeyResult = await SecureStoragePlugin.get({ key: 'openai_api_key' });
            if (!openaiKeyResult?.value) {
              console.error(
                '[Title Generation] ❌ No OpenAI API key available for title generation'
              );
              throw new Error('No OpenAI API key available');
            }
            apiKey = openaiKeyResult.value;
            console.log('[Title Generation] ✅ OpenAI API key found (length:', apiKey.length, ')');
          }
        }

        // Get the first few messages for context (max 3)
        console.log('[Title Generation] Step 4: Extracting context from messages...');
        const contextMessages = messageRows.slice(0, 3);
        console.log('[Title Generation] Using', contextMessages.length, 'messages for context');

        const contextText = contextMessages
          .map((row, index) => {
            try {
              const parts = JSON.parse(row.parts);
              const textPart = parts.find((p: { type: string }) => p.type === 'text');
              const text = textPart?.text || '';
              console.log(`[Title Generation] Message ${index + 1}/${contextMessages.length}:`, {
                role: row.role,
                hasText: !!text,
                textLength: text.length,
                textPreview: text.substring(0, 50),
              });
              return text;
            } catch (error) {
              console.error(`[Title Generation] ❌ Error parsing message ${index + 1}:`, error);
              return '';
            }
          })
          .filter((text) => text.trim())
          .join('\n');

        console.log('[Title Generation] Context extraction complete:', {
          totalLength: contextText.length,
          preview: contextText.substring(0, 100),
        });

        if (!contextText.trim()) {
          console.error(
            '[Title Generation] ❌ No context text found after extraction, cannot generate title'
          );
          return;
        }

        console.log('[Title Generation] Step 5: Creating provider client...');
        console.log('[Title Generation] Provider:', providerType, '| Model:', modelName);

        // Create the appropriate provider client
        const providerClient =
          providerType === 'openai' ? createOpenAI({ apiKey }) : createAnthropic({ apiKey });
        console.log('[Title Generation] ✅ Provider client created successfully');

        console.log('[Title Generation] Step 6: Calling AI model to generate title...');
        const startTime = Date.now();

        try {
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

          const duration = Date.now() - startTime;
          console.log('[Title Generation] ✅ AI model response received in', duration, 'ms');
          console.log('[Title Generation] Raw response:', result.text);

          const title = result.text.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
          console.log('[Title Generation] Cleaned title:', title);

          // Update the conversation title in database
          console.log('[Title Generation] Step 7: Updating title in database...');
          await dbUpdateConversationTitle(db, conversationId, title);
          console.log('[Title Generation] ✅ Successfully updated conversation title to:', title);
          console.log('[Title Generation] ========== SUCCESS ==========');
        } catch (apiError) {
          console.error('[Title Generation] ❌ API call failed:', apiError);
          if (apiError instanceof Error) {
            console.error('[Title Generation] API Error details:', {
              message: apiError.message,
              name: apiError.name,
              stack: apiError.stack,
            });
          }
          throw apiError; // Re-throw to trigger fallback
        }
      } catch (error) {
        console.error('[Title Generation] ❌ TITLE GENERATION FAILED');
        console.error('[Title Generation] Failed to generate title:', error);
        if (error instanceof Error) {
          console.error('[Title Generation] Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
          });
        }
        // Fallback: use first few words of first message
        console.log('[Title Generation] ========== FALLBACK MODE ==========');
        console.log('[Title Generation] Using fallback: first 5 words of first message');
        const firstUserMessage = messageRows.find((m) => m.role === 'user');
        if (firstUserMessage) {
          try {
            console.log('[Title Generation] Found first user message, parsing...');
            const parts = JSON.parse(firstUserMessage.parts);
            const textPart = parts.find((p: { type: string }) => p.type === 'text');
            if (textPart?.text) {
              const words = textPart.text.split(' ').slice(0, 5).join(' ');
              const fallbackTitle = words + (textPart.text.split(' ').length > 5 ? '...' : '');
              console.log('[Title Generation] Generated fallback title:', fallbackTitle);
              await dbUpdateConversationTitle(db, conversationId, fallbackTitle);
              console.log('[Title Generation] ✅ Fallback title saved successfully');
              console.log('[Title Generation] ========== FALLBACK SUCCESS ==========');
            } else {
              console.error('[Title Generation] ❌ No text found in first user message');
            }
          } catch (parseError) {
            console.error(
              '[Title Generation] ❌ Failed to parse message parts for fallback title:',
              parseError
            );
            console.error('[Title Generation] ========== FALLBACK FAILED ==========');
          }
        } else {
          console.error('[Title Generation] ❌ No user messages found for fallback');
          console.error('[Title Generation] ========== FALLBACK FAILED ==========');
        }
      }
    } catch (outerError) {
      console.error('[Title Generation] ❌❌❌ CRITICAL ERROR IN TITLE GENERATION ❌❌❌');
      console.error('[Title Generation] Outer error:', outerError);
      if (outerError instanceof Error) {
        console.error('[Title Generation] Outer error details:', {
          message: outerError.message,
          name: outerError.name,
          stack: outerError.stack,
        });
      }
      console.error('[Title Generation] ========== CRITICAL FAILURE ==========');
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

  async getConversationById(conversationId: string): Promise<Conversation | null> {
    const db = this.ensureInitialized();
    const convRow = await dbGetConversation(db, conversationId);
    if (!convRow) return null;

    const messageRows = await dbGetMessages(db, conversationId);
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
