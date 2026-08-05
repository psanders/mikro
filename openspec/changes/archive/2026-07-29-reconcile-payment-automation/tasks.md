# Tasks — Reconcile payment automation

## 1. Spec reconcile (no code)

- [x] 1.1 `task-automation-catalog`: rewrite the `pay-collector` requirement as `payment` (optional `employeeId`, static optional `suggestedAmount`, ask `amount` with `defaultFrom`, role-gated week context); update the capability Purpose line's automation list.
- [x] 1.2 `task-automation-catalog`: add the generic `defaultFrom` prefill contract to the registry requirement, with scenarios for prefill and for a missing source field.
- [x] 1.3 `founder-tasks`: retire the 4 stale `pay-collector`/`collectorId` scenario references (create form, worker fires, confirm executes, manual creation) in favor of `payment`/`employeeId`.
- [x] 1.4 `founder-feed`: rename the confirm scenario's automation to `payment`; add the prefilled-amount scenario and the `defaultFrom` clause to the action-card requirement.
- [x] 1.5 `founder-copilot`: rename the `createTask` scenario's `automationId` to `payment`; add the fixed-amount-at-creation scenario and the optional-slot documentation clause.
- [x] 1.6 `openspec validate reconcile-payment-automation --strict` clean.

**Deliberately not reconciled:** `founder-tasks`'s "Loan-statement automation in the catalog" requirement also names `pay-collector` (spec.md:97). The in-flight `move-loan-statement-to-copilot` change (19/20 tasks) deletes that automation outright, so rewriting the requirement here would conflict with a requirement that is about to be removed. Left to that change.

## 2. Amount slot renders as a money input

- [x] 2.1 `TaskFormModal`: dispatch static slot rendering on `slot.kind`; add an `amount` branch rendering `<input type="number">` with `inputMode="decimal"`, `min={0}`, `step` for cents, and `placeholder="2,500"` — matching Pencil `dOBaU`, which carries the currency in the label and shows a muted numeric placeholder with no in-field `RD$` prefix.
- [x] 2.2 Keep `staticParams` values as strings and empty string as "unset" — no client-side number parsing; the server's `z.coerce.number().optional()` still owns coercion and bounds.
- [x] 2.3 Reuse the existing `FIELD_INPUT` token; introduce no new colors or spacing.
- [x] 2.4 Storybook: a `TaskFormModal` story for `payment` showing the money slot both empty and with a value.

## 3. Copilot tool doc marks optional static slots

- [x] 3.1 `toolPolicy.ts` `automationCatalogDoc()`: render a slot's `optional` flag in the static-slot summary so the model omits optional slots instead of inventing values (today only `suggestedAmount` reads as optional, and only incidentally because its Spanish label happens to contain "opcional" — `employeeId` is optional in schema and reads as required).
- [x] 3.2 Assert the rendered doc marks `employeeId` and `suggestedAmount` optional and `accountId` required.

## 4. Pencil parity — verified, no edit required

- [x] 4.1 Screen `aMH1d` already contains `f-monto-sugerido` (`dOBaU`) with label `Monto sugerido (RD$, opcional)`, `banknote` icon and muted `2,500` placeholder, positioned after Cuenta/Categoría in PARÁMETROS. Nothing to add.
- [x] 4.2 Verified the design already uses the shipped `payment` wording, not `pay-collector`: automation select reads `Pago` (`LSo0v`) with the `hand-coins` icon, the employee field reads `Empleado (opcional)` (`QJoDH`), and the amber ask-note (`o078rQ`) already states the amount is asked at confirm "con el sugerido precargado". Pencil was updated by #163; only the spec was left behind.

## 5. Verify

- [x] 5.1 `@mikro/apiserver` suite: **673 passing, 1 failing**. The failure is **pre-existing and unrelated** — `test/tasks/automations.test.ts:176` ("daily-close posts one INCOME deposit per payment method") expects `INCOME` but the code posts `DEPOSIT`, i.e. a stale assertion left by the deposit-vs-income change (PR #220). Confirmed pre-existing by stashing this change's source edits and re-running: still fails on clean `HEAD`. Not fixed here — it belongs to whoever owns #220's follow-up, and folding an accounting-semantics test fix into a spec-reconcile change would bury it.
- [x] 5.2 Typecheck clean: `tsc --noEmit` in both `mods/apiserver` and `mods/dashboard`. ESLint and Prettier clean on all four changed/added files plus every markdown file this change adds. Root `npm run lint` now completes in **9s** (it previously hung indefinitely — see 5.5) and reports **zero** findings in any file this change touches. The 4 findings it does report are pre-existing debt in unrelated files: 2 prettier nits in `mods/apiserver/src/api/applications/{createDeleteApplicationContract,createGenerateApplicationSummary}.ts` and a missing header + 1 prettier nit in `mods/mobile/.scripts/print-build-link.mjs`. Left for the user to decide — fixing unrelated files would bundle unrelated edits into this change's commit.
- [x] 5.5 **Fixed `npm run lint` hanging** (found while verifying 5.2; a repo-tooling fix, tracked here but logically separate from this change — see `eslint.config.mjs`). Flat config does not read `.gitignore`, and `mods/dashboard/storybook-static/` was gitignored but not eslint-ignored, so `eslint .` walked 44 minified bundles (incl. a 3.1M single-line `globals-runtime.js`) and `eslint-plugin-prettier` tried to reformat them — 1h45m at 100% CPU, 1.2GB RSS, never terminating. Added the missing output dirs (`storybook-static`, `src-tauri/target`, `eval-results`, `contracts`, `.claude/worktrees`). Also fixed a latent flat-config glob bug in the same file: `files: [".scripts/**/*.mjs"]` resolves against the config's own directory, so it never matched `mods/mobile/.scripts/` and that script failed `no-undef` on the very `console`/`process` globals the block exists to grant — now `**/.scripts/**/*.mjs`. Net: hang → 9s, 15 errors → 4. Note no CI workflow runs lint at all (only `lint-staged` on pre-commit), which is why this went unnoticed.
- [x] 5.3 E2E: **skipped** — repo has no Playwright config, `e2e/` dir, or `@playwright/test` dependency anywhere.
- [x] 5.4 Closed issue #224 as already-implemented, crediting PR #163 for the behavior and this change for the spec reconcile + input polish: https://github.com/psanders/mikro/issues/224#issuecomment-5125631632
