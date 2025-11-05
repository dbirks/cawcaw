import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { type ChatDbWeb, openChatDbWeb } from './chatDbWeb';

export type ChatDb = SQLiteDBConnection | ChatDbWeb;

/**
 * Opens the chat database with WAL mode enabled.
 * This provides better concurrency and crash-safety for conversation storage.
 *
 * CRITICAL FIX: Implements proper connection lifecycle management to prevent
 * "connection already exists" and "safety level may not be changed inside a transaction" errors.
 *
 * Storage location:
 * - iOS: Application Support (backed up by iCloud Backup)
 * - Android: Internal app storage
 * - Web (development): localStorage fallback
 *
 * @param opts - Optional configuration (encryption passphrase)
 * @returns Connected database instance
 */
export async function openChatDb(opts?: { passphrase?: string }): Promise<ChatDb> {
  try {
    // Check if we're running on a native platform
    const isNative = Capacitor.isNativePlatform();

    if (!isNative) {
      console.log('[ChatDb] Running on web, using localStorage fallback');
      return await openChatDbWeb();
    }

    console.log('[ChatDb] Initializing native SQLite connection...');

    const sqlite = new SQLiteConnection(CapacitorSQLite);
    const dbName = 'chat.db';
    const readonly = false;

    // CRITICAL FIX #1: Check connection consistency between JS and native
    // This prevents "connection already exists" errors on app reload/force-close
    console.log('[ChatDb] Checking connection consistency...');
    const retCC = await sqlite.checkConnectionsConsistency();
    console.log('[ChatDb] Connection consistency result:', retCC.result);

    // CRITICAL FIX #2: Check if connection already exists before creating
    const isConn = (await sqlite.isConnection(dbName, readonly)).result;
    console.log('[ChatDb] Connection exists:', isConn);

    let db: SQLiteDBConnection;
    let isNewConnection = false;

    if (retCC.result && isConn) {
      // Connection exists - retrieve it instead of creating new one
      console.log('[ChatDb] Retrieving existing connection...');
      db = await sqlite.retrieveConnection(dbName, readonly);
      console.log('[ChatDb] Existing connection retrieved - skipping initialization');
    } else {
      // Create new connection
      console.log('[ChatDb] Creating new connection...');
      db = await sqlite.createConnection(dbName, !!opts?.passphrase, 'no-encryption', 1, readonly);
      isNewConnection = true;
    }

    // CRITICAL FIX #6: Only open and configure PRAGMAs for NEW connections
    // Retrieved connections are already open and configured
    // Attempting to reconfigure PRAGMAs on an existing connection can cause
    // "safety level may not be changed inside a transaction" if the connection is in use
    if (isNewConnection) {
      // Open the connection
      console.log('[ChatDb] Opening database connection...');
      await db.open();

      // CRITICAL FIX #7: DO NOT set WAL mode - let the plugin handle it
      // The Capacitor SQLite plugin automatically enables WAL mode on Android/iOS
      // Attempting to set it manually causes "cannot change into wal mode from within a transaction"
      // because db.open() may start an implicit transaction
      console.log('[ChatDb] Skipping manual WAL mode configuration - handled by plugin');

      console.log('[ChatDb] Setting PRAGMA foreign_keys = ON...');
      await db.execute('PRAGMA foreign_keys = ON;');

      console.log('[ChatDb] Setting PRAGMA synchronous = NORMAL...');
      await db.execute('PRAGMA synchronous = NORMAL;');

      console.log('[ChatDb] PRAGMAs configured successfully');

      // --- Migrations (idempotent) ---
      console.log('[ChatDb] Running migrations...');
      await runMigrations(db);
      console.log('[ChatDb] Migrations completed');
    }

    console.log('[ChatDb] Database initialized successfully');
    return db;
  } catch (error) {
    // Enhance error with more context for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = errorMessage.toLowerCase();

    console.error('[ChatDb] Failed to open database:', {
      error: errorMessage,
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
    });

    // Provide specific guidance based on error type
    let userMessage = 'SQLite initialization failed: ';

    if (errorDetails.includes('safety level') || errorDetails.includes('inside a transaction')) {
      userMessage +=
        'Database configuration error (PRAGMA transaction conflict). Please force-close and restart the app. If the problem persists, reinstall to reset the database.';
    } else if (errorDetails.includes('connection') || errorDetails.includes('already exists')) {
      userMessage +=
        'Connection state mismatch. Please force-close and restart the app to recover.';
    } else if (errorDetails.includes('not implemented') || errorDetails.includes('not available')) {
      userMessage += 'SQLite is not available on this platform. Please reinstall the app.';
    } else if (errorDetails.includes('permission') || errorDetails.includes('access denied')) {
      userMessage +=
        'Cannot access app storage. Check Settings > [App Name] > Storage permissions.';
    } else if (errorDetails.includes('corrupt') || errorDetails.includes('malformed')) {
      userMessage += 'Database file is corrupted. Please reinstall the app to reset storage.';
    } else {
      // Generic fallback with technical details
      userMessage += errorMessage;
    }

    throw new Error(userMessage);
  }
}

/**
 * Run database migrations idempotently.
 * Creates tables and indexes if they don't exist.
 *
 * CRITICAL FIX #5: Removed explicit BEGIN/COMMIT transaction wrapper.
 * SQLite DDL statements (CREATE TABLE, CREATE INDEX) are atomic by default.
 * The explicit transaction was causing potential conflicts with PRAGMA synchronous.
 */
async function runMigrations(db: ChatDb): Promise<void> {
  // Conversations table
  // Note: CREATE TABLE IF NOT EXISTS is atomic and doesn't need explicit transaction
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
}

/**
 * Checkpoint the WAL file to fold changes into main DB.
 * Call this on app backgrounding or before exports.
 *
 * TRUNCATE mode runs a checkpoint and truncates the -wal file,
 * making backups cleaner and more self-contained.
 *
 * FIX: Changed from query() to execute() for consistency with PRAGMA best practices.
 */
export async function checkpointDb(db: ChatDb): Promise<void> {
  try {
    await db.execute('PRAGMA wal_checkpoint(TRUNCATE);');
    console.log('[ChatDb] SQLite WAL checkpoint completed');
  } catch (error) {
    console.error('[ChatDb] Failed to checkpoint WAL:', error);
  }
}

/**
 * Vacuum the database to reclaim space after deletions.
 * Run this off the hot path (e.g., maintenance job).
 */
export async function vacuumDb(db: ChatDb): Promise<void> {
  try {
    await db.execute('VACUUM;');
    console.log('[ChatDb] SQLite VACUUM completed');
  } catch (error) {
    console.error('[ChatDb] Failed to vacuum database:', error);
  }
}

/**
 * Close the database connection.
 */
export async function closeChatDb(db: ChatDb): Promise<void> {
  try {
    await db.close();
    console.log('[ChatDb] SQLite connection closed');
  } catch (error) {
    console.error('[ChatDb] Failed to close database:', error);
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
