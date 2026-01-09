import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = resolve(__dirname, '../../logs');

// Ensure logs directory exists
if (!existsSync(LOGS_DIR)) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Get log file path for today
 */
function getLogFile() {
  const today = new Date().toISOString().split('T')[0];
  return resolve(LOGS_DIR, `assistant-${today}.log`);
}

/**
 * Format log message with timestamp
 */
function formatLog(level, message, data = null) {
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
export function log(level, message, data = null) {
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
  info: (message, data) => {
    log('INFO', message, data);
    console.log(`[INFO] ${message}`, data || '');
  },
  error: (message, data) => {
    log('ERROR', message, data);
    console.error(`[ERROR] ${message}`, data || '');
  },
  warn: (message, data) => {
    log('WARN', message, data);
    console.warn(`[WARN] ${message}`, data || '');
  },
  debug: (message, data) => {
    log('DEBUG', message, data);
    console.debug(`[DEBUG] ${message}`, data || '');
  }
};
