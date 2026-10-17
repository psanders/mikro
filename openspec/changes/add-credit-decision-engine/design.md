## Context

This design comes from research on 2026-10-17: the code inventory, a live PrestamosCloud session, and external sources. In short:

- **The Equifax extension already exists.** `mods/creditscore` hooks the Equifax Interactive Reports XHR and turns the accounts into a 150–950 scorecard. It skips the identity block (`bloque_identi`) and Equifax's own score block (`bloque_dashb`), and sends nothing to Mikro.
- **Equifax and DataCrédito are one source.** Equifax bought DataCrédito in 2022. There is no TransUnion.
- **Only one PrestamosCloud tab is a lookup.** PrestamosCloud → Utilidades → Datapréstamo (`#clientes/dataprestamos`) looks up a cédula in the pooled informal-lender database. The other tabs ("Datacrédito Equifax", "KALIFIKA") export *our* portfolio as Excel and are out of scope.
- **The ISC is computed from the form only, with hard-coded weights.** The coverage zone is defined twice: `zona_cobertura` in code and `coveredProvinces` in mikro.json.
- **No score or version is recorded at decision time.** `application.approved.policyException` is always `false`.

## Decisions

### D1. Facts, not reports

The extension extracts typed facts in the browser, validates them with the shared Zod schema (`@mikro/common` `creditReportPushSchema`), and sends them along with the SHA-256 of the raw responses. Mikro never stores raw reports or the PrestamosCloud photo. This keeps the stored data small and focused on one purpose (Ley 172-13), and the hash proves what was seen. `adapterVersion` makes it possible to explain later parsing changes.

### D2. PrestamosCloud lookup: endpoints and facts

One lookup on `portal.prestamoscloud.com` fires these POST endpoints. The first three come from one search; the last loads one lender's loans when that lender is expanded:

| Endpoint | Facts taken |
|---|---|
| `clientes/get_client_data` (GET) | `fullName`, `birthdate`, `gender` (the photo is ignored) |
| `clientes/getDataPrestamoData` | KPIs: score (300–850) and label, % paid on time (n of N loans), % completed, risk factors (n/4) and label, delinquent (moroso) Y/N, active and closed loans, number of lenders, amount lent, amount owed, co-signer total |
| `clientes/getLoanGroupsByDocumentID` | One row per lender: name, loan count, total lent, total owed |
| `clientes/getLoansOfClientByDocumentID` | One request per lender, **only when expanded**. Each loan: amount, status (`ATRASADOS`, `VENCIDOS`, `TERMINADOS`, …), uncollectible marker (`INCOBRABLE`), final condition (`A TIEMPO`, `ATRASADOS`, `VENCIDOS`, `PENDIENTES`, none), days late, start date, rating, principal owed |
| `clientes/getAIHistory`, `reports/get_dataprestamo_history` | Inquiries: type (Consulta / Análisis IA), date, lender |
| `clientes/getDpComentarios` | Lender comments: recommends Y/N, date, text |

Other endpoints are out of scope:

- `clientes/getClientInfoByDocumentID` (address, occupation and income as each lender recorded them) is not taken in v1.
- `clientes/get_datacredito` also fires on every lookup. Its purpose is unknown and it is not used.

Two side effects matter:

- **Our lookup is visible.** Other lenders see "Consulta \<date\> Mikro" in this cédula's history.
- **Lenders start collapsed.** The panel offers **"Cargar todos los préstamos"**. It clicks each lender header so that the portal makes its own `getLoansOfClientByDocumentID` calls. The extension never calls PrestamosCloud endpoints itself. `Enviar` stays disabled until every lender's loans are loaded, because incomplete loan lists would hide uncollectible loans.

The adapter reads from the hooked responses (MAIN world, like `hook.ts`). The rendered DOM is only a fallback. The field names listed above were checked against one populated lookup (2026-10-17); the enum values seen there are listed in the schema. An unknown enum value is kept verbatim under `statusRaw`, and the push still validates.

### D3. Storage

