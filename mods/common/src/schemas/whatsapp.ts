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
 * Schema for an individual WhatsApp message from webhook.
 */
export const whatsappMessageSchema = z.object({
  from: z.string(),
  type: z.string(),
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
 * Schema for sending a WhatsApp message.
 * Supports both text messages and image messages.
 * - For text: provide phone and message
 * - For image: provide phone, imageUrl, and optional caption
 */
export const sendWhatsAppMessageSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  /** Text message content (required for text messages) */
  message: z.string().optional(),
  /** Public URL to the image (required for image messages) */
  imageUrl: z.string().url().optional(),
  /** Caption for image messages */
  caption: z.string().optional()
}).refine(
  (data) => data.message || data.imageUrl,
  { message: "Either message or imageUrl must be provided" }
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
