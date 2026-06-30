/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Declarative tag-predicate -> QCobro portfolio mapping. See QCOBRO.md
 * "Portfolio match rules".
 */
import type { QCobroPortfolioRule } from "@mikro/common";

function matches(tags: Set<string>, rule: QCobroPortfolioRule["match"]): boolean {
  if (rule.all && !rule.all.every((t) => tags.has(t))) return false;
  if (rule.any && !rule.any.some((t) => tags.has(t))) return false;
  if (rule.none && rule.none.some((t) => tags.has(t))) return false;
  return true;
}

/**
 * Evaluate every `qcobro.portfolios[]` rule against a customer's current tag
 * set. A customer may match zero, one, or several portfolios.
 */
export function evaluatePortfolioRules(
  customerTags: string[],
  portfolios: QCobroPortfolioRule[]
): string[] {
  const tags = new Set(customerTags);
  return portfolios.filter((p) => matches(tags, p.match)).map((p) => p.id);
}
