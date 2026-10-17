## Why

Today the only number behind a loan decision is the ISC (Mikro Score /100). It is computed from the application form alone, with weights hard-coded in `mods/common/src/scoring/engine.ts`. Everything else the evaluator looks at stays outside Mikro:

- **Equifax (DataCrédito).** The `mods/creditscore` extension scores the report inside the browser and never sends it anywhere.
- **PrestamosCloud Datapréstamos.** This is a pooled database of informal lenders, with a score from 300 to 850, delinquency flags and loans per lender. Nothing captures it.
- **Mikro's own repayment history.** It is not consulted until the application is converted.

So a decision cannot be explained or reproduced afterwards. Applicants who should be refused can also get through. One real example, from the Datapréstamos lookup on 2026-10-17: score 399 ("Muy bajo"), 23% of payments on time, 14 lenders, 3 loans marked uncollectible (`INCOBRABLE`), RD$86k owed. The ISC would never see any of that.

## What Changes

- **One Mikro browser extension for the evaluator, on both portals.** The existing `mods/creditscore` panel (Riesgo de buró, now deprecated) becomes "Mikro · Decisión" and also runs on `portal.prestamoscloud.com`. After a lookup it:
  1. extracts the hard facts (never the raw report) and validates them against a shared schema;
  2. **saves them to Mikro automatically**, against the cédula's application in process (only one per person);
  3. shows the updated Mikro Score, before and after, with each source's component, and the policy outcome;
  4. lets the evaluator **reject or recommend approval right there, under today's rules**: the assigned evaluator, while the application is En revisión, with the same reasons and evidence requirements. A hard NO comes with the reason preselected, so no comment is needed. Approving stays with the admin in Ops.

  The extension adds data and the decision engine. It does not change who decides.
- **Credit reports belong to the person.** A new `CreditReport` record is keyed by cédula, with source, extracted facts, capture time, the evaluator who captured it, the adapter version and the SHA-256 of the raw response. A later application or customer with the same cédula sees it.
- **A JSON credit policy decides.** This is a versioned and very flexible policy file with:
  - derived facts (aggregates over arrays, arithmetic, coalesce);
  - rules (hard NOs and "needs review");
  - an evidence catalog with costs (bureau lookups are optional; each one costs money);
  - a Mikro Score built from the scores of every source (Equifax, PrestamosCloud, ISC, Mikro history);
  - outcome bands.

  The engine returns `REJECT`, `REVIEW` or `APPROVE` **with the information in hand**. Sources that weren't consulted leave the score (the rest are reweighted) and their rules are listed as not checked; nothing waits for a lookup. Each result comes with reasons, the Mikro Score, the sources it used, and optional next steps (which lookups could change the result, with their cost).
- **Decisions are stored and replayable.** Every evaluation writes a `CreditDecision` with the input snapshot, the policy id, version and hash, the trace and the result. It reruns whenever an application changes or a report is pushed.
- **Approval is gated. BREAKING for Ops:** an admin cannot approve an application whose latest decision is `REJECT` (a hard NO). **There is no override in this version.** `REVIEW` and `APPROVE` are advisory; the admin still sets the terms.
- **Policy v1:**
  - Hard NOs:
    - PrestamosCloud client is delinquent or has any uncollectible loan;
    - Equifax has a write-off or legal account (`CASTIGADO`/`LEGAL`) in the last 24 months, or any account 90 or more days late;
    - the province is outside the coverage area;
    - Mikro already has this person under `risk:fraud_watch`, or has a written-off loan for them;
    - the bureau's name or date of birth doesn't match the application;
    - the applicant is outside the 18–70 age range.
  - No required lookups. Equifax and PrestamosCloud are optional because every query costs money; a report counts for 30 days.

## Capabilities

### New Capabilities

- `credit-reports`: the shared schema for the facts, the ingest endpoint and storage keyed by cédula.
- `credit-report-extension`: one extension that detects lookups on Equifax and PrestamosCloud, extracts the facts and pushes them.
- `credit-policy`: the JSON policy format, the evaluator, the Mikro Score, next steps and decision records.

### Modified Capabilities

- `loan-application-review`: admin approval is blocked when the latest credit decision is `REJECT`. A new rejection reason, `CREDIT_POLICY` (no note), is valid only when the decision is a hard NO, under the existing reject permissions.

## Impact

- **`mods/common`:**
  - `schemas/creditReport.ts` (the facts schema);
  - `credit/` (policy schema, evaluator, default policy `credit-policy.v1.json`).
- **`mods/apiserver`:**
  - Prisma models `CreditReport` and `CreditDecision`, with a migration;
  - tRPC `creditReports.ingest`, `creditReports.listByCedula`, `creditDecisions.latest`;
  - the decision reruns in the application upsert paths;
  - the approve guard in `reviewApplication.ts`.
  - The integration test `SCHEMA_SQL` must be updated by hand.
- **`mods/creditscore`:**
  - a PrestamosCloud adapter;
  - the Equifax adapter also reads the identity block (`bloque_identi`) and the score block (`bloque_dashb`);
  - a push panel;
  - extension login;
  - the manifest also matches `portal.prestamoscloud.com`.
- **Pencil:** the board `Extension / Mikro · Decisión` holds the 8 panel states, the Ops feed card variants and the decided rules.  It replaces the deprecated `Riesgo de buró` panel.
- **`mods/dashboard` (Ops):** the DecisionBlock shows the outcome, reasons, the Mikro Score with the sources it used, and optional next steps; Approve is disabled when the decision is `REJECT`.
- **No new key in `mikro.json`.** The policy loads from `credit-policy.json` next to `mikro.json` when that file is present, otherwise from the bundled default. A missing or invalid file fails boot with a clear message.
- **Legal (Ley 172-13):** the application form needs a bureau-consent clause before this goes live (task 7.1). Only extracted facts and a hash are stored, never the raw reports. The PrestamosCloud photo is never captured.
