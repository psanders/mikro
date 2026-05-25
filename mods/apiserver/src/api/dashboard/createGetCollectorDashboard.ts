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
  isOverdue: boolean;
  daysOverdue: number;
  paidToday: boolean;
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
            where: { kind: "INSTALLMENT" },
            select: { paidAt: true, status: true }
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

    const dailyTarget = loans.reduce((sum, l) => sum + amountToNumber(l.paymentAmount), 0);
    const amountCollected = todayPayments.reduce((sum, p) => sum + amountToNumber(p.amount), 0);
    const visitsDone = paidLoanIds.size;
    const visitsPending = loans.length - visitsDone;

    type LoanWithRelations = Loan & {
      customer: {
        id: string;
        name: string;
        homeAddress: string;
        collectionPoint: string | null;
        preferredPaymentDay: string | null;
      };
      payments: Array<{ paidAt: Date; status: string }>;
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
          payments: l.payments
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

        return {
          loanId: l.loanId,
          customerId: l.customer.id,
          customerName: l.customer.name,
          loanNickname: l.nickname,
          address: l.customer.collectionPoint ?? l.customer.homeAddress,
          paymentAmount: amountToNumber(l.paymentAmount),
          installmentNumber: metrics.paymentsMade + 1,
          termLength: l.termLength,
          isOverdue: !paid && daysOverdue > 0,
          daysOverdue: paid ? 0 : daysOverdue,
          paidToday: paid,
          nextDueDate: nextDue.toISOString()
        };
      })
      .sort((a, b) => {
        if (a.paidToday !== b.paidToday) return a.paidToday ? 1 : -1;
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
        return a.customerName.localeCompare(b.customerName);
      });

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
