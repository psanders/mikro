## 1. Shared schema (`@mikro/common`)

- [ ] 1.1 `schemas/creditReport.ts`: `creditReportPushSchema` (envelope + EQUIFAX/PRESTAMOSCLOUD facts, `status: OTHER` + `statusRaw` fallback), exported through both barrels (`schemas/index.ts` and the root `index.ts`).
- [ ] 1.2 Synthetic fixtures for each source: empty ("NO DATOS"), clean, and delinquent. The delinquent fixture follows the shape of the 2026-10-17 lookup, with fake names and numbers. Unit tests.

## 2. Policy engine (`@mikro/common/credit`)

- [ ] 2.1 `creditPolicySchema` (strict; Expr/Cond grammar from design D4).
- [ ] 2.2 `evaluateCreditPolicy`: three-valued logic, derive, rules, score components (`from`/`bins`, `whenMissing`), bands, outcome precedence (design D5), `unchecked[]`, optional next steps with cost, trace.
- [ ] 2.3 `credit-policy.v1.json`: the hard NOs, no required lookups (a report counts for 30 days), the four score components with `whenMissing: "skip"` and the bands. The zone moves to `config.coveredProvinces`.
- [ ] 2.4 Unit tests: every operator, unknown propagation, every spec scenario, and replay determinism.

## 3. Storage and API (`mods/apiserver`)

- [ ] 3.1 Prisma `CreditReport` and `CreditDecision`, plus a migration; update the integration-test `SCHEMA_SQL`.
- [ ] 3.2 Load the policy at boot (`credit-policy.json` next to mikro.json, else the bundled one; fail loud; log the version and hash).
- [ ] 3.3 Build facts: `app`, `isc`, latest `equifax`/`pcloud` per cédula with `ageDays`, `mikro` history by cédula (tags, loans, `getPaymentRating`), `config`. Compute the Equifax `mikroScore` server-side from the facts.
- [ ] 3.4 tRPC `creditReports.ingest` (REVIEWER/ADMIN, `CEDULA_MISMATCH`), `creditReports.listByCedula`, `creditDecisions.latest`.
- [ ] 3.5 Re-decide after application upserts and after ingest, for open applications with that cédula.
- [ ] 3.6 Rejection reason `CREDIT_POLICY` (existing reject permissions, only when the decision is a hard NO, no note; store the reason codes); `via: "extension"` on review events. Approval guard `CREDIT_POLICY_BLOCKED` in `reviewApplication.ts`/`applicationReview.ts`; add the credit fields to the approved and rejected event payloads.
- [ ] 3.7 Integration tests: ingest → decision → approve blocked or allowed.

## 4. Extension (`mods/creditscore`)

- [ ] 4.1 Equifax adapter also reads `bloque_identi` and `bloque_dashb`, and emits `creditReportPushSchema` facts.
- [ ] 4.2 PrestamosCloud hook and adapter for the endpoints in design D2. Add the `portal.prestamoscloud.com` match to the manifest.
- [ ] 4.3 "Mikro · Decisión" panel (Pencil states 1–8):
  - expand every lender automatically, with progress;
  - automatic push to the cédula's application in process (at most one, per `one-application-per-person`);
  - score before and after, with each source's component;
  - evaluator actions under today's rules: take the application, reject (`CREDIT_POLICY` preselected on a hard NO), recommend approval with `sendToDecision` (evidence gate); no approve;
  - read-only when not the assignee;
  - closed state.

  Options page: apiserver URL and login.
- [ ] 4.4 SHA-256 of the raw responses; never send the raw responses or the photo.
- [ ] 4.5 Adapter tests against captured response fixtures, with personal data removed.

## 5. Ops UI (`mods/dashboard`)

- [ ] 5.1 DecisionBlock: outcome badge, reasons, Mikro Score with the sources used, "no verificado" list, optional next steps with cost, report freshness per source.
- [ ] 5.2 Approve disabled with an explanation when the decision is `REJECT`.
- [x] 5.3 Pencil: board `Extension / Mikro · Decisión` (panel states 1–8, Ops feed card A/B, rules); the deprecated `Riesgo de buró` board is removed (Mikro Decisión replaces it).
- [ ] 5.4 Feed: show "desde la extensión" on applications closed from the panel.

## 6. Rollout

- [ ] 6.1 Backfill: evaluate every open application (scored with the information in hand).
- [ ] 6.2 Release the extension zip through the existing build-creditscore workflow, and give evaluators install instructions.

## 7. Follow-ups (founder)

- [ ] 7.1 Add a bureau-consent clause (Ley 172-13) to the solicitud form and the contract, before the guard goes live.
- [ ] 7.2 Check the Equifax and PrestamosCloud terms of use for extension capture.
- [ ] 7.3 Confirm the v1 weights and bands; recalibrate after about 30 decided applications with outcomes.
- [ ] 7.4 Find out what `clientes/get_datacredito` returns (it fires on every Datapréstamos lookup).
