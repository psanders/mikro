/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pure, deterministic credit policy evaluator (design D5). Decides with the
 * information in hand: a fact whose source wasn't consulted is *unknown*;
 * rules that depend on it don't change the outcome (they come back as
 * `unchecked`), and score components without a value are skipped and the rest
 * reweighted. Bureau lookups only ever show up as optional next steps.
 */
import type {
  AggOp,
  ArithOp,
  CompareOp,
  Cond,
  CreditPolicy,
  Expr,
  Outcome,
  ScoreComponent
} from "./schema.js";

/** Unknown: the fact's source wasn't consulted (or the value can't be computed from it). */
const UNKNOWN: unique symbol = Symbol("unknown");
type Value = unknown;
type Tri = true | false | typeof UNKNOWN;

export type Facts = Record<string, unknown>;

export interface Reason {
  code: string;
  message: string;
}

export interface ComponentResult {
  id: string;
  label: string;
  weight: number;
  raw: number | null;
  mapped: number | null;
  used: boolean;
}

export interface UncheckedRule {
  rule: string;
  outcome: "REJECT" | "REVIEW";
  reason: string;
  message: string;
  missing: string[];
}

export interface NextStep {
  id: string;
  label: string;
  cost: number;
  /** Getting it could change the outcome (an unchecked hard NO, or a band cutoff in reach). */
  couldChange: boolean;
}

export interface Decision {
  outcome: Outcome;
  reasons: Reason[];
  mikroScore: number | null;
  components: ComponentResult[];
  sourcesUsed: string[];
  unchecked: UncheckedRule[];
  nextSteps: NextStep[];
  trace: {
    rules: { id: string; result: "true" | "false" | "unknown" }[];
    derived: Record<string, unknown>;
  };
}

interface Scope {
  facts: Facts;
  derived: Record<string, Value>;
  derivedMissing: Record<string, Set<string>>;
  item?: Value;
  now: Date;
  /** Fact paths that resolved to unknown while evaluating the current expression. */
  missing: Set<string>;
}

const isUnknown = (v: Value): v is typeof UNKNOWN => v === UNKNOWN;
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function lookup(root: unknown, segments: string[]): Value {
  let cur: unknown = root;
  for (const s of segments) {
    if (cur === null || cur === undefined) return UNKNOWN;
    if (Array.isArray(cur) && /^\d+$/.test(s)) cur = cur[Number(s)];
    else if (isObj(cur)) cur = cur[s];
    else return UNKNOWN;
  }
  return cur === undefined ? UNKNOWN : cur;
}

function resolvePath(path: string, sc: Scope): Value {
  if (path === "$") return sc.item === undefined ? UNKNOWN : sc.item;
  if (path.startsWith("$.")) return lookup(sc.item, path.slice(2).split("."));
  const [head, ...rest] = path.split(".");
  if (head === "derived") {
    const name = rest[0];
    const v = name in sc.derived ? sc.derived[name] : UNKNOWN;
    const out = isUnknown(v) ? v : lookup(v, rest.slice(1));
    if (isUnknown(out)) for (const m of sc.derivedMissing[name] ?? [path]) sc.missing.add(m);
    return out;
  }
  const v = lookup(sc.facts, [head, ...rest]);
  if (isUnknown(v)) sc.missing.add(path);
  return v;
}

const toNum = (v: Value): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function toDate(v: Value): Date | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? "1")));
}

