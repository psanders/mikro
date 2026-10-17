## ADDED Requirements

### Requirement: Credit rules live in a versioned JSON policy

A credit policy SHALL be a JSON document validated by the strict `creditPolicySchema`. It has `id`, `version`, `facts` (per-source `maxAgeDays`), `derive`, `rules`, `score`, `bands` and `evidence`. It SHALL express derived facts, aggregates over arrays, arithmetic, coalesce, date arithmetic and normalization, plus nested `all`/`any`/`not` conditions, as described in design D4. The engine SHALL contain no credit-specific logic: every threshold, weight, hard NO and requirement comes from the policy.

#### Scenario: New hard NO without code

- **WHEN** an author adds a rule `{ "when": { "left": { "fact": "pcloud.kpis.lenderCount" }, "op": "gt", "right": 10 }, "outcome": "REJECT", "reason": "TOO_MANY_LENDERS" }` and restarts the apiserver
- **THEN** applicants with more than 10 PrestamosCloud lenders are rejected with reason `TOO_MANY_LENDERS`

#### Scenario: Invalid policy fails boot

- **WHEN** `credit-policy.json` has an unknown key or an unknown operator
- **THEN** boot fails with a message naming the path of the error

### Requirement: Policy is loaded without a mikro.json key

At boot, the apiserver SHALL load `credit-policy.json` from the directory of mikro.json when that file exists, and otherwise the bundled default policy. It SHALL compute `policyHash` as the SHA-256 of the canonical JSON.

#### Scenario: No override file

- **WHEN** no `credit-policy.json` sits next to mikro.json
- **THEN** the bundled `mikro-credit` v1 policy is used, and its version and hash are logged

### Requirement: The engine returns an explained outcome

`evaluateCreditPolicy(policy, facts, now)` SHALL be pure and deterministic. It SHALL return:

- `outcome` ∈ {`REJECT`, `REVIEW`, `APPROVE`};
- `reasons[]`;
- `mikroScore` and `sourcesUsed[]`;
- `unchecked[]` (rules whose source wasn't consulted);
- `components[]`;
- `nextSteps[]`;
- `trace` (every rule's true/false/unknown result and every derived value).

It SHALL use the precedence and three-valued logic of design D5, deciding with the information in hand:

1. A true `REJECT` rule gives `REJECT`.
2. Otherwise, a true `REVIEW` rule gives `REVIEW`.
3. Otherwise, the band of the score computed from the components present decides.

Rules that are unknown because their source wasn't consulted SHALL NOT change the outcome; they are returned in `unchecked[]`. Next steps SHALL be optional suggestions, each with its cost, and the ones that could change the outcome come first.

#### Scenario: Hard NO with missing data still rejects

- **WHEN** PrestamosCloud shows 3 uncollectible loans and no Equifax report exists
- **THEN** the outcome is `REJECT` with reason `PCLOUD_UNCOLLECTIBLE`

#### Scenario: Approvable without bureau lookups

- **WHEN** no Equifax or PrestamosCloud report exists, no rule fires, and the score from the application and Mikro history is 78
- **THEN** the outcome is `APPROVE`; `sourcesUsed` lists the application and history; `unchecked` lists the Equifax and PrestamosCloud hard NOs; and the next steps offer "Consultar PrestamosCloud" and "Consultar Equifax" as optional, with their cost

#### Scenario: Clear approve

- **WHEN** no rule fires and the Mikro Score is 81
- **THEN** the outcome is `APPROVE`

### Requirement: Mikro Score combines every source's score

The Mikro Score SHALL be the weighted mean (0–100) of the policy's score components, each mapped to 0–100 through a linear `from` range or `bins`. The v1 policy SHALL combine:

- Equifax (the bureau's own score, falling back to the Mikro scorecard);
- the PrestamosCloud score;
- the application ISC;
- Mikro payment history.

A component whose source wasn't consulted (or, for history, a new customer) SHALL be skipped and the remaining weights renormalized.

#### Scenario: New customer has no Mikro history

- **WHEN** the applicant has never had a Mikro loan
- **THEN** the history component is skipped, and the other weights are renormalized

### Requirement: Every evaluation is stored

After every application upsert, and after every credit report ingest for the application's cédula while the application is `RECEIVED`, `IN_REVIEW` or `PENDING_DECISION`, the apiserver SHALL evaluate the policy and append a `CreditDecision` with:

- the input facts snapshot;
- `policyId`, `policyVersion` and `policyHash`;
- the outcome, reasons, scores, next steps and trace.

#### Scenario: Report push re-decides

- **WHEN** a PrestamosCloud report is pushed for the cédula of an `IN_REVIEW` application whose decision was `APPROVE` with PrestamosCloud unchecked
- **THEN** a new `CreditDecision` is stored, and it becomes the application's current decision

#### Scenario: Replay

- **WHEN** a stored decision's `inputs` are re-evaluated with the same policy version
- **THEN** the result equals the stored outcome, scores and reasons

### Requirement: Policy v1 hard NOs

The bundled v1 policy SHALL reject (`REJECT`) when any of these holds:

- PrestamosCloud `isDelinquent` is true (`PCLOUD_DELINQUENT`);
- any PrestamosCloud loan is uncollectible (`PCLOUD_UNCOLLECTIBLE`);
- an Equifax account was `CASTIGADO` or `LEGAL` within 24 months (`EQUIFAX_WRITE_OFF`);
- an Equifax account is 90 or more days past due (`EQUIFAX_DPD_90`);
- the province is not in `config.coveredProvinces` (`OUT_OF_COVERAGE_AREA`);
- the Mikro customer carries `risk:fraud_watch` (`MIKRO_FRAUD_WATCH`);
- a past Mikro loan was written off (`MIKRO_WRITTEN_OFF`);
- the bureau's identity name or birth date does not match the application (`IDENTITY_MISMATCH`);
- the applicant's age is outside 18–70 (`AGE_OUT_OF_RANGE`).

The v1 policy SHALL NOT require any lookup. A report counts for 30 days.

#### Scenario: Real delinquent profile

- **WHEN** PrestamosCloud shows score 399, delinquent "SI", and 3 loans marked `INCOBRABLE`
- **THEN** the outcome is `REJECT` with reasons `PCLOUD_DELINQUENT` and `PCLOUD_UNCOLLECTIBLE`
