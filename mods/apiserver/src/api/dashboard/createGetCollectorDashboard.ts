/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  amountToNumber,
  getCycleMetrics,
  getDueDateForCycle,
  daysLateFromOldestDue,
  type DbClient,
  type Loan,
  type LoanPaymentData
} from "@mikro/common";
import { logger } from "../../logger.js";

export interface DashboardVisit {
  loanId: number;
  customerId: string;
  customerName: string;
  loanNickname: string | null;
  address: string;
  paymentAmount: number;
  installmentNumber: number;
  termLength: number;
  /** Repayment still owed: term x cuota minus installment money collected (>= 0). */
  remainingBalance: number;
  /** True when the next cuota's due date is today or earlier (day-of-week route model). */
  dueToday: boolean;
  isOverdue: boolean;
  daysOverdue: number;
  paidToday: boolean;
  amountPaidToday: number;
  nextDueDate: string;
}

export interface CollectorDashboard {
  collector: { id: string; name: string };
  dailyTarget: number;
  amountCollected: number;
  visitsDone: number;
  visitsPending: number;
  visits: DashboardVisit[];
}

export function createGetCollectorDashboard(client: DbClient) {
  return async (params: { collectorId: string }): Promise<CollectorDashboard> => {
    logger.verbose("fetching collector dashboard", { collectorId: params.collectorId });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [collector, loans, todayPayments] = await Promise.all([
      client.user.findUnique({ where: { id: params.collectorId } }),

      client.loan.findMany({
        where: {
          customer: { assignedCollectorId: params.collectorId },
          status: "ACTIVE"
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              homeAddress: true,
              collectionPoint: true,
              preferredPaymentDay: true
            }
          },
          payments: {
            where: { kind: "INSTALLMENT", status: { in: ["COMPLETED", "PARTIAL"] } },
            select: { paidAt: true, status: true, amount: true }
          }
        }
      }),

      client.payment.findMany({
        where: {
          collectedById: params.collectorId,
          paidAt: { gte: startOfDay, lte: endOfDay },
          status: { not: "REVERSED" },
          kind: { in: ["INSTALLMENT", "LATE_FEE"] }
        }
      })
    ]);

    const collectorName = collector?.name ?? "Cobrador";
    const paidLoanIds = new Set(todayPayments.map((p) => p.loanId));
    const paidAmountByLoan = new Map<string, number>();
    for (const p of todayPayments) {
      paidAmountByLoan.set(
        p.loanId,
        (paidAmountByLoan.get(p.loanId) ?? 0) + amountToNumber(p.amount)
      );
    }

    const amountCollected = todayPayments.reduce((sum, p) => sum + amountToNumber(p.amount), 0);

    type LoanWithRelations = Loan & {
      customer: {
        id: string;
        name: string;
        homeAddress: string;
        collectionPoint: string | null;
        preferredPaymentDay: string | null;
      };
      payments: Array<{ paidAt: Date; status: string; amount: unknown }>;
    };

    const loansWithRelations = loans as LoanWithRelations[];

    const visits: DashboardVisit[] = loansWithRelations
      .map((l) => {
        const loanData: LoanPaymentData = {
          paymentFrequency: l.paymentFrequency,
          createdAt: l.createdAt,
          startingDate: l.startingDate,
          termLength: l.termLength,
          preferredPaymentDay: l.customer.preferredPaymentDay,
          paymentAmount: amountToNumber(l.paymentAmount),
          payments: l.payments.map((p) => ({
            paidAt: p.paidAt,
            status: p.status,
            amount: amountToNumber(p.amount)
          }))
        };

        const metrics = getCycleMetrics(loanData, now);
        const paid = paidLoanIds.has(l.id);
        const loanStart = new Date(l.startingDate ?? l.createdAt);

        const daysOverdue =
          !paid && metrics.missedCycles > 0
            ? daysLateFromOldestDue(
                loanStart,
                l.paymentFrequency,
                l.customer.preferredPaymentDay ?? null,
                metrics.paymentsMade,
                metrics.missedCycles,
                now
              )
            : 0;

        const nextDue = getDueDateForCycle(
          loanStart,
          metrics.paymentsMade,
          l.paymentFrequency,
          l.customer.preferredPaymentDay ?? null
        );
        const totalInstallmentPaid = l.payments.reduce((s, p) => s + amountToNumber(p.amount), 0);
        const remainingBalance = Math.max(
          0,
          amountToNumber(l.paymentAmount) * l.termLength - totalInstallmentPaid
        );

        return {
          loanId: l.loanId,
          customerId: l.customer.id,
          customerName: l.customer.name,
          loanNickname: l.nickname,
          address: l.customer.collectionPoint ?? l.customer.homeAddress,
          paymentAmount: amountToNumber(l.paymentAmount),
          installmentNumber: metrics.paymentsMade + 1,
          termLength: l.termLength,
          remainingBalance,
          dueToday: nextDue.getTime() <= endOfDay.getTime(),
          isOverdue: !paid && daysOverdue > 0,
          daysOverdue: paid ? 0 : daysOverdue,
          paidToday: paid,
          amountPaidToday: paidAmountByLoan.get(l.id) ?? 0,
          nextDueDate: nextDue.toISOString()
        };
      })
      .sort((a, b) => {
        if (a.paidToday !== b.paidToday) return a.paidToday ? 1 : -1;
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
        return a.customerName.localeCompare(b.customerName);
      });

    // Day-of-week route model: today's meta covers only customers due today or
    // overdue (plus what was already collected today); ask capped at what's left.
    const dailyTarget = visits.reduce((sum, v) => {
      if (v.paidToday) return sum + v.amountPaidToday;
      if (v.dueToday || v.isOverdue) return sum + Math.min(v.paymentAmount, v.remainingBalance);
      return sum;
    }, 0);
    const paidCustomerIds = new Set(visits.filter((v) => v.paidToday).map((v) => v.customerId));
    const dueCustomerIds = new Set(
      visits
        .filter((v) => !v.paidToday && (v.dueToday || v.isOverdue) && v.remainingBalance > 0)
        .map((v) => v.customerId)
    );
    const visitsDone = paidCustomerIds.size;
    const visitsPending = [...dueCustomerIds].filter((id) => !paidCustomerIds.has(id)).length;

    logger.verbose("collector dashboard ready", {
      collectorId: params.collectorId,
      activeLoans: loans.length,
      visitsDone,
      visitsPending
    });

    return {
      collector: { id: params.collectorId, name: collectorName },
      dailyTarget,
      amountCollected,
      visitsDone,
      visitsPending,
      visits
    };
  };
}
