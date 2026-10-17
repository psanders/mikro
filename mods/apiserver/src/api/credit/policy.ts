/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Loads the credit policy once: `credit-policy.json` next to mikro.json when it
 * exists, else the bundled mikro_credit v1. No mikro.json key (mikro.json is
 * strict; a key shipped before its release crashes boot on rollback). An
 * invalid file fails loudly, like mikro.json.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getConfigFilePath } from "@mikro/common";
import { creditPolicySchema, POLICY_V1, type CreditPolicy } from "@mikro/score";
import { logger } from "../../logger.js";

export interface LoadedPolicy {
  policy: CreditPolicy;
  hash: string;
  source: string;
}

export const POLICY_FILENAME = "credit-policy.json";

/** JSON with sorted keys, so the hash ignores formatting and key order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function parsePolicy(raw: unknown, source: string): LoadedPolicy {
  const parsed = creditPolicySchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid credit policy (${source}): ${issues}`);
  }
  const hash = createHash("sha256").update(canonicalJson(parsed.data)).digest("hex");
  return { policy: parsed.data, hash, source };
}

let cached: LoadedPolicy | null = null;

export function loadCreditPolicy(configPath?: string): LoadedPolicy {
  const file = join(dirname(getConfigFilePath(configPath)), POLICY_FILENAME);
  const loaded = existsSync(file)
    ? parsePolicy(JSON.parse(readFileSync(file, "utf8")), file)
    : parsePolicy(POLICY_V1, "bundled");
  logger.info("credit policy loaded", {
    id: loaded.policy.id,
    version: loaded.policy.version,
    hash: loaded.hash.slice(0, 12),
    source: loaded.source
  });
  cached = loaded;
  return loaded;
}

export function getCreditPolicy(): LoadedPolicy {
  return cached ?? loadCreditPolicy();
}

/** Tests only. */
export function setCreditPolicyForTests(loaded: LoadedPolicy | null): void {
  cached = loaded;
}
