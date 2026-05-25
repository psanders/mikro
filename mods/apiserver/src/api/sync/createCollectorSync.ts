/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { amountToNumber, getConfig, type DbClient } from "@mikro/common";
import { logger } from "../../logger.js";

export interface CustomerSnapshot {
  id: string;
  name: string;
  nickname: string | null;
  phone: string;
  idNumber: string;
  collectionPoint: string | null;
  homeAddress: string;
  preferredPaymentDay: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PaymentSnapshot {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  status: string;
  kind: string;
  linkedPaymentId: string | null;
  notes: string | null;
  loanId: string;
  collectedById: string;
  createdAt: string;
}

export interface LoanSnapshot {
  id: string;
  loanId: number;
  status: string;
  principal: number;
  termLength: number;
  paymentAmount: number;
  paymentFrequency: string;
  moraRate: number | null;
  startingDate: string | null;
  nickname: string | null;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  payments: PaymentSnapshot[];
}

export interface LoanNoteSnapshot {
  id: string;
  content: string;
  createdAt: string;
  loanId: string;
  createdById: string;
  createdBy: string;
}

export interface MoraConfig {
  defaultMoraRate: number;
  moraGraceDays: number;
  moraCapInCuotas: number;
  moraMinDop: number;
  moraStopOnDefault: boolean;
  moraEffectiveFrom: string | null;
}

export interface CollectorSyncResult {
  collector: { id: string; name: string };
  customers: CustomerSnapshot[];
  loans: LoanSnapshot[];
  loanNotes: LoanNoteSnapshot[];
  moraConfig: MoraConfig;
  syncedAt: string;
}

export function createCollectorSync(client: DbClient) {
  return async (params: { collectorId: string }): Promise<CollectorSyncResult> => {
    logger.verbose("collector sync started", { collectorId: params.collectorId });

    const [collector, allCustomers] = await Promise.all([
      client.user.findUnique({ where: { id: params.collectorId } }),
      client.customer.findMany({ where: { isActive: true } })
    ]);

    const loans = await client.loan.findMany({
      where: { status: "ACTIVE" },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            preferredPaymentDay: true
          }
        },
        payments: {
          where: { status: { in: ["COMPLETED", "PARTIAL", "PENDING"] } }
        }
      }
    });

    const loanNoteResults: LoanNoteSnapshot[] = [];
    for (const l of loans) {
      const notes = await client.loanNote.findMany({
        where: { loanId: l.id },
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } }
      });
      for (const n of notes) {
        loanNoteResults.push({
          id: n.id,
          content: n.content,
          createdAt: n.createdAt.toISOString(),
          loanId: n.loanId,
          createdById: n.createdBy.name,
          createdBy: n.createdBy.name
        });
      }
    }

    const cfg = getConfig();

    type LoanWithPayments = (typeof loans)[number] & {
      payments: Array<{
        id: string;
        amount: unknown;
        paidAt: Date;
        method: string;
        status: string;
        kind: string;
        linkedPaymentId: string | null;
        notes: string | null;
        loanId: string;
        collectedById: string;
        createdAt: Date;
      }>;
    };

    const result: CollectorSyncResult = {
      collector: {
        id: params.collectorId,
        name: collector?.name ?? "Cobrador"
      },
      customers: allCustomers.map((c) => ({
        id: c.id,
        name: c.name,
        nickname: c.nickname ?? null,
        phone: c.phone,
        idNumber: c.idNumber,
        collectionPoint: c.collectionPoint ?? null,
        homeAddress: c.homeAddress,
        preferredPaymentDay: c.preferredPaymentDay ?? null,
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString()
      })),
      loans: (loans as LoanWithPayments[]).map((l) => ({
        id: l.id,
        loanId: l.loanId,
        status: l.status,
        principal: amountToNumber(l.principal),
        termLength: l.termLength,
        paymentAmount: amountToNumber(l.paymentAmount),
        paymentFrequency: l.paymentFrequency,
        moraRate: l.moraRate != null ? amountToNumber(l.moraRate) : null,
        startingDate: l.startingDate ? new Date(l.startingDate).toISOString() : null,
        nickname: l.nickname,
        customerId: l.customerId,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        payments: l.payments.map((p) => ({
          id: p.id,
          amount: amountToNumber(p.amount),
          paidAt: p.paidAt.toISOString(),
          method: p.method,
          status: p.status,
          kind: p.kind,
          linkedPaymentId: p.linkedPaymentId,
          notes: p.notes,
          loanId: p.loanId,
          collectedById: p.collectedById,
          createdAt: p.createdAt.toISOString()
        }))
      })),
      loanNotes: loanNoteResults,
      moraConfig: {
        defaultMoraRate: cfg.loans.defaultMoraRate,
        moraGraceDays: cfg.loans.moraGraceDays,
        moraCapInCuotas: cfg.loans.moraCapInCuotas,
        moraMinDop: cfg.loans.moraMinDop,
        moraStopOnDefault: cfg.loans.moraStopOnDefault,
        moraEffectiveFrom: cfg.loans.moraEffectiveFrom ?? null
      },
      syncedAt: new Date().toISOString()
    };

    logger.verbose("collector sync complete", {
      collectorId: params.collectorId,
      customers: allCustomers.length,
      loans: loans.length,
      loanNotes: loanNoteResults.length
    });

    return result;
  };
}