function normalize(v: Value): Value {
  if (typeof v !== "string") return v;
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function arith(op: ArithOp, vals: Value[]): Value {
  if (vals.some(isUnknown)) return UNKNOWN;
  const nums = vals.map(toNum);
  if (nums.some((n) => n === null)) return null;
  const n = nums as number[];
  switch (op) {
    case "add":
      return n.reduce((a, b) => a + b, 0);
    case "sub":
      return n.slice(1).reduce((a, b) => a - b, n[0]);
    case "mul":
      return n.reduce((a, b) => a * b, 1);
    case "div":
      return n.slice(1).some((d) => d === 0) ? null : n.slice(1).reduce((a, b) => a / b, n[0]);
    case "min":
      return Math.min(...n);
    case "max":
      return Math.max(...n);
    case "abs":
      return Math.abs(n[0]);
    case "round":
      return Math.round(n[0]);
  }
}

function aggregate(op: AggOp, values: number[]): number | null {
  if (op === "count") return values.length;
  if (values.length === 0) return op === "sum" ? 0 : null;
  if (op === "sum") return values.reduce((a, b) => a + b, 0);
  if (op === "min") return Math.min(...values);
  if (op === "max") return Math.max(...values);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function evalExpr(e: Expr, sc: Scope): Value {
  if (e === null || typeof e !== "object") return e;
  if (Array.isArray(e)) return e;
  if ("fact" in e) return resolvePath(e.fact, sc);
  if ("op" in e)
    return arith(
      e.op,
      e.args.map((a) => evalExpr(a, sc))
    );
  if ("coalesce" in e) {
    for (const a of e.coalesce) {
      const v = evalExpr(a, sc);
      if (!isUnknown(v) && v !== null) return v;
    }
    return UNKNOWN;
  }
  if ("if" in e) {
    const c = evalCond(e.if, sc);
    if (isUnknown(c)) return UNKNOWN;
    return evalExpr(c ? e.then : e.else, sc);
  }
  if ("agg" in e) {
    const arr = resolvePath(e.of, sc);
    if (isUnknown(arr)) return UNKNOWN;
    if (!Array.isArray(arr)) return null;
    const picked: number[] = [];
    let unknown = false;
    for (const item of arr) {
      const inner: Scope = { ...sc, item };
      if (e.where) {
        const w = evalCond(e.where, inner);
        if (isUnknown(w)) unknown = true;
        if (w !== true) continue;
      }
      if (e.agg === "count") {
        picked.push(1);
        continue;
      }
      const v = e.field ? resolvePath(e.field, inner) : item;
      const n = toNum(v);
      if (n !== null) picked.push(n);
    }
    return unknown ? UNKNOWN : aggregate(e.agg, picked);
  }
  if ("daysSince" in e || "yearsSince" in e) {
    const v = evalExpr("daysSince" in e ? e.daysSince : e.yearsSince, sc);
    if (isUnknown(v)) return UNKNOWN;
    const d = toDate(v);
    if (!d) return null;
    const days = (sc.now.getTime() - d.getTime()) / 86_400_000;
    return "daysSince" in e ? Math.floor(days) : Math.floor(days / 365.25);
  }
  if ("normalize" in e) {
    const v = evalExpr(e.normalize, sc);
    return isUnknown(v) ? v : normalize(v);
  }
  return null;
}

function compare(op: CompareOp, l: Value, r: Value): Tri {
  if (isUnknown(l) || isUnknown(r)) return UNKNOWN;
  switch (op) {
    case "eq":
      return l === r;
    case "ne":
      return l !== r;
    case "in":
      return Array.isArray(r) ? r.includes(l) : false;
    case "notIn":
      return Array.isArray(r) ? !r.includes(l) : true;
    case "contains":
      return Array.isArray(l)
        ? l.includes(r)
        : typeof l === "string" && typeof r === "string" && l.includes(r);
    case "matches":
      return typeof l === "string" && typeof r === "string" && new RegExp(r).test(l);
    case "between": {
      const n = toNum(l);
      if (n === null || !Array.isArray(r) || r.length !== 2) return false;
      const [lo, hi] = r.map(toNum);
      return lo !== null && hi !== null && n >= lo && n <= hi;
    }
    default: {
      const a = toNum(l);
      const b = toNum(r);
      if (a === null || b === null) return false;
      if (op === "gt") return a > b;
      if (op === "gte") return a >= b;
      if (op === "lt") return a < b;
      return a <= b;
    }
  }
}

function evalCond(c: Cond, sc: Scope): Tri {
  if ("all" in c) {
    let unknown = false;
    for (const x of c.all) {
      const v = evalCond(x, sc);
      if (v === false) return false;
      if (isUnknown(v)) unknown = true;
    }
    return unknown ? UNKNOWN : true;
  }
  if ("any" in c) {
    let unknown = false;
    for (const x of c.any) {
      const v = evalCond(x, sc);
      if (v === true) return true;
      if (isUnknown(v)) unknown = true;
    }
    return unknown ? UNKNOWN : false;
  }
  if ("not" in c) {
    const v = evalCond(c.not, sc);
    return isUnknown(v) ? v : !v;
  }
  if ("exists" in c) {
    const v = resolvePath(c.exists, sc);
    return !isUnknown(v) && v !== null;
  }
  if ("missing" in c) {
    const v = resolvePath(c.missing, sc);
    return isUnknown(v) || v === null;
  }
  if ("any_item" in c) {
    const arr = resolvePath(c.any_item, sc);
    if (isUnknown(arr)) return UNKNOWN;
    if (!Array.isArray(arr)) return false;
    return anyItem(arr, c.where, sc);
  }
  return compare(c.op, evalExpr(c.left, sc), evalExpr(c.right, sc));
}

function anyItem(arr: unknown[], where: Cond, sc: Scope): Tri {
  let unknown = false;
  for (const item of arr) {
    const v = evalCond(where, { ...sc, item });
    if (v === true) return true;
    if (isUnknown(v)) unknown = true;
  }
  return unknown ? UNKNOWN : false;
}

function mapComponent(c: ScoreComponent, raw: number, sc: Scope): number | null {
  if ("from" in c.map) {
    const [lo, hi] = c.map.from;
    if (hi === lo) return null;
    return Math.min(100, Math.max(0, ((raw - lo) / (hi - lo)) * 100));
  }
  for (const bin of c.map.bins) {
    if (evalCond(bin.when, { ...sc, item: raw, missing: new Set() }) === true) return bin.points;
  }
  return null;
}

function weighted(parts: { weight: number; value: number }[]): number | null {
  const total = parts.reduce((a, p) => a + p.weight, 0);
  if (total === 0) return null;
  return parts.reduce((a, p) => a + p.weight * p.value, 0) / total;
}

function bandOf(policy: CreditPolicy, score: number) {
  const sorted = [...policy.bands].sort((a, b) => b.min - a.min);
  return sorted.find((b) => score >= b.min) ?? sorted[sorted.length - 1];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function matchesProvides(provides: string[], path: string): boolean {
  return provides.some((p) =>
    p.endsWith(".*") ? path === p.slice(0, -2) || path.startsWith(p.slice(0, -1)) : path === p
  );
}

/**
 * Evaluates `policy` against `facts` at time `now`. Deterministic: the same
 * inputs always return the same decision (replayable from a stored snapshot).
 */
export function evaluateCreditPolicy(
  policy: CreditPolicy,
  facts: Facts,
  now: Date = new Date()
): Decision {
  const base: Scope = { facts, derived: {}, derivedMissing: {}, now, missing: new Set() };

  // 1. derive
  for (const [name, expr] of Object.entries(policy.derive)) {
    const sc: Scope = { ...base, missing: new Set() };
    const v = evalExpr(expr, sc);
    base.derived[name] = v;
    if (sc.missing.size) base.derivedMissing[name] = sc.missing;
  }

  // 2. rules (all evaluated, for a complete trace)
  const traceRules: Decision["trace"]["rules"] = [];
  const fired: { outcome: "REJECT" | "REVIEW"; reason: Reason }[] = [];
  const unchecked: UncheckedRule[] = [];
  for (const r of policy.rules) {
    const sc: Scope = { ...base, missing: new Set() };
    const v = evalCond(r.when, sc);
    traceRules.push({ id: r.id, result: isUnknown(v) ? "unknown" : v ? "true" : "false" });
    if (v === true)
      fired.push({ outcome: r.outcome, reason: { code: r.reason, message: r.message } });
    else if (isUnknown(v))
      unchecked.push({
        rule: r.id,
        outcome: r.outcome,
        reason: r.reason,
        message: r.message,
        missing: [...sc.missing].sort()
      });
  }

  // 3. score from the components present
  const components: ComponentResult[] = [];
  const skippedMissing: { c: ScoreComponent; missing: string[] }[] = [];
  for (const c of policy.score.components) {
    const sc: Scope = { ...base, missing: new Set() };
    const v = evalExpr(c.value, sc);
    const raw = toNum(v);
    const mapped = raw === null ? null : mapComponent(c, raw, sc);
    if (mapped !== null) {
      components.push({
        id: c.id,
        label: c.label,
        weight: c.weight,
        raw,
        mapped: round1(mapped),
        used: true
      });
    } else if (typeof c.whenMissing === "number") {
      components.push({
        id: c.id,
        label: c.label,
        weight: c.weight,
        raw,
        mapped: c.whenMissing,
        used: true
      });
    } else {
      components.push({
        id: c.id,
        label: c.label,
        weight: c.weight,
        raw,
        mapped: null,
        used: false
      });
      skippedMissing.push({ c, missing: [...sc.missing] });
    }
  }
  const usedParts = components
    .filter((c) => c.used && c.mapped !== null)
    .map((c) => ({ weight: c.weight, value: c.mapped as number }));
  const score = weighted(usedParts);
  const mikroScore = score === null ? null : Math.round(score);

  // 4. outcome
  const rejects = fired.filter((f) => f.outcome === "REJECT").map((f) => f.reason);
  const reviews = fired.filter((f) => f.outcome === "REVIEW").map((f) => f.reason);
  let outcome: Outcome;
  let reasons: Reason[];
  const band = mikroScore === null ? null : bandOf(policy, mikroScore);
  if (rejects.length) {
    outcome = "REJECT";
    reasons = rejects;
  } else if (reviews.length) {
    outcome = "REVIEW";
    reasons = reviews;
  } else if (band) {
    outcome = band.outcome;
    reasons = band.reason ? [{ code: band.reason, message: band.message ?? band.reason }] : [];
  } else {
    outcome = "REVIEW";
    reasons = [{ code: "NO_SCORE", message: "No hay datos para calcular el Mikro Score" }];
  }

  // 5. next steps: optional, with cost; the ones that could change the outcome first
  const stepMap = new Map<string, NextStep>();
  // A source already in the facts was consulted: never suggest paying for it again.
  const consulted = (provides: string[]) =>
    provides.some((p) => {
      const root = p.endsWith(".*") ? p.slice(0, -2) : null;
      return root !== null && !root.includes(".") && facts[root] !== undefined;
    });
  const addSteps = (paths: string[], couldChange: boolean) => {
    for (const ev of policy.evidence) {
      if (consulted(ev.provides)) continue;
      if (!paths.some((p) => matchesProvides(ev.provides, p))) continue;
      const prev = stepMap.get(ev.id);
      stepMap.set(ev.id, {
        id: ev.id,
        label: ev.label,
        cost: ev.cost,
        couldChange: (prev?.couldChange ?? false) || couldChange
      });
    }
  };
  for (const u of unchecked) addSteps(u.missing, u.outcome === "REJECT" && outcome !== "REJECT");
  for (const { c, missing } of skippedMissing) {
    let crosses = false;
    if (band && outcome !== "REJECT" && !reviews.length) {
      for (const extreme of [0, 100]) {
        const s = weighted([...usedParts, { weight: c.weight, value: extreme }]);
        if (s !== null && bandOf(policy, Math.round(s)).outcome !== band.outcome) crosses = true;
      }
    }
    addSteps(missing, crosses);
  }
  const nextSteps = [...stepMap.values()].sort(
    (a, b) =>
      Number(b.couldChange) - Number(a.couldChange) || a.cost - b.cost || a.id.localeCompare(b.id)
  );

  const derivedTrace: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(base.derived)) derivedTrace[k] = isUnknown(v) ? "unknown" : v;

  return {
    outcome,
    reasons,
    mikroScore,
    components,
    sourcesUsed: components.filter((c) => c.used).map((c) => c.id),
    unchecked,
    nextSteps,
    trace: { rules: traceRules, derived: derivedTrace }
  };
}
