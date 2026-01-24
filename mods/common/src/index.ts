/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * @mikro/common - Common utilities and shared code for Mikro
 */

// Errors
export { ValidationError, type FieldError } from "./errors/index.js";

// Utilities
export { withErrorHandlingAndValidation } from "./utils/index.js";

// Schemas
export {
  // Member schemas
  createMemberSchema,
  updateMemberSchema,
  getMemberSchema,
  listMembersSchema,
  listMembersByReferrerSchema,
  listMembersByCollectorSchema,
  type CreateMemberInput,
  type UpdateMemberInput,
  type GetMemberInput,
  type ListMembersInput,
  type ListMembersByReferrerInput,
  type ListMembersByCollectorInput,
  // User schemas
  roleEnum,
  createUserSchema,
  updateUserSchema,
  getUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type GetUserInput,
  type Role,
  // Message schemas
  messageRoleEnum,
  attachmentTypeEnum,
  attachmentInputSchema,
  getChatHistorySchema,
  addMessageSchema,
  type GetChatHistoryInput,
  type AddMessageInput,
  type AttachmentInput,
  type MessageRole,
  type AttachmentType,
  // WhatsApp schemas
  whatsappTextSchema,
  whatsappImageSchema,
  whatsappMessageSchema,
  whatsappChangeValueSchema,
  whatsappChangeSchema,
  whatsappEntrySchema,
  whatsappWebhookSchema,
  sendWhatsAppMessageSchema,
  type WhatsAppText,
  type WhatsAppImage,
  type WhatsAppMessage,
  type WhatsAppChangeValue,
  type WhatsAppChange,
  type WhatsAppEntry,
  type WhatsAppWebhookBody,
  type SendWhatsAppMessageInput
} from "./schemas/index.js";

// Types (entities and client)
export type { Member } from "./types/index.js";
export type { User, UserWithRole } from "./types/index.js";
export type { Attachment, Message } from "./types/index.js";
export type { DbClient, UserRole } from "./types/index.js";
export type { WhatsAppClient, WhatsAppSendResponse } from "./types/index.js";