- `CreditReport`: `id`, `cedula` (indexed, format `###-#######-#`), `source` (`EQUIFAX` | `PRESTAMOSCLOUD`), `facts` Json, `schemaVersion`, `rawSha256`, `adapterVersion`, `capturedAt`, `capturedById`, optional `applicationId` and `customerId`, `createdAt`. Records are append-only; the latest one per (cédula, source) is the current one.
- `CreditDecision`: `id`, `applicationId`, `policyId`, `policyVersion`, `policyHash`, `outcome`, `mikroScore`, `reasons` Json, `unchecked` Json, `nextSteps` Json, `inputs` Json (the full facts snapshot), `trace` Json, `createdAt`. Append-only; the latest row is the current decision for the application.
- `LoanApplication.score` (ISC) stays as it is. The Mikro Score lives on the decision.

### D4. Policy format

The engine knows nothing about credit. Every credit rule lives in JSON, validated by a Zod schema (`creditPolicySchema`, strict). A policy has six parts:

```jsonc
{
  "id": "mikro-credit",
  "version": "1.0.0",
  "facts":    { ... },   // source freshness
  "derive":   { ... },   // named computed facts
  "rules":    [ ... ],   // hard NOs and review triggers
  "score":    { ... },   // Mikro Score from component scores
  "bands":    [ ... ],   // score → outcome
  "evidence": [ ... ]    // what the evaluator can do to fill missing facts
}
```

#### Facts available to a policy

The engine builds one facts object for each evaluation:

- `app.*`: application fields (`province`, `requestedAmount`, `requestedTermWeeks`, `dateOfBirth`, `firstName`, `lastName`, …) plus `app.ageYears`.
- `isc.*`: the existing ISC result (`isc.score` 0–100, `isc.flags[]`).
- `equifax.*`: the latest Equifax `facts` for the cédula, plus `equifax.ageDays` and `equifax.mikroScore` (the existing 150–950 scorecard, computed server-side from the same facts).
- `pcloud.*`: the latest PrestamosCloud `facts`, plus `pcloud.ageDays`.
- `mikro.*`: Mikro's own history for the cédula: `mikro.customerExists`, `mikro.tags[]`, `mikro.loans[]` (status, maxDaysPastDue, writtenOff), `mikro.paymentRating` (1–5, from `getPaymentRating`).
- `config.*`: read-only values from mikro.json (`config.coveredProvinces`). This removes the hard-coded zone.

**A fact is _missing_ when** its source has no report, or the report is older than `facts.<source>.maxAgeDays`. Missing is normal: lookups are optional.

#### Expressions (`Expr`)

| Form | Meaning |
|---|---|
| `5`, `"PUERTO_PLATA"`, `true`, `[…]` | literal |
| `{ "fact": "pcloud.kpis.score" }` | path lookup; missing → *unknown* |
| `{ "op": "add" \| "sub" \| "mul" \| "div" \| "min" \| "max" \| "abs" \| "round", "args": [Expr…] }` | arithmetic |
| `{ "coalesce": [Expr…] }` | first value that is not unknown |
| `{ "if": Cond, "then": Expr, "else": Expr }` | conditional |
| `{ "agg": "count" \| "sum" \| "min" \| "max" \| "avg", "of": "<array path>", "field"?: "<item path>", "where"?: Cond }` | aggregate; inside `where` and `field`, paths are relative to the item (`$.status`) |
| `{ "daysSince": Expr }`, `{ "yearsSince": Expr }` | date arithmetic against the evaluation time |
| `{ "normalize": Expr }` | uppercases, strips accents, and replaces spaces and punctuation with `_` (the same normalization `OUT_OF_ZONE` uses today) |

#### Conditions (`Cond`)

| Form | Meaning |
|---|---|
| `{ "all": [Cond…] }`, `{ "any": [Cond…] }`, `{ "not": Cond }` | boolean logic |
| `{ "left": Expr, "op": "eq\|ne\|gt\|gte\|lt\|lte\|in\|notIn\|contains\|between\|matches", "right": Expr }` | comparison |
| `{ "exists": "<path>" }`, `{ "missing": "<path>" }` | presence |
| `{ "any_item": "<array path>", "where": Cond }` | at least one item matches |

