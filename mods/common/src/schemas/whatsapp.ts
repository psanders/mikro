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
 * Schema for WhatsApp message audio content (voice notes).
 */
export const whatsappAudioSchema = z.object({
  id: z.string()
});

/**
 * Schema for a WhatsApp Flow completion reply (`interactive.nfm_reply`). When a
 * user submits a Flow, the form answers arrive as a JSON string in
 * `response_json`. Parsed downstream into the application payload.
 */
export const whatsappNfmReplySchema = z.object({
  response_json: z.string(),
  body: z.string().optional(),
  name: z.string().optional()
});

/**
 * Schema for the `interactive` content of an incoming message. Only the Flow
 * reply (`nfm_reply`) is consumed today.
 */
export const whatsappInteractiveSchema = z.object({
  type: z.string(),
  nfm_reply: whatsappNfmReplySchema.optional()
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
  timestamp: z.string(),
  text: whatsappTextSchema.optional(),
  image: whatsappImageSchema.optional(),
  audio: whatsappAudioSchema.optional(),
  interactive: whatsappInteractiveSchema.optional()
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

/** One body/header parameter: positional (string) or named (parameter_name + text). */
const templateParameterSchema = z.union([
  z.string(),
  z.object({ parameter_name: z.string().min(1), text: z.string() })
]);

/**
 * Schema for sending a WhatsApp template message (approved templates only).
 * Language code is required and must be provided by the caller (e.g. "es_DO").
 * Use named parameters when the template was created with named placeholders (e.g. {{payment_number}}).
 */
export const sendWhatsAppTemplateSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  templateName: z.string().min(1, "Template name is required"),
  languageCode: z.string().min(2, "Language code is required").max(5),
  /** Header component parameters: positional (string) or named ({ parameter_name, text }). */
  headerParameters: z.array(templateParameterSchema).optional().default([]),
  /** Body component parameters: positional (string) or named ({ parameter_name, text }). */
  bodyParameters: z.array(templateParameterSchema).optional().default([]),
  /**
   * Public URL for an IMAGE header. Required when the template was created with an
   * image header — WhatsApp treats it as a per-send parameter (the sample image
   * set in the template is not reused). Omit for text or no-header templates.
   */
  headerImageUrl: z.string().url().optional(),
  /**
   * Flow button token. Required when the template's CTA is a WhatsApp Flow
   * button: the send must include a `sub_type: "flow"` button component carrying
   * this token (echoed back in the nfm_reply). Omit for templates without a Flow
   * button. Optional `flowActionData` seeds the Flow's first screen if it needs input.
   */
  flowToken: z.string().min(1).optional(),
  flowActionData: z.record(z.string(), z.unknown()).optional()
});

/**
 * Media type enum for WhatsApp messages.
 */
export const mediaTypeEnum = z.enum(["image", "document", "video", "audio"]);

/**
 * Parameters for sending an interactive WhatsApp Flow message — a button that
 * opens a native in-chat form (used for the prospect loan-application intake).
 * The flow itself is a published asset on the Meta side, referenced by `flowId`.
 */
export const whatsappFlowMessageSchema = z.object({
  /** Published Flow ID from WhatsApp Manager. */
  flowId: z.string().min(1, "flowId is required"),
  /** Opaque token echoed back in the nfm_reply webhook (correlates submission). */
  flowToken: z.string().min(1, "flowToken is required"),
  /** First screen id to open (e.g. "SOLICITUD"). */
  screen: z.string().min(1, "screen is required"),
  /** Button label that opens the flow. */
  cta: z.string().min(1, "cta is required"),
  /** Message body text shown above the button. */
  body: z.string().min(1, "body is required"),
  /** Optional header text. */
  header: z.string().optional(),
  /** Optional footer text. */
  footer: z.string().optional(),
  /**
   * "draft" sends an unpublished Flow (only WABA admins/testers can open it) —
   * used to test before the business is verified. Omitted = published.
   */
  mode: z.enum(["draft", "published"]).optional()
});

export type WhatsAppFlowMessageInput = z.infer<typeof whatsappFlowMessageSchema>;

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
    caption: z.string().optional(),

    /**
     * Interactive WhatsApp Flow message: renders a button that opens a native
     * in-chat form. When set, the message is sent as an `interactive` flow and
     * all text/media fields are ignored.
     */
    flow: whatsappFlowMessageSchema.optional()
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
      data.audioId ||
      data.flow,
    {
      message:
        "Either message, imageUrl, mediaId, documentUrl, documentId, videoUrl, videoId, audioUrl, audioId, or flow must be provided"
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
 * Type for WhatsApp message audio content (voice notes).
 */
export type WhatsAppAudio = z.infer<typeof whatsappAudioSchema>;

/**
 * Type for a WhatsApp Flow completion reply.
 */
export type WhatsAppNfmReply = z.infer<typeof whatsappNfmReplySchema>;

/**
 * Type for the interactive content of an incoming message.
 */
export type WhatsAppInteractive = z.infer<typeof whatsappInteractiveSchema>;

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
 * Input type for sending a WhatsApp template message.
 */
export type SendWhatsAppTemplateInput = z.infer<typeof sendWhatsAppTemplateSchema>;

/**
 * Media type for WhatsApp messages.
 */
export type MediaType = z.infer<typeof mediaTypeEnum>;
