/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Full-base QCobro sync: recompute every active customer's AUTO tags, evaluate
 * `qcobro.portfolios[]` rules, group matching customers by target portfolio, and
 * push **one batch per portfolio** via `syncAccounts`. Replaces the earlier
 * per-customer design — the real API's `syncAccounts` pushes a portfolio's
 * entire account set in one call (`mode: REPLACE` replaces it outright), so a
 * one-row-at-a-time push would wipe a portfolio down to whichever customer was
 * processed last. See createQCobroClient.ts and github.com/psanders/mikro/issues/55.
 *
 * Used both by the cron worker (its own schedule) and the on-payment trigger
 * (a payment can only ever improve standing, so it re-runs this same full pass
 * immediately rather than waiting for the next tick). Re-running the full base
 * on every payment is the "naive to start" tradeoff already flagged in
 * design.md's "Recompute at scale" open item — fine at current volume.
 */
import { getConfig, type DbClient, type ResolvedMikroConfig } from "@mikro/common";
import { createReconcileCustomerTags } from "../tags/createReconcileCustomerTags.js";
import { evaluatePortfolioRules } from "./createEvaluatePortfolioRules.js";
import { computeCustomerBalance, type LoanForBalance } from "./createComputeBalance.js";
import { buildAccountRow } from "./createBuildAccountRow.js";
import { createQCobroClient, type QCobroClient, type AccountRow } from "./createQCobroClient.js";
import { logger } from "../logger.js";

export interface SyncAllPortfoliosOptions {
  getConfigFn?: () => ResolvedMikroConfig;
  client?: QCobroClient;
  asOf?: Date;
}

export interface SyncAllPortfoliosResult {
  customers: number;
  /** Portfolios that received a non-empty batch of matching customers this pass. */
  portfoliosPushed: number;
  /**
   * Portfolios with zero matching customers this pass that were emptied on the
   * QCobro side: with `syncMode: REPLACE` an empty batch is a valid snapshot and
   * archives every account still there (so stale accounts don't linger forever).
   */
  portfoliosCleared: number;
  /**
   * Portfolios with zero matching customers this pass that were left as-is on
   * the QCobro side — only happens outside REPLACE, where an empty batch would
   * change nothing and the API rejects it.
   */
  portfoliosSkipped: number;
  durationMs: number;
}

export function createSyncAllPortfolios(client: DbClient, options?: SyncAllPortfoliosOptions) {
  const resolveConfig = options?.getConfigFn ?? getConfig;
  const reconcileCustomerTags = createReconcileCustomerTags(client, {
    getConfigFn: resolveConfig,
    asOf: options?.asOf
  });

  return async (): Promise<SyncAllPortfoliosResult> => {
    const startedAt = Date.now();
    const asOf = options?.asOf ?? new Date();
    const cfg = resolveConfig();
    const qcobroClient = options?.client ?? createQCobroClient(cfg.qcobro);

    const customers = await client.customer.findMany({ where: { isActive: true } });

    const rowsByPortfolio = new Map<string, AccountRow[]>();
    const targetByCustomer = new Map<string, string[]>();

    for (const customer of customers) {
      try {
        const computed = await reconcileCustomerTags(customer.id);
        const tagRows = await client.customerTag.findMany({ where: { customerId: customer.id } });
        const tags = tagRows.map((t) => t.tag);
        const targetPortfolios = evaluatePortfolioRules(tags, cfg.qcobro.portfolios);
        targetByCustomer.set(customer.id, targetPortfolios);

        if (targetPortfolios.length === 0) continue;

        const [loans, lastPaymentRows] = await Promise.all([
          client.loan.findMany({
            where: { customerId: customer.id },
            include: {
              customer: { select: { preferredPaymentDay: true } },
              payments: { where: { status: { in: ["COMPLETED", "PARTIAL", "PENDING"] } } }
            }
          }) as Promise<LoanForBalance[]>,
          client.payment.findMany({
            where: { loan: { customerId: customer.id }, kind: "INSTALLMENT", status: "COMPLETED" },
            orderBy: { paidAt: "desc" },
            take: 1
          })
        ]);

        const balance = computeCustomerBalance(loans, cfg.qcobro.balanceBasis, cfg.loans, asOf);
        const row = buildAccountRow(customer, loans, computed, balance, lastPaymentRows[0] ?? null);

        for (const portfolioId of targetPortfolios) {
          const rows = rowsByPortfolio.get(portfolioId) ?? [];
          rows.push(row);
          rowsByPortfolio.set(portfolioId, rows);
        }
      } catch (err) {
        logger.error("qcobro sync: failed to process customer", {
          customerId: customer.id,
          error: (err as Error).message
        });
      }
    }

    let portfoliosPushed = 0;
    let portfoliosCleared = 0;
    let portfoliosSkipped = 0;
    for (const rule of cfg.qcobro.portfolios) {
      const rows = rowsByPortfolio.get(rule.id) ?? [];
      // An empty REPLACE batch is a full snapshot saying "nobody belongs here
      // now" — QCobro archives every account still in the portfolio. Other
      // modes can't express that (an empty batch would change nothing and the
      // API rejects it), so those portfolios are left as-is.
      if (rows.length === 0 && cfg.qcobro.syncMode !== "REPLACE") {
        portfoliosSkipped += 1;
        logger.verbose(
          "qcobro sync: portfolio has no matching customers this pass, skipping (only REPLACE can empty a portfolio)",
          { portfolioId: rule.id, mode: cfg.qcobro.syncMode }
        );
        continue;
      }
      try {
        await qcobroClient.syncAccounts({ portfolioId: rule.id, mode: cfg.qcobro.syncMode, rows });
        if (rows.length === 0) {
          portfoliosCleared += 1;
          logger.verbose("qcobro sync: portfolio has no matching customers this pass, emptied it", {
            portfolioId: rule.id
          });
        } else {
          portfoliosPushed += 1;
        }
      } catch (err) {
        logger.error("qcobro sync: syncAccounts failed", {
          portfolioId: rule.id,
          error: (err as Error).message
        });
      }
    }

    // Bookkeeping only — persisted regardless of whether the portfolio push
    // above actually ran, since it reflects what the customer's membership
    // *should* be even when the push failed or was skipped this pass.
    await Promise.all(
      customers.map((customer) => {
        const target = targetByCustomer.get(customer.id) ?? [];
        return client.customer
          .update({
            where: { id: customer.id },
            data: { lastSyncedPortfolios: JSON.stringify(target) }
          })
          .catch((err) => {
            logger.error("qcobro sync: failed to persist lastSyncedPortfolios", {
              customerId: customer.id,
              error: (err as Error).message
            });
          });
      })
    );

    const result: SyncAllPortfoliosResult = {
      customers: customers.length,
      portfoliosPushed,
      portfoliosCleared,
      portfoliosSkipped,
      durationMs: Date.now() - startedAt
    };
    logger.info("qcobro sync: full pass complete", result);
    return result;
  };
}
