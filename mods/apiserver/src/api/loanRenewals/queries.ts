/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reads for the renewal process: one renewal, the live quote, open renewals
 * (for the feed) and a customer's renewals (for the profile).
 */
import { z } from "zod/v4";
import {
  ValidationError,
  getLoanRenewalQuoteSchema,
  getLoanRenewalSchema,
  getOpenLoanRenewalSchema,
  isOpenRenewalStatus,
  listLoanRenewalsByCustomerSchema,
  listOpenLoanRenewalsSchema,
  roundMoney,
  type GetLoanRenewalInput,
  type GetOpenLoanRenewalInput,
  type GetLoanRenewalQuoteInput,
  type ListLoanRenewalsByCustomerInput,
  type ListOpenLoanRenewalsInput,
  type LoanRenewalStatus
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { loadRenewal, owedNow, viewOf, type LoanRenewalView } from "./support.js";

function parse<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new ValidationError(r.error);
  return r.data;
}

export function createGetLoanRenewal(client: PrismaClient) {
  return async (raw: GetLoanRenewalInput): Promise<LoanRenewalView> => {
    const { id } = parse(getLoanRenewalSchema, raw);
    return viewOf(await loadRenewal(client, id));
  };
}

/**
 * The renewal still in progress on a loan (by its human number), or null. Lets
 * "Renovar" open the existing renewal instead of trying to start a second one.
 */
export function createGetOpenLoanRenewal(client: PrismaClient) {
  return async (raw: GetOpenLoanRenewalInput): Promise<LoanRenewalView | null> => {
    const { loanId } = parse(getOpenLoanRenewalSchema, raw);
    const r = await client.loanRenewal.findFirst({
      where: { openKey: { not: null }, loan: { loanId } },
      include: { loan: true, customer: true }
    });
    return r ? viewOf(r) : null;
  };
}

export interface LoanRenewalQuote {
  renewalId: string;
  status: LoanRenewalStatus;
  oldLoanNumber: number;
  /** The old loan's remaining balance and net accrued mora, right now. */
  remainingBalance: number;
  moraAccrued: number;
  /** What the customer owes on the old loan (remaining balance + mora). */
  owed: number;
  /** The new loan's principal, from the stored terms. */
  principal: number;
  /** principal − owed: what leaves the account if finalized now. */
  net: number;
  /** The net the user last saw, and whether it differs from `net` now. */
  quotedNet: number | null;
  changed: boolean;
}

/**
 * Live quote for a renewal. Open renewals are priced against the old loan's
 * snapshot now; a finished renewal returns what was stored when it ended (the
 * old loan's mora is frozen at `closedAt` once renewed, but the stored figures
 * are what the ledger actually used).
 */
export function createGetLoanRenewalQuote(client: PrismaClient) {
  return async (raw: GetLoanRenewalQuoteInput): Promise<LoanRenewalQuote> => {
    const { id } = parse(getLoanRenewalQuoteSchema, raw);
    const r = await loadRenewal(client, id);
    const principal = Number(r.principal);
    const quotedNet = r.quotedNet == null ? null : Number(r.quotedNet);
    if (!isOpenRenewalStatus(r.status as LoanRenewalStatus)) {
      const owed = r.quotedOwed == null ? 0 : Number(r.quotedOwed);
      return {
        renewalId: r.id,
        status: r.status as LoanRenewalStatus,
        oldLoanNumber: r.loan.loanId,
        remainingBalance: owed,
        moraAccrued: 0,
        owed,
        principal,
        net: quotedNet ?? roundMoney(principal - owed),
        quotedNet,
        changed: false
      };
    }
    const now = await owedNow(client, r.loan.loanId);
    const net = roundMoney(principal - now.owed);
    return {
      renewalId: r.id,
      status: r.status as LoanRenewalStatus,
      oldLoanNumber: r.loan.loanId,
      remainingBalance: now.remainingBalance,
      moraAccrued: now.moraAccrued,
      owed: now.owed,
      principal,
      net,
      quotedNet,
      changed: quotedNet != null && roundMoney(quotedNet) !== net
    };
  };
}

/** Renewals still in progress, newest first (the feed's pinned open cards). */
export function createListOpenLoanRenewals(client: PrismaClient) {
  return async (raw: ListOpenLoanRenewalsInput = {}): Promise<LoanRenewalView[]> => {
    const { limit } = parse(listOpenLoanRenewalsSchema, raw);
    const rows = await client.loanRenewal.findMany({
      where: { openKey: { not: null } },
      include: { loan: true, customer: true },
      orderBy: { createdAt: "desc" },
      take: limit ?? 50
    });
    return rows.map(viewOf);
  };
}

/** Every renewal of a customer's loans, newest first. */
export function createListLoanRenewalsByCustomer(client: PrismaClient) {
  return async (raw: ListLoanRenewalsByCustomerInput): Promise<LoanRenewalView[]> => {
    const { customerId } = parse(listLoanRenewalsByCustomerSchema, raw);
    const rows = await client.loanRenewal.findMany({
      where: { customerId },
      include: { loan: true, customer: true },
      orderBy: { createdAt: "desc" }
    });
    return rows.map(viewOf);
  };
}
