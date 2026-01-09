import OpenAI from 'openai';
import { getSystemPrompt, getOpenAIApiKey } from './config.js';
import { tools, executeTool } from './tools.js';
import { logger } from './logger.js';
import { getConversationMessages, addMessage, clearConversation } from './conversations.js';

let openaiClient: OpenAI | null = null;

/**
 * Initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = getOpenAIApiKey();
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Process message with OpenAI, handling tool calls
 */
export async function processMessage(phone: string, message: string, imageUrl: string | null = null): Promise<string> {
  const client = getOpenAIClient();
  const systemPrompt = getSystemPrompt();
  
  // Load conversation history
  const history = getConversationMessages(phone);
  
  // Build messages array with system prompt and history
  const messages: Array<{
    role: string;
    content: string | Array<{ type: string; [key: string]: unknown }>;
    tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    name?: string;
    tool_call_id?: string;
  }> = [
    { role: 'system', content: systemPrompt },
    ...history
  ];
  
  // Build user message content
  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
  
  // Add text message
  if (message) {
    userContent.push({
      type: 'text',
      text: message
    });
  }
  
  // Add image if provided (and it's a valid data URL, not a placeholder)
  if (imageUrl) {
    // Filter out old placeholder URLs from conversation history
    if (imageUrl.startsWith('https://example.com/')) {
      logger.warn('Skipping placeholder image URL from history', { phone, imageUrl });
    } else {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imageUrl
        }
      });
    }
  }
  
  // If no content, add a default message
  if (userContent.length === 0) {
    userContent.push({
      type: 'text',
      text: 'Hello'
    });
  }
  
  // Add current user message
  const currentUserMessage = { role: 'user', content: userContent };
  messages.push(currentUserMessage);
  
  // Store user message in conversation history
  // For storage, keep the full content structure
  addMessage(phone, 'user', userContent);
  
  logger.debug('Sending message to OpenAI', { phone, hasImage: !!imageUrl });
  
  try {
    let response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as Parameters<typeof client.chat.completions.create>[0]['messages'],
      tools: tools as Parameters<typeof client.chat.completions.create>[0]['tools'],
      tool_choice: 'auto',
      temperature: 0.7
    });
    
    let assistantMessage = response.choices[0].message;
    let finalResponse = '';
    
    // Handle tool calls
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message with tool calls to conversation
      messages.push(assistantMessage as typeof messages[number]);
      // Store assistant message with tool calls in history
      addMessage(phone, 'assistant', assistantMessage.content || '', assistantMessage.tool_calls);
      
      // Execute all tool calls
      const toolResults: Array<{
        tool_call_id: string;
        role: string;
        name: string;
        content: string;
      }> = [];
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        
        logger.info('Tool call detected', { toolName, args: toolArgs });
        
        const result = await executeTool(toolName, toolArgs, phone);
        
        const toolResult = {
          tool_call_id: toolCall.id,
          role: 'tool',
          name: toolName,
          content: JSON.stringify(result)
        };
        toolResults.push(toolResult);
        // Store tool result in history
        addMessage(phone, 'tool', JSON.stringify(result), null, toolName, toolCall.id);
      }
      
      // Add tool results to conversation
      messages.push(...toolResults);
      
      // Get next response from OpenAI
      response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: messages as Parameters<typeof client.chat.completions.create>[0]['messages'],
        tools: tools as Parameters<typeof client.chat.completions.create>[0]['tools'],
        tool_choice: 'auto',
        temperature: 0.7
      });
      
      assistantMessage = response.choices[0].message;
    }
    
    // Get final text response
    finalResponse = assistantMessage.content || '';
    
    // Store assistant response in conversation history
    addMessage(phone, 'assistant', finalResponse);
    
    logger.info('OpenAI response received', { phone, responseLength: finalResponse.length });
    
    return finalResponse;
  } catch (error) {
    const err = error as Error;
    logger.error('Error processing message with OpenAI', { error: err.message, phone });
    throw error;
  }
}
