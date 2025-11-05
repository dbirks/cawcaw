/**
 * Web fallback for chat database using localStorage
 * Used when Capacitor SQLite is not available (development in browser)
 */

import type { ConversationRow, MessageRow } from './chatDb';

export interface ChatDbWeb {
  execute(sql: string): Promise<void>;
  run(sql: string, params?: unknown[]): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ values: unknown[] }>;
  open(): Promise<void>;
  close(): Promise<void>;
}

class LocalStorageChatDb implements ChatDbWeb {
  private conversations: Map<string, ConversationRow> = new Map();
  private messages: Map<string, MessageRow[]> = new Map();

  async open(): Promise<void> {
    // Load from localStorage
    const conversationsData = localStorage.getItem('dev_conversations');
    const messagesData = localStorage.getItem('dev_messages');

    if (conversationsData) {
      const convs = JSON.parse(conversationsData);
      this.conversations = new Map(Object.entries(convs));
    }

    if (messagesData) {
      const msgs = JSON.parse(messagesData);
      this.messages = new Map(Object.entries(msgs));
    }

    console.log('[WebDB] Loaded from localStorage:', {
      conversations: this.conversations.size,
      messages: this.messages.size,
    });
  }

  async close(): Promise<void> {
    this.save();
  }

  private save(): void {
    const convs = Object.fromEntries(this.conversations.entries());
    const msgs = Object.fromEntries(this.messages.entries());

    localStorage.setItem('dev_conversations', JSON.stringify(convs));
    localStorage.setItem('dev_messages', JSON.stringify(msgs));
  }

  async execute(sql: string): Promise<void> {
    // Handle basic SQL commands
    if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('PRAGMA')) {
      return;
    }
  }

  async run(sql: string, params?: unknown[]): Promise<void> {
    const upperSql = sql.toUpperCase();

    if (upperSql.includes('INSERT') && upperSql.includes('CONVERSATIONS')) {
      const [id, title, created_at, updated_at] = params as [string, string | null, number, number];
      this.conversations.set(id, { id, title, created_at, updated_at });
      this.save();
    } else if (upperSql.includes('INSERT') && upperSql.includes('MESSAGES')) {
      const [id, conversation_id, role, parts, created_at, provider] = params as [
        string,
        string,
        string,
        string,
        number,
        string | null
      ];
      const msgs = this.messages.get(conversation_id) || [];
      msgs.push({ id, conversation_id, role, parts, created_at, provider });
      this.messages.set(conversation_id, msgs);
      this.save();
    } else if (upperSql.includes('UPDATE') && upperSql.includes('CONVERSATIONS')) {
      if (upperSql.includes('SET TITLE')) {
        const [title, updated_at, id] = params as [string, number, string];
        const conv = this.conversations.get(id);
        if (conv) {
          conv.title = title;
          conv.updated_at = updated_at;
          this.save();
        }
      } else if (upperSql.includes('SET UPDATED_AT')) {
        const [updated_at, id] = params as [number, string];
        const conv = this.conversations.get(id);
        if (conv) {
          conv.updated_at = updated_at;
          this.save();
        }
      }
    } else if (upperSql.includes('DELETE') && upperSql.includes('CONVERSATIONS')) {
      const [id] = params as [string];
      this.conversations.delete(id);
      this.messages.delete(id);
      this.save();
    } else if (upperSql.includes('DELETE') && upperSql.includes('MESSAGES')) {
      const [conversation_id] = params as [string];
      this.messages.set(conversation_id, []);
      this.save();
    }
  }

  async query(sql: string, params?: unknown[]): Promise<{ values: unknown[] }> {
    const upperSql = sql.toUpperCase();

    if (upperSql.includes('PRAGMA')) {
      return { values: [{ journal_mode: 'wal' }] };
    }

    if (upperSql.includes('SELECT') && upperSql.includes('FROM CONVERSATIONS')) {
      if (upperSql.includes('WHERE ID')) {
        const [id] = params as [string];
        const conv = this.conversations.get(id);
        return { values: conv ? [conv] : [] };
      }

      if (upperSql.includes('GROUP BY')) {
        const values = Array.from(this.conversations.values())
          .map((conv) => ({
            ...conv,
            message_count: (this.messages.get(conv.id) || []).length,
          }))
          .sort((a, b) => b.updated_at - a.updated_at);
        return { values };
      }

      const values = Array.from(this.conversations.values());
      return { values };
    }

    if (upperSql.includes('SELECT') && upperSql.includes('FROM MESSAGES')) {
      const [conversation_id] = params as [string];
      const msgs = this.messages.get(conversation_id) || [];
      return { values: msgs };
    }

    return { values: [] };
  }
}

export async function openChatDbWeb(): Promise<ChatDbWeb> {
  const db = new LocalStorageChatDb();
  await db.open();

  // Run migrations
  await db.execute('CREATE TABLE IF NOT EXISTS conversations');
  await db.execute('CREATE TABLE IF NOT EXISTS messages');

  return db;
}
