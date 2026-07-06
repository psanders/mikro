## Context

`add-copilot-tool-awareness-feedback` introduces two per-turn signals: a `reason` code on failed lookups (`NOT_FOUND` today; `UNSUPPORTED`/`VALIDATION_ERROR` reserved) and a `githubFeedback` tool call carrying a `category`. Both are currently ephemeral — visible in a single turn, then gone except as a one-off filed issue. There's no place these accumulate, so "the same gap happened 8 times this month" is invisible; only "it happened once, right now" is captured.

The repo already has the exact worker shape needed to run a periodic pass: `createWatchRuleEvaluator.ts` — an interval timer created at apiserver startup, `unref()`'d so it doesn't hold the process open, wired into shutdown, with the actual logic factored into a pure, unit-testable function (`evaluateWatchRules`). `createQCobroWorker.ts` follows the same shape for portfolio sync. This change adds a third worker of the same lifecycle, not a new pattern.

## Goals / Non-Goals

**Goals:**

- Accumulate a minimal, low-risk log of tool-call outcomes and feedback categories.
- Detect recurring patterns deterministically (counting, not another model call) — matching the OpenClaw "Capability Evolver" approach: reproducible, cheap, no LLM in the detection path.
- Turn a crossed threshold into one actionable digest issue, reusing existing issue-filing infra.
- Also surface the complementary signal — a bound tool nobody has called in a long time — since "recurring failure" and "silent disuse" are both forms of the same underlying question: is every bound tool still earning its place in the prompt?
- Keep the log's own footprint bounded, so this change doesn't trade one accumulating problem (unnoticed gaps) for another (an unbounded table).

**Non-Goals:**

- No LLM-authored digest content. The digest is a template rendering counts and examples, not a synthesized write-up — keeping it deterministic and free of an extra model call per period.
- No founder-facing surface (no feed event, no dashboard card). This is an engineering-facing signal, same audience as `githubFeedback` issues.
- No full tool-call audit trail (args, results, request/response payloads). `ToolCallLog` stores only what counting needs: tool name, a coarse signal, actor, timestamp.
- No automatic remediation. The digest is read and acted on by a person, same as any filed issue — this change doesn't write code or tools on its own.
- No cross-repo or cross-tenant analysis. Single-repo, single deployment scope, matching everything else in the copilot feature.

## Decisions

### 1. `ToolCallLog` stores a coarse `signal`, never raw arguments

Schema: `{id, toolName, signal: string | null, userId, createdAt}`. For lookup tools, `signal` is the `reason` code (`NOT_FOUND`, etc.) or `null` on success. For `githubFeedback`, `signal` is the `category`. Deliberately excludes `args`/`data` — the previous change's `ToolResult.reason` already strips detail down to a code; carrying that same discipline into the log avoids creating a new place where customer phone numbers or names accumulate at rest.

- _Alternative considered_: log full args (like `logger.verbose("executing tool", {tool, args})` already does, just to stdout). Rejected — that log line is transient and operational; a durable table is a different risk class, and counting doesn't need it.

### 2. One evaluator, weekly cadence, threshold-gated digest

