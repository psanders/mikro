## 1. Persist the anchor

- [x] 1.1 Add nullable `moraAccrualFrom DateTime?` to the `Payment` model in
      `mods/apiserver/prisma/schema.prisma` and generate the migration
- [x] 1.2 Add the same column to the integration suite's hand-maintained
      `SCHEMA_SQL` so it does not drift from `prisma/migrations`
- [x] 1.3 Write the anchor in `createCreatePayment` when creating a LATE_FEE
      row, taking it from the `computeAccruedMora` result that produced the
      charge — inside the same transaction, never recomputed at write time

## 2. Teach the engine to read it

- [x] 2.1 Extend `CollectedLateFeePayment` with the optional accrual start and
      carry it through `toCollectedLateFeePayments`
- [x] 2.2 In `computeAccruedMora`, pick the accrual start as the earliest anchor
      among non-reversed LATE_FEE rows in the window, falling back to the live
      oldest missed due when none carries one
- [x] 2.3 Keep `moraEffectiveFrom` winning over an earlier anchor, and persist
      the policy-clamped value so a re-read reproduces the charge
- [x] 2.4 Exclude reversed rows from anchor selection, matching their exclusion
      from the collected total
- [x] 2.5 Unit-test the engine against the loan #10029 ledger: charging 76 then
      re-reading must report gross ≥ 76, not 68

## 3. Surface over-collection

- [x] 3.1 Keep `mora-net-nonneg` as the netting invariant on the returned value
- [x] 3.2 Add a `mora-not-over-collected` check (severity `warning`) that fails
      when `collected > gross + ε` for the window
- [x] 3.3 Expose the selected accrual start on the snapshot so the check and the
      statement can explain which window they are judging
- [x] 3.4 Update the statement's mora KPI copy and verification banner so an
      over-collected window reads as a failed control, not "todos superados"
- [x] 3.5 Test that a loan with collected > gross fails the check and renders a
      non-clean banner

## 4. Offline parity

- [x] 4.1 Add `moraAccrualFrom` to the collector app's local payments schema and
      the sync-pull payload
- [x] 4.2 Carry it into the local snapshot builder so the app and the server
      compute the same mora offline
- [x] 4.3 Test the local snapshot against the same #10029 ledger used server-side
      (engine is shared and covered server-side; the SQLite round-trip is not)

## 5. Verify and land

- [x] 5.1 Run the common, apiserver and mobile suites; confirm no new failures
      against the pre-change baseline
- [x] 5.2 Regenerate a statement for a loan with a frozen window and confirm
      "generada" is never below "pagada" (needs a seeded DB + mikro.json fixture)
- [x] 5.3 Sync the delta specs into `openspec/specs/` and archive the change
