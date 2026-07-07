/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renders the check registry to a Markdown spec. Code-first: the checks ARE the
 * canonical collections spec, and this generator emits the human-readable doc so
 * it can never drift from what actually runs. The LLM explainer reads the same
 * `rationale` metadata, so narration, code, and doc share one source.
 */
import { COLLECTIONS_CHECKS } from "./checks.js";

/** Produce the collections spec Markdown from the check registry. */
export function generateSpecMarkdown(): string {
  const lines: string[] = [];
  lines.push("# Collections Spec");
  lines.push("");
  lines.push(
    "> Generated from the check registry (`mods/common/src/eval/checks.ts`). Do not edit by hand — run the spec generator."
  );
  lines.push("");
  lines.push(
    "Each rule below is an executable check evaluated over a loan snapshot. A loan is healthy when every check passes."
  );
  lines.push("");

  const byClass = {
    consistency: COLLECTIONS_CHECKS.filter((c) => c.class === "consistency"),
    invariant: COLLECTIONS_CHECKS.filter((c) => c.class === "invariant")
  };

  const section = (title: string, blurb: string, checks: typeof COLLECTIONS_CHECKS) => {
    lines.push(`## ${title}`);
    lines.push("");
    lines.push(blurb);
    lines.push("");
    for (const c of checks) {
      lines.push(`### ${c.title}`);
      lines.push("");
      lines.push(`- **id:** \`${c.id}\``);
      lines.push(`- **severity:** ${c.severity}`);
      lines.push("");
      lines.push(c.rationale);
      lines.push("");
    }
  };

  section(
    "Consistency rules",
    "Recompute a derived number independently from the raw ledger and compare. These catch plumbing and row-selection bugs.",
    byClass.consistency
  );
  section(
    "Invariant rules",
    "Pure arithmetic and policy assertions over the derived numbers. These catch engine bugs the engine cannot catch about itself.",
    byClass.invariant
  );

  // Trim trailing blank lines and end with exactly one newline: the doc is
  // committed and passes through prettier's markdown formatter, which enforces
  // this normalization. Emitting it here keeps generation idempotent under
  // prettier so the drift-guard test (comparing this output to the committed
  // file) doesn't flap on formatting alone.
  return lines.join("\n").replace(/\n+$/, "") + "\n";
}
