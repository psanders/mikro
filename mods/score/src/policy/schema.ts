/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The credit policy format. Every threshold, weight, hard NO and evidence item
 * lives in a JSON document validated by `creditPolicySchema`; the evaluator
 * knows nothing about credit. See openspec/changes/add-credit-decision-engine/design.md (D4).
 */
import { z } from "zod";

/* ───────────── Expressions ───────────── */

export type Literal = string | number | boolean | null | Literal[];

export type Expr =
  | Literal
  | { fact: string }
  | { op: ArithOp; args: Expr[] }
  | { coalesce: Expr[] }
  | { if: Cond; then: Expr; else: Expr }
  | { agg: AggOp; of: string; field?: string; where?: Cond }
  | { daysSince: Expr }
  | { yearsSince: Expr }
  | { normalize: Expr };

export const ARITH_OPS = ["add", "sub", "mul", "div", "min", "max", "abs", "round"] as const;
export const AGG_OPS = ["count", "sum", "min", "max", "avg"] as const;
export type ArithOp = (typeof ARITH_OPS)[number];
export type AggOp = (typeof AGG_OPS)[number];

/* ───────────── Conditions ───────────── */

export const COMPARE_OPS = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "notIn",
  "contains",
  "between",
  "matches"
] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { left: Expr; op: CompareOp; right: Expr }
  | { exists: string }
  | { missing: string }
  | { any_item: string; where: Cond };

const path = z.string().min(1);

const literalSchema: z.ZodType<Literal> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(literalSchema)])
);

export const exprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.union([
    literalSchema,
    z.strictObject({ fact: path }),
    z.strictObject({ op: z.enum(ARITH_OPS), args: z.array(exprSchema).min(1) }),
    z.strictObject({ coalesce: z.array(exprSchema).min(1) }),
    z.strictObject({ if: condSchema, then: exprSchema, else: exprSchema }),
    z.strictObject({
      agg: z.enum(AGG_OPS),
      of: path,
      field: path.optional(),
      where: condSchema.optional()
    }),
    z.strictObject({ daysSince: exprSchema }),
    z.strictObject({ yearsSince: exprSchema }),
    z.strictObject({ normalize: exprSchema })
  ])
);

export const condSchema: z.ZodType<Cond> = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(condSchema).min(1) }),
    z.strictObject({ any: z.array(condSchema).min(1) }),
    z.strictObject({ not: condSchema }),
    z.strictObject({ left: exprSchema, op: z.enum(COMPARE_OPS), right: exprSchema }),
    z.strictObject({ exists: path }),
    z.strictObject({ missing: path }),
    z.strictObject({ any_item: path, where: condSchema })
  ])
);

/* ───────────── Policy ───────────── */

const code = z.string().regex(/^[A-Z][A-Z0-9_]*$/, "UPPER_SNAKE code");
const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, "identifier");

export const OUTCOMES = ["REJECT", "REVIEW", "APPROVE"] as const;
export type Outcome = (typeof OUTCOMES)[number];

const ruleSchema = z.strictObject({
  id: code,
  when: condSchema,
  outcome: z.enum(["REJECT", "REVIEW"]),
  reason: code,
  message: z.string().min(1)
});

const mapSchema = z.union([
  z.strictObject({ from: z.tuple([z.number(), z.number()]) }),
  z.strictObject({
    bins: z.array(z.strictObject({ when: condSchema, points: z.number().min(0).max(100) })).min(1)
  })
]);

const componentSchema = z.strictObject({
  id,
  label: z.string().min(1),
  weight: z.number().positive(),
  value: exprSchema,
  map: mapSchema,
  /** "skip" (default): leave the score and reweight the rest. A number: use it (0–100). */
  whenMissing: z.union([z.literal("skip"), z.number().min(0).max(100)]).optional()
});

const bandSchema = z.strictObject({
  min: z.number().min(0).max(100),
  outcome: z.enum(OUTCOMES),
  reason: code.optional(),
  message: z.string().min(1).optional()
});

const evidenceSchema = z.strictObject({
  id,
  label: z.string().min(1),
  /** Fact paths this evidence fills; a trailing ".*" matches the whole subtree. */
  provides: z.array(path).min(1),
  /** Relative cost (each bureau lookup costs money). */
  cost: z.number().nonnegative()
});

export const creditPolicySchema = z
  .strictObject({
    id,
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "semver"),
    /** Per source: how long a report counts. Lookups are never required. */
    facts: z.record(z.string(), z.strictObject({ maxAgeDays: z.number().int().positive() })),
    derive: z.record(id, exprSchema).default({}),
    rules: z.array(ruleSchema),
    score: z.strictObject({ components: z.array(componentSchema).min(1) }),
    bands: z.array(bandSchema).min(1),
    evidence: z.array(evidenceSchema).default([])
  })
  .superRefine((p, ctx) => {
    const ids = new Set<string>();
    for (const r of p.rules) {
      if (ids.has(r.id)) ctx.addIssue({ code: "custom", message: `duplicate rule id ${r.id}` });
      ids.add(r.id);
    }
    if (!p.bands.some((b) => b.min === 0)) {
      ctx.addIssue({ code: "custom", message: "bands must include one with min 0" });
    }
  });

export type CreditPolicy = z.infer<typeof creditPolicySchema>;
export type PolicyRule = CreditPolicy["rules"][number];
export type ScoreComponent = CreditPolicy["score"]["components"][number];
