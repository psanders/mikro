/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { CreateMemberInput, UpdateMemberInput } from "../schemas/member.js";
import type { UpdateUserInput, Role } from "../schemas/user.js";
import type { MessageRole, AttachmentInput } from "../schemas/message.js";
import type { Member } from "./member.js";
import type { User } from "./user.js";
import type { Message, Attachment } from "./message.js";

/**
 * UserRole entity type.
 */
export interface UserRole {
  id: string;
  userId: string;
  role: Role;
}

/**
 * Unified database client interface.
 * Implement this interface to provide persistence for all entities.
 */
export interface DbClient {
  user: {
    create(args: { data: { name: string; phone?: string } }): Promise<User>;
    update(args: {
      where: { id: string };
      data: Omit<UpdateUserInput, "id">;
    }): Promise<User>;
    findUnique(args: { where: { id: string } }): Promise<User | null>;
  };

  userRole: {
    create(args: { data: { userId: string; role: Role } }): Promise<UserRole>;
    findFirst(args: { where: { userId: string } }): Promise<UserRole | null>;
  };

  member: {
    create(args: { data: CreateMemberInput }): Promise<Member>;
    update(args: {
      where: { id: string };
      data: Omit<UpdateMemberInput, "id">;
    }): Promise<Member>;
    delete(args: { where: { id: string } }): Promise<Member>;
    findUnique(args: { where: { id: string } }): Promise<Member | null>;
    findMany(args?: {
      where?: {
        referredById?: string;
        assignedCollectorId?: string;
      };
      take?: number;
      skip?: number;
    }): Promise<Member[]>;
  };

  message: {
    create(args: {
      data: {
        role: MessageRole;
        content: string;
        tools?: string;
        memberId?: string;
        userId?: string;
      };
    }): Promise<Message>;
    findMany(args: {
      where: {
        memberId?: string;
        userId?: string;
      };
      include?: {
        attachments?: boolean;
      };
      orderBy?: {
        createdAt: "asc" | "desc";
      };
      take?: number;
      skip?: number;
    }): Promise<Message[]>;
  };

  attachment: {
    createMany(args: {
      data: Array<AttachmentInput & { messageId: string }>;
    }): Promise<{ count: number }>;
  };
}
