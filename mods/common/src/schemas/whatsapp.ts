/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * Schema for WhatsApp message text content.
 */
export const whatsappTextSchema = z.object({
  body: z.string()
});

/**
 * Schema for WhatsApp message image content.
 */
export const whatsappImageSchema = z.object({
  id: z.string(),
  caption: z.string().optional()
});

/**
 * Enum for WhatsApp incoming message types.
 * These are the message types that can be received from the WhatsApp webhook.
 */
export const whatsappMessageTypeEnum = z.enum([
  "text",
  "image",
  "audio",
  "video",
  "document",
  "sticker",
  "location",
  "contacts",
  "interactive",
  "button",
  "reaction",
  "unsupported"
]);

/**
 * Schema for an individual WhatsApp message from webhook.
 */
export const whatsappMessageSchema = z.object({
  from: z.string(),
  type: whatsappMessageTypeEnum,
  id: z.string(),
  text: whatsappTextSchema.optional(),
  image: whatsappImageSchema.optional()
});

/**
 * Schema for WhatsApp webhook change value.
 */
export const whatsappChangeValueSchema = z.object({
  messages: z.array(whatsappMessageSchema).optional()
});

/**
 * Schema for WhatsApp webhook change.
 */
export const whatsappChangeSchema = z.object({
  value: whatsappChangeValueSchema.optional()
});

/**
 * Schema for WhatsApp webhook entry.
 */
export const whatsappEntrySchema = z.object({
  changes: z.array(whatsappChangeSchema).optional()
});

/**
 * Schema for the full WhatsApp webhook body.
 */
export const whatsappWebhookSchema = z.object({
  object: z.string().optional(),
  entry: z.array(whatsappEntrySchema).optional()
});

/**
 * Media type enum for WhatsApp messages.
 */
export const mediaTypeEnum = z.enum(["image", "document", "video", "audio"]);

/**
 * Schema for sending a WhatsApp message.
 * Supports text, image, document, video, and audio messages.
 *
 * For text messages: provide phone and message
 * For media messages: provide phone and either:
 *   - imageUrl/mediaId with mediaType="image" and optional caption
 *   - documentUrl/documentId with mediaType="document", optional caption and filename
 *   - videoUrl/videoId with mediaType="video" and optional caption
 *   - audioUrl/audioId with mediaType="audio" (no caption supported)
 *
 * When using mediaId (uploaded media), mediaType should be specified.
 * When using URL fields (imageUrl, documentUrl, etc.), mediaType is inferred.
 */
export const sendWhatsAppMessageSchema = z
  .object({
    phone: z.string().min(1, "Phone number is required"),

    /** Text message content (required for text messages) */
    message: z.string().optional(),

    // Image fields (backward compatible)
    /** Public URL to the image */
    imageUrl: z.string().url().optional(),

    // Document fields
    /** Public URL to the document */
    documentUrl: z.string().url().optional(),
    /** Document ID from WhatsApp upload */
    documentId: z.string().optional(),
    /** Filename for the document (displayed to recipient) */
    documentFilename: z.string().optional(),

    // Video fields
    /** Public URL to the video */
    videoUrl: z.string().url().optional(),
    /** Video ID from WhatsApp upload */
    videoId: z.string().optional(),

    // Audio fields
    /** Public URL to the audio */
    audioUrl: z.string().url().optional(),
    /** Audio ID from WhatsApp upload */
    audioId: z.string().optional(),

    // Generic media fields
    /** Media ID from WhatsApp upload (for any media type) */
    mediaId: z.string().optional(),
    /** Media type when using mediaId (required when mediaId is used without specific URL) */
    mediaType: mediaTypeEnum.optional(),

    /** Caption for image, document, or video messages (not supported for audio) */
    caption: z.string().optional()
  })
  .refine(
    (data) =>
      data.message ||
      data.imageUrl ||
      data.mediaId ||
      data.documentUrl ||
      data.documentId ||
      data.videoUrl ||
      data.videoId ||
      data.audioUrl ||
      data.audioId,
    {
      message:
        "Either message, imageUrl, mediaId, documentUrl, documentId, videoUrl, videoId, audioUrl, or audioId must be provided"
    }
  );

/**
 * Type for WhatsApp message text content.
 */
export type WhatsAppText = z.infer<typeof whatsappTextSchema>;

/**
 * Type for WhatsApp message image content.
 */
export type WhatsAppImage = z.infer<typeof whatsappImageSchema>;

/**
 * Type for WhatsApp incoming message types.
 */
export type WhatsAppMessageType = z.infer<typeof whatsappMessageTypeEnum>;

/**
 * Type for an individual WhatsApp message from webhook.
 */
export type WhatsAppMessage = z.infer<typeof whatsappMessageSchema>;

/**
 * Type for WhatsApp webhook change value.
 */
export type WhatsAppChangeValue = z.infer<typeof whatsappChangeValueSchema>;

/**
 * Type for WhatsApp webhook change.
 */
export type WhatsAppChange = z.infer<typeof whatsappChangeSchema>;

/**
 * Type for WhatsApp webhook entry.
 */
export type WhatsAppEntry = z.infer<typeof whatsappEntrySchema>;

/**
 * Type for the full WhatsApp webhook body.
 */
export type WhatsAppWebhookBody = z.infer<typeof whatsappWebhookSchema>;

/**
 * Input type for sending a WhatsApp message.
 */
export type SendWhatsAppMessageInput = z.infer<typeof sendWhatsAppMessageSchema>;

/**
 * Media type for WhatsApp messages.
 */
export type MediaType = z.infer<typeof mediaTypeEnum>;
