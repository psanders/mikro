/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { CreateMemberInput, UpdateMemberInput } from "../schemas/member.js";
import type { UpdateUserInput, Role } from "../schemas/user.js";
import type { MessageRole, AttachmentInput } from "../schemas/message.js";
import type { PaymentFrequency, LoanType } from "../schemas/loan.js";
import type { PaymentMethod, PaymentStatus } from "../schemas/payment.js";
import type { Member } from "./member.js";
import type { User } from "./user.js";
import type { Message } from "./message.js";
import type { Loan, Payment } from "./loan.js";

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
    create(args: { data: { name: string; phone: string } }): Promise<User>;
    update(args: { where: { id: string }; data: Omit<UpdateUserInput, "id"> }): Promise<User>;
    findUnique(args: { where: { id: string } }): Promise<User | null>;
    findFirst(args: {
      where: { phone: string };
      include?: { roles?: { select?: { role: boolean } } };
    }): Promise<(User & { roles?: Array<{ role: Role }> }) | null>;
    findMany(args?: {
      where?: { enabled?: boolean };
      include?: {
        roles?: {
          select?: { role: boolean };
        };
      };
      take?: number;
      skip?: number;
    }): Promise<(User & { roles?: Array<{ role: Role }> })[]>;
  };

  userRole: {
    create(args: { data: { userId: string; role: Role } }): Promise<UserRole>;
    findFirst(args: { where: { userId: string } }): Promise<UserRole | null>;
  };

  member: {
    create(args: { data: CreateMemberInput }): Promise<Member>;
    update(args: { where: { id: string }; data: Omit<UpdateMemberInput, "id"> }): Promise<Member>;
    delete(args: { where: { id: string } }): Promise<Member>;
    findUnique(args: { where: { id: string } }): Promise<Member | null>;
    findFirst(args: { where: { phone: string } }): Promise<Member | null>;
    findMany(args?: {
      where?: {
        isActive?: boolean;
        referredById?: string;
        assignedCollectorId?: string;
      };
      take?: number;
      skip?: number;
    }): Promise<Member[]>;
    findMany(args: {
      where?: {
        isActive?: boolean;
        referredById?: string;
        assignedCollectorId?: string;
      };
      include: {
        loans?: {
          where?: { status?: string };
          include?: {
            payments?: {
              where?: { status?: string };
              orderBy?: { paidAt: "asc" | "desc" };
              take?: number;
            };
          };
        };
        referredBy?: { select?: { name?: boolean } };
      };
      take?: number;
      skip?: number;
    }): Promise<MemberWithLoansAndReferrer[]>;
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

  loan: {
    create(args: {
      data: {
        loanId: number;
        memberId: string;
        principal: number;
        termLength: number;
        paymentAmount: number;
        paymentFrequency: PaymentFrequency;
        type?: LoanType;
      };
    }): Promise<Loan>;
    findFirst(args: {
      orderBy: { loanId: "asc" | "desc" };
      select?: { loanId: boolean };
    }): Promise<{ loanId: number } | null>;
    findUnique(args: {
      where: { id: string } | { loanId: number };
      include?: {
        member?:
          | boolean
          | {
              select?: {
                id?: boolean;
                name?: boolean;
                phone?: boolean;
                assignedCollectorId?: boolean;
              };
            };
      };
      select?: {
        id?: boolean;
        loanId?: boolean;
        [key: string]: boolean | undefined;
      };
    }): Promise<Loan | null>;
    findMany(args?: {
      where?: {
        memberId?: string;
        status?: string | { not: string };
        member?: {
          referredById?: string;
          assignedCollectorId?: string;
        };
      };
      include?: {
        member?:
          | boolean
          | {
              select?: {
                name?: boolean;
                phone?: boolean;
              };
            };
      };
      take?: number;
      skip?: number;
    }): Promise<Loan[]>;
  };

  payment: {
    create(args: {
      data: {
        loanId: string;
        amount: number;
        paidAt?: Date;
        method?: PaymentMethod;
        collectedById: string;
        notes?: string;
      };
    }): Promise<Payment>;
    update(args: {
      where: { id: string };
      data: {
        status?: PaymentStatus;
        notes?: string;
      };
    }): Promise<Payment>;
    findUnique(args: { where: { id: string } }): Promise<Payment | null>;
    findUnique(args: {
      where: { id: string };
      include: {
        loan?: {
          include?: {
            member?: boolean;
            payments?: {
              where?: { status?: PaymentStatus };
              orderBy?: { paidAt: "asc" | "desc" };
            };
          };
        };
        collectedBy?: boolean;
      };
    }): Promise<PaymentWithRelations | null>;
    findMany(args: {
      where?: {
        status?: PaymentStatus;
        loanId?: string;
        paidAt?: {
          gte?: Date;
          lte?: Date;
        };
        loan?: {
          memberId?: string;
          member?: {
            referredById?: string;
          };
        };
      };
      include?: {
        loan?: {
          select?: {
            loanId?: boolean;
            member?: {
              select?: {
                name?: boolean;
              };
            };
          };
        };
      };
      orderBy?: { paidAt: "asc" | "desc" };
      take?: number;
      skip?: number;
    }): Promise<Payment[]>;
  };
}

/**
 * Payment with related entities for receipt generation.
 */
export interface PaymentWithRelations extends Payment {
  loan: Loan & {
    member: Member;
    payments: Payment[];
  };
  collectedBy?: User | null;
}

/**
 * Member with loans and referrer for report export.
 */
export interface MemberWithLoansAndReferrer extends Member {
  loans: Array<
    Loan & {
      payments: Payment[];
    }
  >;
  referredBy: { name: string };
}
