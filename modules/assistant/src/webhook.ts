import express, { Request, Response, Router } from 'express';
import { memberExists } from './members.js';
import { processMessage } from './openai.js';
import { getWebhookVerifyToken, getWhatsAppPhoneNumberId, getWhatsAppAccessToken } from './config.js';
import { logger } from './logger.js';
import { clearConversation } from './conversations.js';

const router: Router = express.Router();

interface WhatsAppWebhookBody {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          type: string;
          id: string;
          text?: {
            body: string;
          };
          image?: {
            id: string;
            caption?: string;
          };
        }>;
      };
    }>;
  }>;
}

interface WhatsAppMessage {
  from: string;
  type: string;
  id: string;
  text?: {
    body: string;
  };
  image?: {
    id: string;
    caption?: string;
  };
}

/**
 * WhatsApp webhook verification endpoint
 * WhatsApp Business API will call this to verify the webhook
 */
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;
  
  const verifyToken = getWebhookVerifyToken();
  
  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.warn('Webhook verification failed', { mode, token });
    res.sendStatus(403);
  }
});

/**
 * WhatsApp webhook endpoint for receiving messages
 */
router.post('/webhook', async (req: Request<{}, string, WhatsAppWebhookBody>, res: Response<string>) => {
  try {
    const body = req.body;
    
    logger.debug('Webhook received', { body });
    
    // WhatsApp Business API webhook structure
    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];
      
      for (const entry of entries) {
        const changes = entry.changes || [];
        
        for (const change of changes) {
          const value = change.value;
          
          // Handle messages
          if (value?.messages) {
            for (const message of value.messages) {
              await handleMessage(message);
            }
          }
        }
      }
    }
    
    // Always respond with 200 to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    const err = error as Error;
    logger.error('Error processing webhook', { error: err.message });
    res.status(500).send('Error processing webhook');
  }
});

/**
 * Download image from WhatsApp Business API
 */
async function downloadWhatsAppImage(imageId: string): Promise<string> {
  try {
    const accessToken = getWhatsAppAccessToken();
    
    // Step 1: Get media URL from WhatsApp API
    const mediaUrl = `https://graph.facebook.com/v18.0/${imageId}`;
    logger.debug('Fetching media URL', { imageId, mediaUrl });
    
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!mediaResponse.ok) {
      const errorData = await mediaResponse.json() as { error?: unknown };
      throw new Error(`Failed to get media URL: ${JSON.stringify(errorData)}`);
    }
    
    const mediaData = await mediaResponse.json() as { url?: string };
    
    if (!mediaData.url) {
      throw new Error('Media URL not found in response');
    }
    
    logger.debug('Media URL retrieved', { imageId, url: mediaData.url });
    
    // Step 2: Download the actual image
    const imageResponse = await fetch(mediaData.url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    // Step 3: Convert to base64 data URL
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    
    // Determine content type from response or default to PNG
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    
    const dataUrl = `data:${contentType};base64,${base64}`;
    
    logger.info('Image downloaded successfully', { imageId, size: base64.length });
    
    return dataUrl;
  } catch (error) {
    const err = error as Error;
    logger.error('Error downloading WhatsApp image', { error: err.message, imageId });
    throw error;
  }
}

interface WhatsAppSendResponse {
  messages?: Array<{ id: string }>;
}

/**
 * Send WhatsApp message via WhatsApp Business API
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<WhatsAppSendResponse> {
  try {
    const phoneNumberId = getWhatsAppPhoneNumberId();
    const accessToken = getWhatsAppAccessToken();
    
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    
    logger.debug('Sending WhatsApp message', { phone, url });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: {
          body: message
        }
      })
    });
    
    const data = await response.json() as WhatsAppSendResponse & { error?: unknown };
    
    if (!response.ok) {
      logger.error('WhatsApp API error', { 
        error: data, 
        phone, 
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`);
    }
    
    logger.info('WhatsApp message sent successfully', { 
      phone, 
      messageId: data.messages?.[0]?.id,
      responseLength: message.length
    });
    
    return data;
  } catch (error) {
    const err = error as Error;
    // If credentials are not set, log a helpful error
    if (err.message.includes('environment variable is not set')) {
      logger.error('WhatsApp credentials not configured', { 
        error: err.message,
        hint: 'Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN environment variables'
      });
    } else {
      logger.error('Error sending WhatsApp message', { 
        error: err.message, 
        phone,
        stack: err.stack
      });
    }
    throw error;
  }
}

/**
 * Handle incoming WhatsApp message
 */
async function handleMessage(message: WhatsAppMessage): Promise<void> {
  try {
    const phone = message.from;
    const messageType = message.type;
    const messageId = message.id;
    
    logger.info('Message received', { phone, messageType, messageId });
    
    // Check if member exists
    if (memberExists(phone)) {
      logger.info('Existing member message - ignoring', { phone });
      // For existing members, we ignore and let human handle
      // Clear their conversation history since they're done with onboarding
      clearConversation(phone);
      return;
    }
    
    // Process message for new members
    let textMessage = '';
    let imageUrl: string | null = null;
    
    if (messageType === 'text') {
      textMessage = message.text?.body || '';
    } else if (messageType === 'image') {
      const imageId = message.image?.id;
      if (imageId) {
        // Send processing message immediately
        try {
          await sendWhatsAppMessage(phone, '⏳ Por favor espere mientras procesamos la imagen...');
        } catch (error) {
          const err = error as Error;
          logger.warn('Failed to send processing message', { error: err.message });
        }
        
        try {
          imageUrl = await downloadWhatsAppImage(imageId);
          logger.info('Image downloaded for processing', { phone, imageId });
        } catch (error) {
          const err = error as Error;
          logger.error('Error downloading image, continuing without image', { 
            error: err.message, 
            imageId,
            phone 
          });
          // Continue processing without image - agent can still respond
        }
      }
      textMessage = message.image?.caption || '';
    }
    
    // Process message even if image download failed (agent can acknowledge)
    // Only skip if there's absolutely no content
    if (!textMessage && !imageUrl) {
      logger.warn('Message has no text or image content', { phone, messageType });
      // Still send a response acknowledging the message
      await sendWhatsAppMessage(phone, 'Recibí su mensaje, pero no pude procesar el contenido. Por favor, intente nuevamente.');
      return;
    }
    
    // Process with OpenAI
    const response = await processMessage(phone, textMessage, imageUrl);
    
    // Send response back via WhatsApp
    logger.info('Response generated', { phone, responseLength: response.length });
    await sendWhatsAppMessage(phone, response);
    
  } catch (error) {
    const err = error as Error;
    logger.error('Error handling message', { error: err.message });
  }
}

export default router;
