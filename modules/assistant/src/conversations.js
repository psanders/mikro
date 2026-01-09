import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONVERSATIONS_FILE = resolve(__dirname, '../../conversations.json');

/**
 * Load conversations from JSON file
 */
export function loadConversations() {
  if (!existsSync(CONVERSATIONS_FILE)) {
    return {};
  }
  
  try {
    const content = readFileSync(CONVERSATIONS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading conversations:', error);
    return {};
  }
}

/**
 * Save conversations to JSON file
 */
export function saveConversations(conversations) {
  try {
    writeFileSync(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving conversations:', error);
    throw error;
  }
}

/**
 * Get conversation history for a phone number
 */
export function getConversation(phone) {
  const conversations = loadConversations();
  return conversations[phone] || [];
}

/**
 * Add a message to conversation history
 */
export function addMessage(phone, role, content, toolCalls = null, toolName = null, toolCallId = null) {
  const conversations = loadConversations();
  
  if (!conversations[phone]) {
    conversations[phone] = [];
  }
  
  const message = {
    role,
    content,
    timestamp: new Date().toISOString()
  };
  
  // Add tool calls if present (for assistant messages)
  if (toolCalls) {
    message.tool_calls = toolCalls;
  }
  
  // Add tool metadata if present (for tool messages)
  if (toolName && toolCallId) {
    message.name = toolName;
    message.tool_call_id = toolCallId;
  }
  
  conversations[phone].push(message);
  
  saveConversations(conversations);
}

/**
 * Clear conversation history for a phone number
 */
export function clearConversation(phone) {
  const conversations = loadConversations();
  delete conversations[phone];
  saveConversations(conversations);
}

/**
 * Get conversation messages in OpenAI format
 */
export function getConversationMessages(phone) {
  const conversation = getConversation(phone);
  // Return messages in OpenAI format, filtering out system messages
  return conversation.filter(msg => msg.role !== 'system').map(msg => {
    let content = msg.content;
    
    // Clean up old placeholder image URLs from history
    if (Array.isArray(content)) {
      content = content.filter(item => {
        if (item.type === 'image_url' && typeof item.image_url?.url === 'string') {
          // Remove placeholder URLs
          if (item.image_url.url.startsWith('https://example.com/')) {
            return false;
          }
        }
        return true;
      });
      // If array becomes empty, convert to empty string
      if (content.length === 0) {
        content = '';
      }
    } else if (typeof content === 'string' && content.includes('https://example.com/image/')) {
      // If it's a string with placeholder, remove it
      content = content.replace(/https:\/\/example\.com\/image\/[^\s]*/g, '').trim() || '';
    }
    
    const message = {
      role: msg.role,
      content: content
    };
    
    // Add tool_calls if present
    if (msg.tool_calls) {
      message.tool_calls = msg.tool_calls;
    }
    
    // Add tool metadata if present
    if (msg.name) {
      message.name = msg.name;
    }
    if (msg.tool_call_id) {
      message.tool_call_id = msg.tool_call_id;
    }
    
    return message;
  });
}
