## Why

Loan applications now land in the system, but nothing evaluates them. Mikro already has a **deterministic** scoring model — `skills/mikro-score.skill` (`scoring_engine.py`) — that computes an IMS/ISC solvency score, risk band, recommendation, and evaluator notes from the exact business fields the form captures. Today it only runs offline against a CSV and emits a PDF. We want that evaluation to run inside the pipeline and attach its raw result to each application (and ultimately to the customer) for history/analysis.

Because the model is deterministic, scoring is **not a manual step or a pipeline gate** — it is a derived attribute, recomputed and persisted on every write. Every application carries a current score regardless of stage, including abandoned drafts. This is Phase 2 (scoring half) of the loan origination pipeline; human approve/reject is a separate follow-on.

## What Changes

- **Port the Mikro Score engine to TypeScript** in `@mikro/common` — a pure, deterministic function (6 weighted category scorers, hard flags, band/recommendation/confidence, evaluator notes, CONFIG) with the business-risk lookup inlined as a TS data module. It outputs the clean English machine-readable shape (the `export_json.py` format) as the canonical `ApplicationScore` type. No PDF. The Python skill stays as the reference/spec; recalibration moves to the TS CONFIG.
- **Input adapter** mapping a normalized application (stable English fields + `rawData` Spanish display values) to the scorer inputs.
- **Extend `LoanApplication`** with `scoreData` (the full raw result, kept forever) plus extracted columns `score`, `riskBand`, `recommendation`, `scoredAt` for filtering/display.
- **Score on every upsert** — the intake path runs the engine on each write (partial and complete) and persists the result. No manual trigger, no "score now" button; re-computation is automatic and idempotent.
- **Drop the `AI_REVIEWED` status** — scoring is orthogonal to the pipeline, not a stage. Naming moves from "AI evaluation" to "scoring" throughout (it is a deterministic rule engine, not an LLM).

## Capabilities

### New Capabilities

- `loan-application-scoring`: The deterministic scoring engine, its result shape, and the score-on-every-write behavior

### Modified Capabilities

- `loan-application-model`: `LoanApplication` gains score storage columns (`scoreData`, `score`, `riskBand`, `recommendation`, `scoredAt`); the `ApplicationStatus` enum drops `AI_REVIEWED`

## Impact

- `mods/common/src/` — new scoring engine, risk-data module, `ApplicationScore` type, input adapter
- `mods/apiserver/prisma/schema.prisma` — score columns on `LoanApplication`, remove `AI_REVIEWED` from the enum + migration
- `mods/apiserver/src/` — scoring integrated into the intake upsert path (`createUpsertApplication`); existing `listApplications`/`getApplication` now return score data
- `skills/mikro-score.skill` — unchanged; retained as the reference model/spec
- Out of scope: human `IN_REVIEW`/`APPROVED`/`REJECTED` transitions (next change), conversion to Customer/Loan (Phase 3), dashboard UI (Phase 4), any LLM narrative layer, a bulk re-score-after-recalibration maintenance job, and expanding the business-risk map to all ~37 form business types (recalibration)
