/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Orchestrates one customer's QCobro sync: recompute AUTO tags, evaluate
 * portfolio rules, diff against the last-synced set, push the delta. One
 * direction only — Mikro never reads membership back from QCobro. Best-effort:
 * never throws, so a QCobro outage can't break payment recording or the cron
 * tick for other customers.
 */
import { getConfig, type DbClient, type ResolvedMikroConfig } from "@mikro/common";
import { createReconcileCustomerTags } from "../tags/createReconcileCustomerTags.js";
import { evaluatePortfolioRules } from "./createEvaluatePortfolioRules.js";
import { computeCustomerBalance, type LoanForBalance } from "./createComputeBalance.js";
import { createQCobroClient, type QCobroClient } from "./createQCobroClient.js";
import { logger } from "../logger.js";

export interface SyncCustomerToQCobroOptions {
  getConfigFn?: () => ResolvedMikroConfig;
  client?: QCobroClient;
  asOf?: Date;
}

export interface SyncCustomerToQCobroResult {
  customerId: string;
  targetPortfolios: string[];
  added: string[];
  removed: string[];
  balance: number;
}

function parsePortfolioSet(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function createSyncCustomerToQCobro(
  client: DbClient,
  options?: SyncCustomerToQCobroOptions
) {
  const resolveConfig = options?.getConfigFn ?? getConfig;
  const reconcileCustomerTags = createReconcileCustomerTags(client, {
    getConfigFn: resolveConfig,
    asOf: options?.asOf
  });

  return async (customerId: string): Promise<SyncCustomerToQCobroResult | null> => {
    const asOf = options?.asOf ?? new Date();
    const cfg = resolveConfig();
    const qcobroClient = options?.client ?? createQCobroClient(cfg.qcobro);

    try {
      await reconcileCustomerTags(customerId);

      const [customer, tagRows, loans] = await Promise.all([
        client.customer.findUnique({ where: { id: customerId } }),
        client.customerTag.findMany({ where: { customerId } }),
        client.loan.findMany({
          where: { customerId },
          include: {
            customer: { select: { preferredPaymentDay: true } },
            payments: { where: { status: { in: ["COMPLETED", "PARTIAL", "PENDING"] } } }
          }
        }) as Promise<LoanForBalance[]>
      ]);

      if (!customer) {
        logger.error("qcobro sync: customer not found", { customerId });
        return null;
      }

      const tags = tagRows.map((t) => t.tag);
      const targetPortfolios = evaluatePortfolioRules(tags, cfg.qcobro.portfolios);
      const lastSynced = parsePortfolioSet(customer.lastSyncedPortfolios);

      const added = targetPortfolios.filter((p) => !lastSynced.includes(p));
      const removed = lastSynced.filter((p) => !targetPortfolios.includes(p));

      const balance = computeCustomerBalance(loans, cfg.qcobro.balanceBasis, cfg.loans, asOf);

      await qcobroClient.upsertAccount({
        externalId: customer.id,
        name: customer.name,
        phone: customer.phone,
        balance
      });

      if (added.length > 0 || removed.length > 0) {
        await qcobroClient.setPortfolios({ externalId: customer.id, add: added, remove: removed });
      }

      await client.customer.update({
        where: { id: customerId },
        data: { lastSyncedPortfolios: JSON.stringify(targetPortfolios) }
      });

      logger.verbose("qcobro sync complete", {
        customerId,
        targetPortfolios,
        added,
        removed,
        balance
      });

      return { customerId, targetPortfolios, added, removed, balance };
    } catch (err) {
      logger.error("qcobro sync failed", { customerId, error: (err as Error).message });
      return null;
    }
  };
}
