/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * Message role enum matching Prisma schema.
 */
export const messageRoleEnum = z.enum(["AI", "HUMAN"]);

/**
 * Attachment type enum matching Prisma schema.
 */
export const attachmentTypeEnum = z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]);

/**
 * Schema for attachment input.
 */
export const attachmentInputSchema = z.object({
  type: attachmentTypeEnum,
  url: z.url({ error: "Invalid attachment URL" }),
  name: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().int().positive().optional()
});

/**
 * Schema for getting chat history.
 * Must provide either memberId OR userId, but not both.
 */
export const getChatHistorySchema = z
  .object({
    memberId: z.uuid({ error: "Invalid member ID" }).optional(),
    userId: z.uuid({ error: "Invalid user ID" }).optional(),
    limit: z.number().int().positive().max(100).optional(),
    offset: z.number().int().nonnegative().optional()
  })
  .refine((data) => data.memberId || data.userId, {
    message: "Either memberId or userId is required"
  })
  .refine((data) => !(data.memberId && data.userId), {
    message: "Cannot specify both memberId and userId"
  });

/**
 * Schema for adding a message to chat history.
 * Must provide either memberId OR userId, but not both.
 */
export const addMessageSchema = z
  .object({
    memberId: z.uuid({ error: "Invalid member ID" }).optional(),
    userId: z.uuid({ error: "Invalid user ID" }).optional(),
    role: messageRoleEnum,
    content: z.string().min(1, "Content is required"),
    tools: z.array(z.string()).optional(),
    attachments: z.array(attachmentInputSchema).optional()
  })
  .refine((data) => data.memberId || data.userId, {
    message: "Either memberId or userId is required"
  })
  .refine((data) => !(data.memberId && data.userId), {
    message: "Cannot specify both memberId and userId"
  });

/**
 * Input type for getting chat history.
 */
export type GetChatHistoryInput = z.infer<typeof getChatHistorySchema>;

/**
 * Input type for adding a message.
 */
export type AddMessageInput = z.infer<typeof addMessageSchema>;

/**
 * Input type for attachment.
 */
export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

/**
 * Message role type.
 */
export type MessageRole = z.infer<typeof messageRoleEnum>;

/**
 * Attachment type.
 */
export type AttachmentType = z.infer<typeof attachmentTypeEnum>;