`evaluateSignalDigest(db, {windowDays, threshold})` groups `ToolCallLog` rows from the trailing window by `(toolName, signal)`, keeps groups at or above `threshold` (default: 3), and — only if at least one group qualifies — renders a digest body (pattern, count, first/last seen) and calls `fileGithubIssue`. `createSignalDigestEvaluator(db, options)` wraps it in a `setInterval` sized to check daily whether the weekly cadence has elapsed (same polling-vs-precise-scheduling tradeoff already accepted by `createWatchRuleEvaluator`'s 5-minute tick), tracking last-run via a single timestamp row rather than a cron dependency.

- _Alternative considered_: a real cron schedule (e.g. `node-cron`). Rejected — no cron dependency exists elsewhere in apiserver; the watch-rule/QCobro workers both use plain interval timers with in-process cadence tracking, and matching that keeps this change dependency-free.
- _Alternative considered_: mine directly from GitHub (list issues filed by `githubFeedback`, count by title/category). Rejected — requires tagging or parsing filed issues back out of GitHub (no label is used, per `feedback-submission`'s existing convention of unlabeled issues), turning a local counting problem into a remote API dependency. `ToolCallLog` already captures everything needed locally.

### 3. Digest is one issue, not one-per-pattern

A single run that finds three qualifying patterns files one issue listing all three, not three issues. Keeps the "team gets more signal than they can act on" failure mode in check, and mirrors "unlabeled, generic, team triages" convention already established for feedback issues.

### 4. Dormant-tool detection rides the same worker, a longer window, a slower cadence

Alongside the weekly `(toolName, signal)` pattern check, the evaluator also computes, at most once per calendar month: `getBoundToolNames()` (from `toolPolicy.ts`) minus the set of distinct `toolName`s appearing in `ToolCallLog` over a longer trailing window (default 90 days). Any bound tool absent from that set for the full window is a "possibly dead capability" — folded into the same digest issue as a separate section when the monthly check is due, not filed separately.

Gating this to monthly (not every weekly tick) matters: a 90-day dormancy fact barely changes week to week, so checking it weekly would either spam the same finding repeatedly or require its own dedupe bookkeeping. Piggybacking on the existing worker's tick — tracking a second `lastDormancyCheckAt` timestamp alongside the weekly one — reuses the "single last-run row" mechanism from Decision 2 instead of introducing a second scheduling primitive.

- _Alternative considered_: run dormancy detection on its own separate worker/cadence. Rejected — it's the same underlying question (is this tool pulling its weight?) as the failure-pattern check, over the same log table; a second worker for a once-a-month check is more machinery than the check warrants.
- _Alternative considered_: report every dormant tool on every weekly run. Rejected — a tool that's dormant this week is almost certainly still dormant next week; reporting it seven times before anyone acts trains the team to skim past digests, which defeats the purpose.

### 5. Retention: prune past the longest window, in the same tick

`ToolCallLog` rows older than a retention window (default 120 days — comfortably past the 90-day dormancy window plus buffer) are deleted at the start of each evaluator tick, before detection runs. No separate prune job or scheduler entry; it's one more statement in a function that already runs periodically and already touches this table.

- _Alternative considered_: no retention (let it grow, deal with it if it's ever a problem). Rejected now that dormancy detection exists — that check's correctness depends on the window actually being clean of ancient rows that don't reflect current tool usage, so "let it grow" would eventually corrupt the dormancy signal itself, not just consume disk.

## Risks / Trade-offs

- **[Risk]** Threshold tuning (3/week for patterns, 90 days for dormancy) is a guess with no production data yet. → **Mitigation**: both exposed as constructor options, defaulted conservatively, adjustable without a schema change.
- **[Risk]** A noisy single founder (heavy tool use) skews counts vs. a genuine cross-founder pattern. → **Mitigation**: out of scope for v1 — today there's exactly one founder role in this app; revisit grouping-by-user if that changes.
- **[Trade-off]** Digest quality is only as good as `signal` granularity — today that's just `reason`/`category` codes, not richer classification. Accepted: matches the "coarse, low-risk" goal; can extend `signal`'s vocabulary later without changing the table shape.
- **[Trade-off]** A tool with zero calls in 90 days might just be seasonal (e.g. something only relevant at loan renewal time) rather than genuinely dead. Accepted for v1 — the digest surfaces it as "possibly" dormant, a person judges; not an automatic removal.

## Migration Plan

1. Add `ToolCallLog` model + migration (additive, no existing table touched).
2. Add logging call in `createCopilotChat.ts`'s tool-dispatch branch (after `add-copilot-tool-awareness-feedback` lands, so `reason` exists to log).
3. Add `evaluateSignalDigest` (pattern detection + retention prune) + tests.
4. Add dormancy detection to the same evaluator, gated to monthly + tests.
5. Add `createSignalDigestEvaluator` worker, start it at apiserver boot next to `createWatchRuleEvaluator`/QCobro worker, wire into the same shutdown stop-function list.
   Fully additive; disabling is just not starting the worker (no data loss, no rollback complexity).

## Open Questions

- Should the dormancy window (default 90 days) be configurable per-tool — e.g. a genuinely seasonal tool wouldn't need to keep re-flagging every month — or is a single global window good enough until that's an actual complaint?
