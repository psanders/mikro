import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_FILE = resolve(__dirname, '../agent.md');

/**
 * Get system prompt from markdown file
 */
export function getSystemPrompt(): string {
  if (!existsSync(PROMPT_FILE)) {
    throw new Error(`Agent prompt file not found: ${PROMPT_FILE}`);
  }
  
  try {
    const content = readFileSync(PROMPT_FILE, 'utf-8');
    return content.trim();
  } catch (error) {
    const err = error as Error;
    throw new Error(`Error loading agent prompt: ${err.message}`);
  }
}

/**
 * Get OpenAI API key from environment
 */
export function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * Get server port from environment or default
 */
export function getPort(): number {
  const port = process.env.PORT;
  return port ? parseInt(port, 10) : 3000;
}

/**
 * Get WhatsApp webhook verify token from environment
 */
export function getWebhookVerifyToken(): string {
  return process.env.WHATSAPP_VERIFY_TOKEN || 'mikro_webhook_token';
}

/**
 * Get WhatsApp Phone Number ID from environment
 */
export function getWhatsAppPhoneNumberId(): string {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID environment variable is not set');
  }
  return phoneNumberId;
}

/**
 * Get WhatsApp Access Token from environment
 */
export function getWhatsAppAccessToken(): string {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('WHATSAPP_ACCESS_TOKEN environment variable is not set');
  }
  return accessToken;
}

/**
 * Google Sheets configuration interface
 */
export interface GoogleSheetsConfig {
  enabled: boolean;
  spreadsheetId: string;
  sheetName: string;
  credentials: {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
  } | null;
}

/**
 * Get Google Sheets configuration from environment
 */
export function getGoogleSheetsConfig(): GoogleSheetsConfig {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Sheet1';
  const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  
  // If spreadsheet ID is not set, Google Sheets integration is disabled
  if (!spreadsheetId) {
    return {
      enabled: false,
      spreadsheetId: '',
      sheetName: sheetName,
      credentials: null,
    };
  }
  
  // Parse credentials if provided
  let credentials = null;
  if (credentialsJson) {
    try {
      credentials = JSON.parse(credentialsJson);
    } catch (error) {
      throw new Error('GOOGLE_SHEETS_CREDENTIALS must be valid JSON');
    }
  } else {
    // Try to read from file path if provided
    const credentialsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
    if (credentialsPath && existsSync(credentialsPath)) {
      try {
        const content = readFileSync(credentialsPath, 'utf-8');
        credentials = JSON.parse(content);
      } catch (error) {
        throw new Error(`Error reading Google Sheets credentials from ${credentialsPath}: ${error}`);
      }
    } else {
      throw new Error('GOOGLE_SHEETS_CREDENTIALS or GOOGLE_SHEETS_CREDENTIALS_PATH must be set when GOOGLE_SHEETS_SPREADSHEET_ID is provided');
    }
  }
  
  return {
    enabled: true,
    spreadsheetId,
    sheetName,
    credentials,
  };
}
