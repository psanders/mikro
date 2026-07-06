## Why

`add-copilot-tool-awareness-feedback` gives the copilot the ability to _sense_ a gap (the `reason` discriminant) and _report_ one in the moment (`githubFeedback`) — but each signal lands as an isolated, one-off GitHub issue. Nothing looks across turns, tools, or founders to notice that the same gap keeps recurring, or that a `ui_suggestion` category keeps getting hit. Issue #111's underlying ask — copilot "proactively suggesting improvements over time" — needs an aggregation step neither prior change scopes: something has to accumulate signal and turn _patterns_, not single events, into something actionable.

This change adds that aggregation, modeled directly on the OpenClaw "Capability Evolver" pattern surfaced during exploration: deterministic, non-LLM pattern-matching over accumulated logs, run on a cheap periodic pass — not another model call guessing at what might be useful.

**Depends on `add-copilot-tool-awareness-feedback` landing first** — this change's telemetry is keyed on the `reason` field and the `githubFeedback` tool call that change introduces; it has nothing to mine without them.

## What Changes

- Add a lightweight `ToolCallLog` record: every copilot READ/DIRECT tool call is logged with `toolName`, an optional coarse `signal` (the `reason` code for lookup tools, or the `category` for `githubFeedback` calls — never full arguments, to avoid a new PII surface), `userId`, and a timestamp.
- Add a periodic (weekly, configurable) deterministic evaluator — same interval-worker shape as `createWatchRuleEvaluator` — that counts `(toolName, signal)` occurrences in the trailing window, and when any pair crosses a threshold, compiles them into a single digest.
- Add a longer-window (default 90-day), monthly-gated check for bound tools with **zero** logged calls at all — a complementary "possibly dead capability" signal, distinct from the failure-pattern signal above, folded into the same digest issue when due.
- The digest is filed as **one** GitHub issue via the existing `fileGithubIssue` helper (no new GitHub integration) — a template-rendered summary of recurring patterns, not an LLM-authored write-up. Nothing is filed when nothing crosses the threshold (no empty-digest spam).
- `ToolCallLog` rows are pruned past a retention window (default 120 days — comfortably past the longest detection window) in the same tick, so the table doesn't grow unbounded.
- No founder-facing UI, no dashboard card, no LLM call in the detection path itself, and no new GitHub label (digest issues stay unlabeled like every other filed issue — distinguished by title/body only).

## Capabilities

### New Capabilities

- `copilot-signal-digest`: the `ToolCallLog` record, the periodic evaluator, and the digest-filing behavior.

### Modified Capabilities

- None. This sits alongside `founder-copilot` and `copilot-feedback` (adding a logging side-effect to tool execution) without changing their existing requirements — it only reads what those two capabilities already produce.

## Impact

- New Prisma model (`ToolCallLog`) + migration.
- `mods/apiserver/src/api/copilot/createCopilotChat.ts` (log each executed READ/DIRECT tool call).
- New: `mods/apiserver/src/api/copilot/evaluateSignalDigest.ts` (pure, testable) + `createSignalDigestEvaluator.ts` (interval worker), wired at apiserver startup alongside the existing watch-rule and QCobro workers.
- Reuses `fileGithubIssue` (from `add-copilot-tool-awareness-feedback`) — no new GitHub client code.
