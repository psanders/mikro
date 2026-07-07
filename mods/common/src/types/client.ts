/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { CreateCustomerInput, UpdateCustomerInput } from "../schemas/customer.js";
import type { UpdateUserInput, Role } from "../schemas/user.js";
import type { MessageRole, AttachmentInput } from "../schemas/message.js";
import type { PaymentFrequency, LoanType } from "../schemas/loan.js";
import type { PaymentMethod, PaymentStatus } from "../schemas/payment.js";
import type { Customer } from "./customer.js";
import type { User } from "./user.js";
import type { Message } from "./message.js";
import type { Loan, Payment } from "./loan.js";
import type { LoanApplication, ApplicationStatus, ApplicationSource } from "./application.js";
import type { CustomerTag } from "./customerTag.js";
import type { TagSource } from "../schemas/customerTag.js";

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
    create(args: { data: { name: string; phone: string; password?: string } }): Promise<User>;
    update(args: { where: { id: string }; data: Omit<UpdateUserInput, "id"> }): Promise<User>;
    findUnique(args: {
      where: { id: string };
      include?: { roles: { select: { role: true } } };
    }): Promise<(User & { roles?: Array<{ role: Role }> }) | null>;
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
    deleteMany(args: { where: { userId: string } }): Promise<{ count: number }>;
  };

  customer: {
    create(args: { data: CreateCustomerInput }): Promise<Customer>;
    update(args: {
      where: { id: string };
      data: Omit<UpdateCustomerInput, "id">;
    }): Promise<Customer>;
    /** Persist the QCobro sync diff baseline (tag engine / sync service only). */
    update(args: {
      where: { id: string };
      data: { lastSyncedPortfolios?: string | null };
    }): Promise<Customer>;
    delete(args: { where: { id: string } }): Promise<Customer>;
    findUnique(args: {
      where: { id: string };
      include?: Record<string, never>;
    }): Promise<Customer | null>;
    findFirst(args: {
      where: { phone?: string; idNumber?: string };
      include?: Record<string, never>;
    }): Promise<Customer | null>;
    findMany(args?: {
      where?: {
        isActive?: boolean;
        assignedCollectorId?: string;
      };
      include?: Record<string, never>;
      take?: number;
      skip?: number;
    }): Promise<Customer[]>;
    findMany(args: {
      where?: {
        isActive?: boolean;
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
      };
      take?: number;
      skip?: number;
    }): Promise<CustomerWithLoans[]>;
  };

  message: {
    create(args: {
      data: {
        role: MessageRole;
        content: string;
        tools?: string;
        customerId?: string;
        userId?: string;
      };
    }): Promise<Message>;
    findMany(args: {
      where: {
        customerId?: string;
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
        customerId: string;
        principal: number;
        termLength: number;
        paymentAmount: number;
        paymentFrequency: PaymentFrequency;
        startingDate?: Date | null;
        nickname?: string | null;
        type?: LoanType;
        moraRate?: number | null;
      };
    }): Promise<Loan>;
    findFirst(args: {
      orderBy: { loanId: "asc" | "desc" };
      select?: { loanId: boolean };
    }): Promise<{ loanId: number } | null>;
    findUnique(args: {
      where: { id: string } | { loanId: number };
      include?: {
        customer?:
          | boolean
          | {
              select?: {
                id?: boolean;
                name?: boolean;
                nickname?: boolean;
                phone?: boolean;
                assignedCollectorId?: boolean;
                preferredPaymentDay?: boolean;
              };
            };
        payments?: {
          where?: {
            status?: PaymentStatus | { in: PaymentStatus[] };
            kind?: "INSTALLMENT" | "LATE_FEE";
          };
          select?: { paidAt?: boolean; status?: boolean; kind?: boolean; amount?: boolean };
          // Full-row ledger for the evaluation snapshot (all scalar fields + collector name).
          include?: { collectedBy?: boolean | { select?: { name?: boolean } } };
        };
      };
      select?: {
        id?: boolean;
        loanId?: boolean;
        nickname?: boolean;
        [key: string]: boolean | undefined;
      };
    }): Promise<Loan | null>;
    findMany(args?: {
      where?: {
        customerId?: string;
        status?: string | { not: string };
        customer?: {
          assignedCollectorId?: string;
        };
      };
      select?: { loanId?: boolean };
      include?: {
        customer?:
          | boolean
          | {
              select?: {
                id?: boolean;
                name?: boolean;
                phone?: boolean;
                homeAddress?: boolean;
                collectionPoint?: boolean;
                preferredPaymentDay?: boolean;
              };
            };
        payments?: {
          where?: {
            status?: PaymentStatus | { in: PaymentStatus[] };
            kind?: "INSTALLMENT" | "LATE_FEE";
          };
          select?: { paidAt?: boolean; status?: boolean; amount?: boolean };
        };
        _count?: {
          select?: {
            payments?: boolean | { where?: { status?: string; kind?: string } };
          };
        };
      };
      take?: number;
      skip?: number;
    }): Promise<Loan[]>;
    update(args: {
      where: { id: string };
      data: { status?: string; nickname?: string | null };
      select?: { id: boolean; loanId: boolean; status?: boolean; nickname?: boolean };
    }): Promise<{ id: string; loanId: number; status?: string; nickname?: string | null }>;
  };

  payment: {
    create(args: {
      data: {
        loanId: string;
        amount: number;
        paidAt?: Date;
        method?: PaymentMethod;
        status?: PaymentStatus;
        kind?: "INSTALLMENT" | "LATE_FEE";
        linkedPaymentId?: string | null;
        collectedById: string;
        notes?: string | null;
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
            customer?: boolean;
            payments?: {
              where?: {
                status?: PaymentStatus | { in: PaymentStatus[] };
                kind?: "INSTALLMENT" | "LATE_FEE";
              };
              orderBy?: { paidAt: "asc" | "desc" };
            };
          };
        };
        collectedBy?: boolean;
        linkedLateFee?: boolean;
        installmentForLateFee?: boolean;
      };
    }): Promise<PaymentWithRelations | null>;
    findMany(args: {
      where?: {
        status?: PaymentStatus | { not: PaymentStatus } | { in: PaymentStatus[] };
        kind?: "INSTALLMENT" | "LATE_FEE" | { in: ("INSTALLMENT" | "LATE_FEE")[] };
        loanId?: string;
        collectedById?: string;
        paidAt?: {
          gte?: Date;
          lte?: Date;
        };
        loan?: {
          customerId?: string;
        };
      };
      include?: {
        loan?: {
          select?: {
            loanId?: boolean;
            customer?: {
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

  loanNote: {
    create(args: {
      data: {
        content: string;
        loanId: string;
        createdById: string;
      };
    }): Promise<{
      id: string;
      content: string;
      createdAt: Date;
      loanId: string;
      createdById: string;
    }>;
    findMany(args: {
      where: { loanId: string };
      orderBy: { createdAt: "desc" };
      include?: { createdBy: { select: { name: true } } };
    }): Promise<
      Array<{
        id: string;
        content: string;
        createdAt: Date;
        loanId: string;
        createdBy: { name: string };
      }>
    >;
  };

  loanApplication: {
    upsert(args: {
      where: { sessionId: string };
      create: LoanApplicationWriteData & { sessionId: string };
      update: LoanApplicationWriteData;
    }): Promise<LoanApplication>;
    update(args: {
      where: { id: string };
      data: Partial<LoanApplicationWriteData>;
    }): Promise<LoanApplication>;
    delete(args: { where: { id: string } }): Promise<LoanApplication>;
    findUnique(args: { where: { id: string } }): Promise<LoanApplication | null>;
    findFirst(args: { where: { sessionId: string } }): Promise<LoanApplication | null>;
    findFirst(args: {
      where: { phone: string };
      orderBy?: { createdAt?: "asc" | "desc" };
    }): Promise<LoanApplication | null>;
    findMany(args?: {
      where?: { status?: ApplicationStatus };
      orderBy?: { createdAt?: "asc" | "desc" };
      take?: number;
      skip?: number;
    }): Promise<LoanApplication[]>;
  };

  followUpJob: {
    create(args: {
      data: { applicationId: string; type: "NUDGE" | "ABANDON"; scheduledFor: Date };
    }): Promise<FollowUpJob>;
    findMany(args: {
      where: { status: "PENDING"; scheduledFor: { lte: Date } };
    }): Promise<FollowUpJob[]>;
    updateMany(args: {
      where: { applicationId: string; status: "PENDING" };
      data: { status: "CANCELLED" };
    }): Promise<{ count: number }>;
    update(args: {
      where: { id: string };
      data: { status: "DONE" | "CANCELLED" };
    }): Promise<FollowUpJob>;
  };

  customerTag: {
    findMany(args: { where: { customerId: string } }): Promise<CustomerTag[]>;
    upsert(args: {
      where: { customerId_tag: { customerId: string; tag: string } };
      create: { customerId: string; tag: string; source: TagSource };
      update: { source: TagSource; setAt: Date };
    }): Promise<CustomerTag>;
    deleteMany(args: {
      where: { customerId: string; tag?: string | { in: string[] }; source?: TagSource };
    }): Promise<{ count: number }>;
  };

  /** Interactive transaction (Prisma). */
  $transaction: <T>(fn: (tx: DbClient) => Promise<T>) => Promise<T>;
}

/** Writable columns for a loan application upsert. */
export interface LoanApplicationWriteData {
  status: ApplicationStatus;
  lastSection: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  idNumber: string | null;
  dateOfBirth: Date | null;
  maritalStatus: string | null;
  businessType: string | null;
  businessName: string | null;
  requestedAmount: number | null;
  purpose: string | null;
  requestedTermWeeks: number | null;
  province: string | null;
  homeAddress: string | null;
  rawData: unknown;
  scoreData?: unknown;
  score?: number | null;
  riskBand?: string | null;
  recommendation?: string | null;
  scoredAt?: Date | null;
  reviewedById?: string | null;
  reviewedAt?: Date | null;
  reviewNote?: string | null;
  contractFilename?: string | null;
  contractOriginalName?: string | null;
  contractMimeType?: string | null;
  contractSize?: number | null;
  contractSha256?: string | null;
  signedById?: string | null;
  signedAt?: Date | null;
  idFrontFilename?: string | null;
  idFrontOriginalName?: string | null;
  idFrontMimeType?: string | null;
  idFrontSize?: number | null;
  idBackFilename?: string | null;
  idBackOriginalName?: string | null;
  idBackMimeType?: string | null;
  idBackSize?: number | null;
  idUploadedById?: string | null;
  idUploadedAt?: Date | null;
  customerId?: string | null;
  loanId?: number | null;
  submittedAt?: Date | null;
  /** Set only in the `create` block of an upsert; ignored in `update`. */
  source?: ApplicationSource;
}

export interface FollowUpJob {
  id: string;
  applicationId: string;
  type: "NUDGE" | "ABANDON";
  scheduledFor: Date;
  status: "PENDING" | "DONE" | "CANCELLED";
  createdAt: Date;
}

/**
 * Payment with related entities for receipt generation.
 */
export interface PaymentWithRelations extends Payment {
  loan: Loan & {
    customer: Customer;
    payments: Payment[];
  };
  collectedBy?: User | null;
  linkedLateFee?: Payment | null;
  installmentForLateFee?: Payment | null;
}

/**
 * Customer with loans for report export.
 */
export interface CustomerWithLoans extends Customer {
  loans: Array<
    Loan & {
      payments: Payment[];
    }
  >;
}
