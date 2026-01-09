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
