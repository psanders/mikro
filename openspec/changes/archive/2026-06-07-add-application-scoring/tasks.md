## 1. Port the scoring engine (@mikro/common)

- [x] 1.1 Add the business-risk lookup as a typed TS data module (`puntaje_por_nivel` BAJO 90/MEDIO 65/ALTO 40/CRITICO 10 + the `mapa_codigos` code→level map) ported verbatim from `data/riesgo_negocios.json`
- [x] 1.2 Define the `ApplicationScore` result type (English shape from `export_json.py`): `isc`, `risk_band`, `recommendation`, `confidence`, `flags[]`, `categories[]`, `indicators{}` (amount_requested, term_weeks, monthly_installment, monthly_sales, net_income, debt_service_ratio), `evaluator_notes[]`, plus applicant/business context; enums as string literal unions
- [x] 1.3 Port `CONFIG` (weights, `tasa_flat` 0.30, `margen_neto` 0.30, `semanas_por_mes` 4.345, `zona_cobertura` PUERTO_PLATA, bandas) as an exported const
- [x] 1.4 Port the six category scorers (payment capacity/DSR, business-type risk, track record & formalization, rootedness, support network, purpose), the hard flags (OUT_OF_ZONE, CRITICAL_BUSINESS, INCOMPLETE_DATA), band/recommendation/confidence, and evaluator notes — matching the Spanish display-value logic of `scoring_engine.py`
- [x] 1.5 Implement `scoreApplication(input)` returning `ApplicationScore`, and an input adapter from `NormalizedApplication` (parsed stable fields + `rawData` display values) to the scorer inputs
- [x] 1.6 Export the engine, `ApplicationScore` type, and CONFIG from `@mikro/common`; confirm it builds
- [x] 1.7 Validate parity: ran `scoring_engine.py` vs the TS engine on 2 `mikro.csv` rows — band/recommendation/flags identical; ISC matched within 0.1 (Python half-to-even vs JS half-up display rounding; cannot flip a band off an integer threshold). No test setup in `common`, so no unit tests added.

## 2. Data model (Prisma)

- [x] 2.1 Remove `AI_REVIEWED` from the `ApplicationStatus` enum in `schema.prisma`; update the `ApplicationStatus` type in `@mikro/common`
- [x] 2.2 Add to `LoanApplication`: `scoreData` Json?, `score` Int?, `riskBand` String? (mapped), `recommendation` String?, `scoredAt` DateTime?; extend the `DbClient` `loanApplication` write data + `LoanApplication` type accordingly
- [x] 2.3 Generated + applied the migration (trimmed the unrelated `mora_rate` loans/payments rebuild, as before; enum removal produced no SQL on SQLite); ran `prisma generate`; client builds

## 3. Score on every write (@mikro/apiserver)

- [x] 3.1 In `createUpsertApplication`, run `scoreApplication` on the normalized input and include `scoreData`/`score`/`riskBand`/`recommendation`/`scoredAt` in the upsert write (both create and update paths)
- [x] 3.2 Confirm `listApplications`/`getApplication` return the new columns + `scoreData` (no signature change needed; verify the row shape flows through)

## 4. Verify

- [x] 4.1 `npm run build`/`typecheck` clean across `common` and `apiserver`
- [x] 4.2 Against a running apiserver: post a complete submission → row has `score`, `riskBand`, `recommendation`, `scoredAt`, and `scoreData` populated; an out-of-zone province → `OUT_OF_COVERAGE`/`REJECT_OUT_OF_ZONE`; a sparse partial → scored with `INCOMPLETE_DATA` while status stays `DRAFT`
- [x] 4.3 Confirm re-posting the same `sessionId` with changed data recomputes and overwrites the persisted score
- [x] 4.4 Confirm the scored values match the Python engine for the same input (spot check one row)
