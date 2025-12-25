// Debug logger for mobile troubleshooting
export interface DebugLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  category: 'oauth' | 'mcp' | 'acp' | 'general' | 'audio' | 'chat';
  message: string;
  data?: unknown;
}

class DebugLogger {
  private logs: DebugLogEntry[] = [];
  private maxLogs = 100;
  private listeners: ((logs: DebugLogEntry[]) => void)[] = [];

  log(
    level: 'info' | 'warn' | 'error',
    category: 'oauth' | 'mcp' | 'acp' | 'general' | 'audio' | 'chat',
    message: string,
    data?: unknown
  ) {
    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined, // Deep clone to avoid mutations
    };

    this.logs.push(entry);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also log to console for web debugging
    const consoleMethod =
      level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (data) {
      consoleMethod(`[${category.toUpperCase()}] ${message}`, data);
    } else {
      consoleMethod(`[${category.toUpperCase()}] ${message}`);
    }

    // Notify listeners
    this.listeners.forEach((listener) => {
      listener([...this.logs]);
    });
  }

  info(
    category: 'oauth' | 'mcp' | 'acp' | 'general' | 'audio' | 'chat',
    message: string,
    data?: unknown
  ) {
    this.log('info', category, message, data);
  }

  warn(
    category: 'oauth' | 'mcp' | 'acp' | 'general' | 'audio' | 'chat',
    message: string,
    data?: unknown
  ) {
    this.log('warn', category, message, data);
  }

  error(
    category: 'oauth' | 'mcp' | 'acp' | 'general' | 'audio' | 'chat',
    message: string,
    data?: unknown
  ) {
    this.log('error', category, message, data);
  }

  getLogs(): DebugLogEntry[] {
    return [...this.logs];
  }

  getLogsByCategory(
    category: 'oauth' | 'mcp' | 'acp' | 'general' | 'audio' | 'chat'
  ): DebugLogEntry[] {
    return this.logs.filter((log) => log.category === category);
  }

  clearLogs() {
    this.logs = [];
    this.listeners.forEach((listener) => {
      listener([]);
    });
  }

  subscribe(listener: (logs: DebugLogEntry[]) => void) {
    this.listeners.push(listener);
    // Immediately call with current logs
    listener([...this.logs]);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  formatLogEntry(entry: DebugLogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.toUpperCase().padEnd(5);
    const category = entry.category.toUpperCase().padEnd(7);

    let formatted = `[${timestamp}] ${level} ${category} ${entry.message}`;

    if (entry.data) {
      formatted += `\n${JSON.stringify(entry.data, null, 2)}`;
    }

    return formatted;
  }
}

// Export singleton instance
export const debugLogger = new DebugLogger();
