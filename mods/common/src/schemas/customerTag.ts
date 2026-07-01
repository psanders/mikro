/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Customer tag taxonomy + schemas. See QCOBRO.md for the full model: tags are
 * hybrid (AUTO, owned by the tag engine; MANUAL, asserted by humans) and live in
 * three namespaces. `status:` and `dpd:` are AUTO-only and recomputed by the
 * engine (mods/apiserver/src/tags); `risk:` is the only namespace settable via
 * the MANUAL API/CLI path.
 */
import { z } from "zod/v4";

/** Who owns a tag: the engine (recomputed every trigger) or a human (set/cleared via API+CLI). */
export const tagSourceEnum = z.enum(["AUTO", "MANUAL"]);
export type TagSource = z.infer<typeof tagSourceEnum>;

/** `status:` — lifecycle (AUTO, mutually exclusive, one per customer). */
export const STATUS_TAGS = [
  "status:new",
  "status:current",
  "status:pre_mora",
  "status:past_due",
  "status:defaulted",
  "status:written_off",
  "status:completed"
] as const;
export type StatusTag = (typeof STATUS_TAGS)[number];

/** `dpd:` — delinquency aging bucket (AUTO, only set when status:past_due or status:written_off). */
export const DPD_TAGS = [
  "dpd:1_7",
  "dpd:8_30",
  "dpd:31_60",
  "dpd:61_90",
  "dpd:91_180",
  "dpd:180_plus"
] as const;
export type DpdTag = (typeof DPD_TAGS)[number];

/** `risk:` — relationship/consent (MANUAL, many per customer, API+CLI only). */
export const RISK_TAGS = [
  "risk:premium",
  "risk:do_not_contact",
  "risk:in_negotiation",
  "risk:payment_plan",
  "risk:fraud_watch",
  "risk:legal"
] as const;
export type RiskTag = (typeof RISK_TAGS)[number];

/** Every tag value Mikro knows about, across all three namespaces. */
export const ALL_TAGS = [...STATUS_TAGS, ...DPD_TAGS, ...RISK_TAGS] as const;
export type CustomerTagValue = StatusTag | DpdTag | RiskTag;

/** A loose `namespace:value` shape check, used by config (qcobro.portfolios[] rules). */
export const tagShapeSchema = z
  .string()
  .regex(/^(status|dpd|risk):[a-z0-9_]+$/, "Tag must look like status:x, dpd:x, or risk:x");

const riskTagEnum = z.enum(RISK_TAGS);

/**
 * Schema for setting (creating or updating) a MANUAL risk: tag on a customer.
 * Only risk: tags may be set this way — status:/dpd: are AUTO-only and owned by
 * the tag engine.
 */
export const setCustomerTagSchema = z.object({
  customerId: z.uuid({ error: "Invalid customer ID" }),
  tag: riskTagEnum
});

/** Schema for clearing a MANUAL risk: tag from a customer. */
export const clearCustomerTagSchema = z.object({
  customerId: z.uuid({ error: "Invalid customer ID" }),
  tag: riskTagEnum
});

/** Schema for listing all tags (AUTO + MANUAL) on a customer. */
export const listCustomerTagsSchema = z.object({
  customerId: z.uuid({ error: "Invalid customer ID" })
});

export type SetCustomerTagInput = z.infer<typeof setCustomerTagSchema>;
export type ClearCustomerTagInput = z.infer<typeof clearCustomerTagSchema>;
export type ListCustomerTagsInput = z.infer<typeof listCustomerTagsSchema>;
