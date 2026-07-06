## 1. Data model

- [ ] 1.1 Add `ToolCallLog` model to `mods/apiserver/prisma/schema.prisma`: `{id (uuid), toolName String, signal String?, userId String?, createdAt DateTime @default(now())}`, indexed on `[toolName, signal, createdAt]`
- [ ] 1.2 Generate and commit the Prisma migration

## 2. Logging tool-call outcomes

- [ ] 2.1 In `createCopilotChat.ts`'s tool-dispatch loop, after each READ/DIRECT tool executes, write a `ToolCallLog` row: `toolName` = the tool called, `signal` = the result's `reason` (lookup tools) or `category` arg (`githubFeedback`) or `null` on plain success, `userId` from the chat context
- [ ] 2.2 Make the log write best-effort (never throws/blocks the reply) — wrap in try/catch with a `logger.error` on failure, matching the pattern already used for feedback video/screenshot uploads
- [ ] 2.3 Unit test: a `NOT_FOUND` lookup produces a matching `ToolCallLog` row; a successful lookup produces a row with `signal: null`; a `githubFeedback` call produces a row with `signal` = category

## 3. Deterministic pattern evaluator

- [ ] 3.1 Create `mods/apiserver/src/api/copilot/evaluateSignalDigest.ts`: pure function `evaluateSignalDigest(db, {windowDays = 7, threshold = 3})` that queries `ToolCallLog` in the trailing window, groups by `(toolName, signal)`, returns the qualifying groups (count, firstSeen, lastSeen) — no side effects, fully unit-testable without a timer
- [ ] 3.2 Render a digest issue body (title + a section per qualifying pattern: tool, signal, count, first/last seen) from the qualifying groups — template rendering only, no LLM call
- [ ] 3.3 When at least one group qualifies, call the shared `fileGithubIssue` helper (from `add-copilot-tool-awareness-feedback`) with the rendered digest; when none qualify, return without filing
- [ ] 3.4 Unit tests: no qualifying groups → no issue filed; one qualifying group → issue filed with correct content; multiple qualifying groups in one run → exactly one issue combining all of them

## 4. Dormant-tool detection

- [ ] 4.1 Add a `lastDormancyCheckAt` timestamp alongside the pattern-evaluator's last-run tracking (same row/table from task 5.1, not a new one)
- [ ] 4.2 In `evaluateSignalDigest`, when the monthly cadence is due, compute `getBoundToolNames()` (from `toolPolicy.ts`) minus the distinct `toolName`s seen in `ToolCallLog` over the trailing dormancy window (default 90 days); render any remaining names as a "possibly dormant" section
- [ ] 4.3 Fold the dormancy section into the same digest issue as any qualifying failure patterns from that run (still one issue, per Decision 3); if dormancy is due but no failure patterns qualify, file a dormancy-only digest
- [ ] 4.4 Unit tests: a bound tool with zero calls in the window is flagged only when the monthly check is due; it is not re-flagged on the following week's tick; a tool that has been called at all in the window is not flagged

## 5. Retention and interval worker

- [ ] 5.1 Create `mods/apiserver/src/api/copilot/createSignalDigestEvaluator.ts`, modeled directly on `createWatchRuleEvaluator.ts`: daily tick that checks whether the configured cadence (default weekly for patterns, monthly for dormancy) has elapsed since the last run (tracked via last-run timestamp(s) — new small table or a reused config row, whichever is simpler in this schema), prunes `ToolCallLog` rows past the retention window (default 120 days) before evaluating, calls `evaluateSignalDigest` when due, returns a stop function
- [ ] 5.2 Start the worker at apiserver boot (`mods/apiserver/src/index.ts`) alongside the existing watch-rule evaluator and QCobro worker, wired into the same `SIGTERM`/`SIGINT` shutdown handling
- [ ] 5.3 Unit test the tick logic (weekly/monthly cadence gating, retention prune) without relying on real timers

## 6. Verification

- [ ] 6.1 Seed `ToolCallLog` rows crossing the threshold in a test/dev environment and confirm a single, correctly-formatted digest issue is filed
- [ ] 6.2 Seed a bound tool with no rows at all and confirm it appears in the dormancy section only on the monthly-due run
- [ ] 6.3 Confirm rows older than the retention window are pruned and don't affect either detector
- [ ] 6.4 Confirm the worker doesn't keep the process alive on its own (`unref()`'d) and stops cleanly on shutdown
- [ ] 6.5 Run full apiserver test suite and lint/typecheck
