## 1. Persist the anchor

- [ ] 1.1 Add nullable `moraAccrualFrom DateTime?` to the `Payment` model in
      `mods/apiserver/prisma/schema.prisma` and generate the migration
- [ ] 1.2 Add the same column to the integration suite's hand-maintained
      `SCHEMA_SQL` so it does not drift from `prisma/migrations`
- [ ] 1.3 Write the anchor in `createCreatePayment` when creating a LATE_FEE
      row, taking it from the `computeAccruedMora` result that produced the
      charge — inside the same transaction, never recomputed at write time

## 2. Teach the engine to read it

- [ ] 2.1 Extend `CollectedLateFeePayment` with the optional accrual start and
      carry it through `toCollectedLateFeePayments`
- [ ] 2.2 In `computeAccruedMora`, pick the accrual start as the earliest anchor
      among non-reversed LATE_FEE rows in the window, falling back to the live
      oldest missed due when none carries one
- [ ] 2.3 Keep `moraEffectiveFrom` winning over an earlier anchor, and persist
      the policy-clamped value so a re-read reproduces the charge
- [ ] 2.4 Exclude reversed rows from anchor selection, matching their exclusion
      from the collected total
- [ ] 2.5 Unit-test the engine against the loan #10029 ledger: charging 76 then
      re-reading must report gross ≥ 76, not 68

## 3. Surface over-collection

- [ ] 3.1 Keep `mora-net-nonneg` as the netting invariant on the returned value
- [ ] 3.2 Add a `mora-not-over-collected` check (severity `warning`) that fails
      when `collected > gross + ε` for the window
- [ ] 3.3 Expose the selected accrual start on the snapshot so the check and the
      statement can explain which window they are judging
- [ ] 3.4 Update the statement's mora KPI copy and verification banner so an
      over-collected window reads as a failed control, not "todos superados"
- [ ] 3.5 Test that a loan with collected > gross fails the check and renders a
      non-clean banner

## 4. Offline parity

- [ ] 4.1 Add `moraAccrualFrom` to the collector app's local payments schema and
      the sync-pull payload
- [ ] 4.2 Carry it into the local snapshot builder so the app and the server
      compute the same mora offline
- [ ] 4.3 Test the local snapshot against the same #10029 ledger used server-side

## 5. Verify and land

- [ ] 5.1 Run the common, apiserver and mobile suites; confirm no new failures
      against the pre-change baseline
- [ ] 5.2 Regenerate a statement for a loan with a frozen window and confirm
      "generada" is never below "pagada"
- [ ] 5.3 Sync the delta specs into `openspec/specs/` and archive the change
