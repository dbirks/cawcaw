import { App } from '@capacitor/app';
import { useEffect, useRef, useState } from 'react';
import { type ChatDb, checkpointDb, closeChatDb, openChatDb } from '@/services/chatDb';

/**
 * React hook to manage the chat database connection and lifecycle.
 *
 * Handles:
 * - Opening database on mount with WAL mode
 * - Checkpointing WAL on app backgrounding (iOS/Android)
 * - Closing database on unmount
 *
 * Returns the database connection or null if not yet initialized.
 */
export function useChatDb() {
  const [db, setDb] = useState<ChatDb | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dbRef = useRef<ChatDb | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const database = await openChatDb();
        if (mounted) {
          dbRef.current = database;
          setDb(database);
          setIsInitializing(false);
        }
      } catch (err) {
        console.error('Failed to open chat database:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setIsInitializing(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
      if (dbRef.current) {
        closeChatDb(dbRef.current).catch((err) => {
          console.error('Failed to close database on unmount:', err);
        });
      }
    };
  }, []);

  // Listen for app state changes and checkpoint on background
  useEffect(() => {
    if (!db) return;

    let listenerHandle: { remove: () => void } | null = null;

    // Set up listener
    App.addListener('appStateChange', async (state) => {
      if (!state.isActive && dbRef.current) {
        // App is going to background - checkpoint to fold WAL into main DB
        // This ensures backups capture the latest state
        console.log('App backgrounding - checkpointing SQLite WAL');
        await checkpointDb(dbRef.current);
      }
    }).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      listenerHandle?.remove();
    };
  }, [db]);

  return { db, isInitializing, error };
}
