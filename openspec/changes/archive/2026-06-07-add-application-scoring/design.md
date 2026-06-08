## Context

`skills/mikro-score.skill` is a zip whose `scripts/scoring_engine.py` is a deterministic rule-based model. It reads a CSV row of application fields and computes:

- a 0–100 IMS/ISC from 6 weighted categories (PAYMENT_CAPACITY 30, BUSINESS_TYPE_RISK 20, TRACK_RECORD_FORMALIZATION 20, ROOTEDNESS_STABILITY 15, SUPPORT_NETWORK 10, LOAN_PURPOSE 5),
- hard flags (OUT_OF_ZONE when province ≠ PUERTO_PLATA, CRITICAL_BUSINESS, INCOMPLETE_DATA),
- a risk band, recommendation, confidence, and auto-generated evaluator notes.

`data/riesgo_negocios.json` is the business-risk lookup (level→points + a code→level map). `scripts/export_json.py` defines the clean English output shape we will adopt verbatim as the result type. CONFIG: `tasa_flat 0.30`, `margen_neto 0.30`, `semanas_por_mes 4.345`, `zona_cobertura PUERTO_PLATA`.

Crucially, the engine matches on Spanish **display** values (`"Propia"`, `"Informal (sin RNC)"`, `"RD$50,000 – RD$100,000"`, `"Más de 5 años"`) — exactly what `LoanApplication.rawData` already stores. The numeric fields are already parsed on the stable columns (`requestedAmount`, `requestedTermWeeks`).

Phase 1 shipped the `ApplicationStatus` enum with an `AI_REVIEWED` value (unused) and the intake upsert path. There is no real application data yet (only disposable test rows), so adjusting the enum now is low-risk.

## Goals / Non-Goals

**Goals:**

- A faithful TypeScript port of the deterministic engine in `@mikro/common`, in-process, unit-testable, output-compatible with `export_json.py`.
- Persist the full raw result + a few extracted columns on every application write.
- Make scoring automatic and idempotent — no manual trigger, no pipeline gate.

**Non-Goals:**

- Human review transitions, conversion, dashboard UI, LLM narrative.
- Recompute-on-read or a bulk re-score job after CONFIG recalibration (the persisted value is the snapshot; a maintenance job can come later).
- Expanding the business-risk map beyond the ~20 codes it covers today.

## Decisions

### Port to TypeScript, parity with the Python model

Re-implement the six scorers, flags, band/recommendation/confidence, and notes in TS, with `riesgo_negocios.json` inlined as a typed data module and CONFIG as an exported const. The Python skill remains the reference spec; parity is documented and validated against a couple of `mikro.csv` rows. Output is the `export_json.py` English shape (`ApplicationScore`): `isc`, `risk_band`, `recommendation`, `confidence`, `flags[]`, `categories[]`, `indicators{}`, `evaluator_notes[]`, plus business/applicant context.

### Scoring is orthogonal and always-current (recompute on write)

Scoring is a pure function of the application data + CONFIG, so it is treated as a derived attribute, not a pipeline stage. `createUpsertApplication` runs the engine on every write (partial and complete) and persists `scoreData` + extracted columns. Consequences:

- Abandoned `DRAFT`s carry a score (from their last partial write) — no manual trigger needed.
- `AI_REVIEWED` is removed from `ApplicationStatus`; the lifecycle is `DRAFT → RECEIVED → IN_REVIEW → APPROVED/REJECTED → SIGNED → CONVERTED` (+ `ABANDONED`).
- The persisted result doubles as the historical snapshot once an application is frozen (converted/rejected). After a CONFIG recalibration, active rows refresh on their next write; a bulk refresh is out of scope.

### Engine consumes the normalized application, not the DB row

The scorer input adapter takes the `NormalizedApplication` (which carries both parsed stable fields and the `rawData` Spanish display values), so scoring happens inline at intake from data already in hand — one DB write, no read-back. The same adapter shape can later be fed from a stored row's `rawData` for a maintenance re-score.

### Extracted columns for filtering/display

`scoreData` holds the full result; `score` (Int, the ISC), `riskBand` (String), `recommendation` (String), and `scoredAt` (DateTime) are denormalized so the dashboard can sort/filter without parsing JSON. `businessType`/`riskBand`/`recommendation` stay `String` (not Prisma enums) to tolerate model evolution.

## Risks / Trade-offs

- **Scoring on every partial autosave = repeated computation** → It is in-process, deterministic, and sub-millisecond; the cost is negligible. Sparse partials simply score with the `INCOMPLETE_DATA` flag.
- **Port drift from the Python model** → Mitigate by validating TS output against `scoring_engine.py` for sample `mikro.csv` rows and documenting CONFIG as the single source of truth going forward.
- **Stale scores after CONFIG recalibration** → Accepted: active rows refresh on next write; the persisted value is intentionally a snapshot. A bulk re-score job is a later, separate change.
- **Risk map covers ~20 of ~37 form business types** → Unmapped codes score MEDIO + an evaluator note (existing behavior); expanding the map is recalibration, not this change.

## Open Questions

- None blocking. (If recompute-on-read is later desired for always-fresh active scores, it can be layered on without schema change.)
