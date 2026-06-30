/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Cron-driven recompute + sync. Deterioration (an account going past due) has
 * no triggering event, so this walks the active customer base on
 * `qcobro.schedule` and resyncs everyone. Pairs with the on-payment trigger
 * (immediate, for the curing direction). See QCOBRO.md "How the integration
 * works".
 */
import { Cron } from "croner";
import { getConfig, type DbClient, type ResolvedMikroConfig } from "@mikro/common";
import { createSyncCustomerToQCobro } from "./createSyncCustomerToQCobro.js";
import { isQCobroConfigured } from "./createQCobroClient.js";
import { logger } from "../logger.js";

export interface CreateQCobroWorkerOptions {
  getConfigFn?: () => ResolvedMikroConfig;
}

/**
 * Starts the QCobro cron worker. Returns a stop function. If qcobro
 * credentials are still placeholders, the job still runs on schedule (so
 * AUTO tags stay current even before QCobro is wired up) but pushes are
 * no-ops — see `createQCobroClient`.
 */
export function createQCobroWorker(
  client: DbClient,
  options?: CreateQCobroWorkerOptions
): () => void {
  const resolveConfig = options?.getConfigFn ?? getConfig;
  const cfg = resolveConfig();
  const syncCustomerToQCobro = createSyncCustomerToQCobro(client, { getConfigFn: resolveConfig });

  async function tick(): Promise<void> {
    const startedAt = Date.now();
    let customers;
    try {
      customers = await client.customer.findMany({ where: { isActive: true } });
    } catch (err) {
      logger.error("qcobro worker: failed to list customers", { error: (err as Error).message });
      return;
    }

    let synced = 0;
    for (const customer of customers) {
      const result = await syncCustomerToQCobro(customer.id);
      if (result) synced += 1;
    }

    logger.info("qcobro worker: tick complete", {
      customers: customers.length,
      synced,
      durationMs: Date.now() - startedAt
    });
  }

  const job = new Cron(cfg.qcobro.schedule, { timezone: cfg.timezone }, () => {
    tick().catch((err) => {
      logger.error("qcobro worker: tick failed", { error: (err as Error).message });
    });
  });

  logger.info("qcobro worker started", {
    schedule: cfg.qcobro.schedule,
    timezone: cfg.timezone,
    configured: isQCobroConfigured(cfg.qcobro)
  });

  return () => {
    job.stop();
    logger.info("qcobro worker stopped");
  };
}