**Unknowns use three-valued logic.** A comparison that touches an unknown value is *unknown*. `all` and `any` follow Kleene logic: `any` is true if any branch is true, and `all` is false if any branch is false. This rule is what lets the engine say "we can't tell yet; get this evidence".

#### Derive

`derive` is a map of `name → Expr`. Each entry is evaluated in order and exposed as `derived.<name>`. Policy authors use it to name what they reuse, such as `pcloudUncollectible` or `equifaxWorstDpd24m`.

#### Rules

```jsonc
{ "id": "KO_PCLOUD_INCOBRABLE",
  "when": { "left": { "fact": "derived.pcloudUncollectible" }, "op": "gt", "right": 0 },
  "outcome": "REJECT",               // REJECT | REVIEW
  "reason": "PCLOUD_UNCOLLECTIBLE",  // stable code, stored
  "message": "Tiene préstamos incobrables en PrestamosCloud" }
```

Every rule is evaluated; there is no short-circuit, so the trace is complete.

- **True:** the rule fires with its outcome.
- **Unknown:** the rule is *pending*, and its missing facts feed the next steps.

#### Score

```jsonc
"score": {
  "scale": [0, 100],
  "components": [
    { "id": "equifax", "label": "Equifax", "weight": 30,
      "value": { "coalesce": [ { "fact": "equifax.bureauScore.value" }, { "fact": "equifax.mikroScore" } ] },
      "map": { "from": [300, 850] } },                 // linear clamp to 0–100
    { "id": "pcloud", "label": "PrestamosCloud", "weight": 30,
      "value": { "fact": "pcloud.kpis.score" }, "map": { "from": [300, 850] } },
    { "id": "isc", "label": "Solicitud (ISC)", "weight": 30,
      "value": { "fact": "isc.score" }, "map": { "from": [0, 100] } },
    { "id": "history", "label": "Historial Mikro", "weight": 10,
      "value": { "fact": "mikro.paymentRating" }, "map": { "from": [1, 5] },
      "whenMissing": "skip" }                          // default; not consulted / new customer → reweight
  ]
}
```

In v1 **every** component uses `"whenMissing": "skip"`: a source that wasn't consulted leaves the score and the rest are reweighted, so the score is always computed from the information in hand. At least one component must be present, otherwise there is no score and the band step is skipped (outcome `REVIEW`).

- **`map` options:** `{ "from": [lo, hi] }` is a linear clamp. `{ "bins": [{ "when": Cond, "points": n }…] }` gives the points of the first matching bin.
- **Result:** the Mikro Score is the weighted mean of the mapped components.
- **`whenMissing` controls what a missing component does:** `"skip"` (the default) drops it and reweights the rest; a number uses that value instead.

#### Bands

```jsonc
"bands": [ { "min": 70, "outcome": "APPROVE" }, { "min": 50, "outcome": "REVIEW" },
           { "min": 0,  "outcome": "REJECT", "reason": "LOW_MIKRO_SCORE" } ]
```

#### Evidence and requirements

```jsonc
"facts": {
  "equifax": { "maxAgeDays": 30 },
  "pcloud":  { "maxAgeDays": 30 }
},
"evidence": [
  { "id": "equifax_lookup", "label": "Consultar Equifax", "provides": ["equifax.*"], "cost": 1 },
  { "id": "pcloud_lookup",  "label": "Consultar PrestamosCloud", "provides": ["pcloud.*"], "cost": 1 },
  { "id": "complete_app",   "label": "Completar solicitud", "provides": ["app.*", "isc.*"], "cost": 2 }
]
```

### D5. Outcome algorithm

