import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = resolve(__dirname, '../logs');

// Ensure logs directory exists
if (!existsSync(LOGS_DIR)) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Get log file path for today
 */
function getLogFile(): string {
  const today = new Date().toISOString().split('T')[0];
  return resolve(LOGS_DIR, `assistant-${today}.log`);
}

/**
 * Format log message with timestamp
 */
function formatLog(level: string, message: string, data: Record<string, unknown> | null = null): string {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data })
  };
  return JSON.stringify(logEntry) + '\n';
}

/**
 * Write log entry to file
 */
export function log(level: string, message: string, data: Record<string, unknown> | null = null): void {
  try {
    const logFile = getLogFile();
    const logEntry = formatLog(level, message, data);
    appendFileSync(logFile, logEntry, 'utf-8');
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

/**
 * Log levels
 */
export const logger = {
  info: (message: string, data?: Record<string, unknown>) => {
    log('INFO', message, data || null);
    console.log(`[INFO] ${message}`, data || '');
  },
  error: (message: string, data?: Record<string, unknown>) => {
    log('ERROR', message, data || null);
    console.error(`[ERROR] ${message}`, data || '');
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    log('WARN', message, data || null);
    console.warn(`[WARN] ${message}`, data || '');
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    log('DEBUG', message, data || null);
    console.debug(`[DEBUG] ${message}`, data || '');
  }
};
