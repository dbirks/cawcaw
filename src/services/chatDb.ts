import { CapacitorSQLite, type SQLiteDBConnection } from '@capacitor-community/sqlite';

export type ChatDb = SQLiteDBConnection;

/**
 * Opens the chat database with WAL mode enabled.
 * This provides better concurrency and crash-safety for conversation storage.
 *
 * Storage location:
 * - iOS: Application Support (backed up by iCloud Backup)
 * - Android: Internal app storage
 *
 * @param opts - Optional configuration (encryption passphrase)
 * @returns Connected database instance
 */
export async function openChatDb(opts?: { passphrase?: string }): Promise<ChatDb> {
  const sqlite = CapacitorSQLite;
  const dbName = 'chat.db';

  // Create/open connection (encrypted if you set a passphrase)
  await sqlite.createConnection({
    database: dbName,
    encrypted: !!opts?.passphrase,
    mode: 'no-encryption',
    version: 1,
    readonly: false,
  });

  const db = await sqlite.retrieveConnection(dbName, false);
  await db.open();

  // --- Enable WAL mode for better concurrency and crash-safety ---
  const walRes = await db.query('PRAGMA journal_mode = WAL;');
  console.log('SQLite WAL mode enabled:', walRes.values);

  // --- Pragmas that help mobile apps ---
  await db.execute(`
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;
  `);

  // --- Migrations (idempotent) ---
  await runMigrations(db);

  return db;
}

/**
 * Run database migrations idempotently.
 * Creates tables and indexes if they don't exist.
 */
async function runMigrations(db: ChatDb): Promise<void> {
  await db.execute('BEGIN;');

  // Conversations table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Messages table with foreign key to conversations
  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      parts TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      provider TEXT,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);

  // Index for efficient message queries by conversation
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_conv_time
      ON messages(conversation_id, created_at);
  `);

  await db.execute('COMMIT;');
}

/**
 * Checkpoint the WAL file to fold changes into main DB.
 * Call this on app backgrounding or before exports.
 *
 * TRUNCATE mode runs a checkpoint and truncates the -wal file,
 * making backups cleaner and more self-contained.
 */
export async function checkpointDb(db: ChatDb): Promise<void> {
  try {
    await db.query('PRAGMA wal_checkpoint(TRUNCATE);');
    console.log('SQLite WAL checkpoint completed');
  } catch (error) {
    console.error('Failed to checkpoint WAL:', error);
  }
}

/**
 * Vacuum the database to reclaim space after deletions.
 * Run this off the hot path (e.g., maintenance job).
 */
export async function vacuumDb(db: ChatDb): Promise<void> {
  try {
    await db.execute('VACUUM;');
    console.log('SQLite VACUUM completed');
  } catch (error) {
    console.error('Failed to vacuum database:', error);
  }
}

/**
 * Close the database connection.
 */
export async function closeChatDb(db: ChatDb): Promise<void> {
  try {
    await db.close();
    console.log('SQLite connection closed');
  } catch (error) {
    console.error('Failed to close database:', error);
  }
}

// ==================== DAO Functions ====================

export interface ConversationRow {
  id: string;
  title: string | null;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  parts: string; // JSON string
  created_at: number;
  provider: string | null;
}

/**
 * Create a new conversation.
 */
export async function createConversation(
  db: ChatDb,
  c: {
    id: string;
    title?: string;
    createdAt: number;
  }
): Promise<void> {
  await db.run(
    `INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    [c.id, c.title ?? null, c.createdAt, c.createdAt]
  );
}

/**
 * Update conversation title.
 */
export async function updateConversationTitle(
  db: ChatDb,
  conversationId: string,
  title: string
): Promise<void> {
  await db.run(`UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?`, [
    title,
    Date.now(),
    conversationId,
  ]);
}

/**
 * Append a message to a conversation.
 */
export async function appendMessage(
  db: ChatDb,
  m: {
    id: string;
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    parts: unknown;
    createdAt: number;
    provider?: string;
  }
): Promise<void> {
  await db.run(
    `INSERT INTO messages (id, conversation_id, role, parts, created_at, provider)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [m.id, m.conversationId, m.role, JSON.stringify(m.parts), m.createdAt, m.provider ?? null]
  );

  // Update conversation's updated_at timestamp
  await db.run(`UPDATE conversations SET updated_at = ? WHERE id = ?`, [
    m.createdAt,
    m.conversationId,
  ]);
}

/**
 * Get all conversations with message counts, sorted by most recently updated.
 */
export async function getAllConversations(
  db: ChatDb
): Promise<(ConversationRow & { messageCount: number })[]> {
  const res = await db.query(`
    SELECT
      c.*,
      COUNT(m.id) as message_count
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `);
  return (res.values ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string | null,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
    messageCount: Number(row.message_count ?? 0),
  }));
}

/**
 * Get a specific conversation by ID.
 */
export async function getConversation(db: ChatDb, id: string): Promise<ConversationRow | null> {
  const res = await db.query(`SELECT * FROM conversations WHERE id = ?`, [id]);
  return (res.values?.[0] as ConversationRow) ?? null;
}

/**
 * Get all messages for a conversation.
 */
export async function getMessages(db: ChatDb, conversationId: string): Promise<MessageRow[]> {
  const res = await db.query(
    `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    [conversationId]
  );
  return (res.values ?? []) as MessageRow[];
}

/**
 * Delete a conversation and all its messages.
 */
export async function deleteConversation(db: ChatDb, conversationId: string): Promise<void> {
  // Foreign key cascade will delete associated messages
  await db.run(`DELETE FROM conversations WHERE id = ?`, [conversationId]);
}

/**
 * Update all messages for a conversation (used for bulk updates).
 */
export async function updateMessages(
  db: ChatDb,
  conversationId: string,
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    parts: unknown;
    timestamp: number;
    provider?: string;
  }>
): Promise<void> {
  await db.execute('BEGIN;');

  // Delete existing messages for this conversation
  await db.run(`DELETE FROM messages WHERE conversation_id = ?`, [conversationId]);

  // Insert new messages
  for (const msg of messages) {
    await db.run(
      `INSERT INTO messages (id, conversation_id, role, parts, created_at, provider)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        msg.id,
        conversationId,
        msg.role,
        JSON.stringify(msg.parts),
        msg.timestamp,
        msg.provider ?? null,
      ]
    );
  }

  // Update conversation's updated_at timestamp
  const latestTimestamp =
    messages.length > 0 ? Math.max(...messages.map((m) => m.timestamp)) : Date.now();
  await db.run(`UPDATE conversations SET updated_at = ? WHERE id = ?`, [
    latestTimestamp,
    conversationId,
  ]);

  await db.execute('COMMIT;');
}