1. Build the facts object and evaluate `derive`.
2. If any `REJECT` rule is **true**, the outcome is `REJECT`. Reasons: every true `REJECT` rule.
3. Otherwise, if any `REVIEW` rule is true, the outcome is `REVIEW` with that rule's reason.
4. Otherwise, compute the score from the components present and take its band's outcome. A `REJECT` band adds its reason.
5. Rules that are *unknown* (their source wasn't consulted) do **not** change the outcome. They are returned as `unchecked[]` ("no verificado: PrestamosCloud") so the evaluator and the admin can see what the decision didn't look at.
6. Build next steps: the evidence that provides facts used by an unchecked rule or a skipped component. Every step is optional and carries its `cost`. A step is marked `couldChange` when an unchecked `REJECT` rule depends on it, or when its component's full range would cross a band cutoff. Sort with `couldChange` first, then by `cost`.

Each result carries: `outcome`, `reasons[]` (code and message), `mikroScore`, `components[]` (raw value, mapped value, weight, or skipped), `sourcesUsed[]`, `unchecked[]`, `nextSteps[]` (optional, with cost), and `trace` (every rule with true/false/unknown, every derived value).

### D6. Running, loading and gating

- **When it runs.** The decision is computed and stored after every application upsert. For a pushed report, it runs for every open application whose `idNumber` matches the cédula (statuses `RECEIVED`, `IN_REVIEW`, `PENDING_DECISION`).
- **Pure function.** The evaluator lives in `@mikro/common`, so the Ops UI can preview it.
- **Loading the policy.** Boot loads `credit-policy.json` from the directory of mikro.json if the file exists, otherwise the bundled `mods/common/src/credit/credit-policy.v1.json`. `policyHash` is the SHA-256 of the canonical JSON. A file that fails validation fails boot (fail loud, like mikro.json), but there is no new key in mikro.json. This avoids repeating the rollback outage of 2026-09-18.
- **Gating approval.** `approve` fails with `CREDIT_POLICY_BLOCKED` only when the application's latest decision is `REJECT` (a hard NO that was actually checked). Missing lookups never block, because each query costs money and the admin may approve with the information in hand. There is no override.
- **Recording the decision.** The approved and rejected events carry `creditDecisionId`, `outcome` and `policyVersion`. The `policyException` field stays `false`.

### D7. Extension auth, automatic push and closing

- **Settings.** The extension options page stores the apiserver URL and a token, obtained by logging in with the evaluator's Ops credentials (the same auth flow as the dashboard). Only REVIEWER and ADMIN may ingest.
- **The panel shows:**
  - the cédula: from Equifax's identity block, or from the PrestamosCloud search input together with the `get_client_data` name;
  - a short summary of the facts;
  - an optional dropdown of open applications for that cédula, loaded from apiserver;
  - **Enviar a Mikro**.
- **Automatic push.** There is no "Enviar" click. Once the facts are complete, they are pushed against the cédula's application in process. There is at most one, enforced by `one-application-per-person`. With none, the facts are stored with the cédula. Automatic is safe because ingest only adds a report and re-decides; it never changes the application's status.
- **Evaluator actions, today's rules.** The panel calls the existing `reviewApplication` actions, so every guard and event is shared:
  - "Tomar solicitud" when the application is `RECEIVED`;
  - reject when the application is `IN_REVIEW` and the actor is the assignee;
  - `sendToDecision` with `reviewerRecommendation`, which still needs complete evidence.

  A hard NO preselects the new reason `CREDIT_POLICY` (no note; the decision's reason codes are stored). There is no approve in the extension. Events carry `via: "extension"` so the feed can say "desde la extensión". The engine adds no gate to evaluator actions; its only gate is admin approval in Ops (D6).
- **Pencil.** Board `Extension / Mikro · Decisión` holds:
  - states 1–3 for PrestamosCloud: loading lenders, hard NO, closed;
  - states 4–6 for Equifax: recommend approval, reject with a reason, missing information (send blocked by today's evidence rule);
  - states 7–8 for edge cases: no application, no session;
  - Ops feed card variants A and B.

## Risks / Trade-offs

- **Portal changes break adapters.** The schema validates the facts. When validation fails, the panel says "formato desconocido" and blocks the push, and `adapterVersion` pins down which adapter produced bad data.
- **PrestamosCloud's legal basis** for pooled data under Ley 172-13 is unclear. The user decided to use it as a hard NO anyway (2026-10-17). We store only facts and record who captured them.
- **Scraping a portal behind a login may breach the portal's terms of use.** The founder checks the Equifax contract (task 7.2).
- **Policy v1 weights are expert guesses.** All decisions keep the full input snapshot, so they can be replayed under a recalibrated policy.
