/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { MessageRole, AttachmentType } from "../schemas/message.js";

/**
 * Attachment entity type.
 */
export interface Attachment {
  id: string;
  type: AttachmentType;
  url: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
  messageId: string;
  createdAt: Date;
}

/**
 * Message entity type.
 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  tools?: string | null;
  memberId?: string | null;
  userId?: string | null;
  createdAt: Date;
  attachments?: Attachment[];
}
