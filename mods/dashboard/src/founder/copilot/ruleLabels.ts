/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Spanish labels + condition line for watch rules, shared by RuleCard and its
 * stories. The metric decides how the threshold reads (percent vs. RD$).
 */
import { formatAmount } from "../components/format";
import type { CopilotRule, WatchRuleComparator, WatchRuleMetric } from "./types";

/** Dominican-Spanish name for each v1 metric. */
export const METRIC_LABELS: Record<WatchRuleMetric, string> = {
  mora_pct_portfolio: "mora de la cartera",
  mora_pct_collector: "mora por cobrador",
  cobranza_diaria: "cobranza diaria"
};

export function metricLabel(metric: WatchRuleMetric): string {
  return METRIC_LABELS[metric];
}

const COMPARATOR_SYMBOL: Record<WatchRuleComparator, string> = {
  gt: ">",
  lt: "<"
};

/** "9%" for mora metrics, "RD$ 5,000" for cobranza. */
export function formatThreshold(metric: WatchRuleMetric, threshold: number): string {
  return metric === "cobranza_diaria" ? formatAmount(threshold) : `${threshold}%`;
}

/**
 * Condition line built from {name, metric, comparator, threshold}, e.g.
 * "Mora por ruta > 9%". Falls back to the metric label when the rule is unnamed.
 */
export function ruleConditionText(rule: CopilotRule): string {
  const subject = rule.name.trim() || metricLabel(rule.metric);
  return `${subject} ${COMPARATOR_SYMBOL[rule.comparator]} ${formatThreshold(rule.metric, rule.threshold)}`;
}
