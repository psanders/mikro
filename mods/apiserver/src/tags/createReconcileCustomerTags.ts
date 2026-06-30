/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  getConfig,
  type DbClient,
  type ResolvedMikroConfig,
  type StatusTag,
  type DpdTag
} from "@mikro/common";
import {
  computeCustomerTags,
  type ComputedCustomerTags,
  type LoanForTagEngine
} from "./createComputeCustomerTags.js";
import { logger } from "../logger.js";

export interface ReconcileCustomerTagsOptions {
  getConfigFn?: () => ResolvedMikroConfig;
  asOf?: Date;
}

/**
 * Recompute and persist a customer's AUTO (status:/dpd:) tags from current loan
 * state. Idempotent upsert/delete; never touches MANUAL (risk:) tags. Returns
 * the derived status/dpd so callers (e.g. the QCobro sync) don't need a second
 * read.
 */
export function createReconcileCustomerTags(
  client: DbClient,
  options?: ReconcileCustomerTagsOptions
) {
  const resolveConfig = options?.getConfigFn ?? getConfig;

  return async (customerId: string): Promise<ComputedCustomerTags> => {
    const asOf = options?.asOf ?? new Date();
    const cfg = resolveConfig();

    const loans = (await client.loan.findMany({
      where: { customerId },
      include: {
        customer: { select: { preferredPaymentDay: true } },
        payments: { where: { status: { in: ["COMPLETED", "PARTIAL", "PENDING"] } } }
      }
    })) as LoanForTagEngine[];

    const computed = computeCustomerTags(loans, cfg.loans, asOf);

    const existing = await client.customerTag.findMany({ where: { customerId } });
    const existingAuto = existing.filter((t) => t.source === "AUTO");

    const desired = [computed.statusTag, computed.dpdTag].filter(
      (t): t is StatusTag | DpdTag => t !== null
    );

    const stale = existingAuto.filter((t) => !desired.some((d) => d === t.tag)).map((t) => t.tag);
    if (stale.length > 0) {
      await client.customerTag.deleteMany({
        where: { customerId, tag: { in: stale }, source: "AUTO" }
      });
    }

    for (const tag of desired) {
      await client.customerTag.upsert({
        where: { customerId_tag: { customerId, tag } },
        create: { customerId, tag, source: "AUTO" },
        update: { source: "AUTO", setAt: asOf }
      });
    }

    logger.verbose("customer AUTO tags reconciled", {
      customerId,
      statusTag: computed.statusTag,
      dpdTag: computed.dpdTag,
      removed: stale
    });

    return computed;
  };
}
