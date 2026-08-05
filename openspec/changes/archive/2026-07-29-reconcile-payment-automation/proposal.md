## Why

Issue #224 asked for an optional "Cantidad" field on the Registrar Pago task card so a
recurring fixed-amount payment pre-fills its amount instead of being retyped every time.
**That behavior already ships.** PR #163 (`b42355e`, merged 2026-07-09 — eight days before
#224 was filed) generalized `pay-collector` into a generic `payment` automation and added
exactly it: a static, optional `suggestedAmount` slot plus `amount`'s `defaultFrom:
"suggestedAmount"`, which `TaskActionCard` reads to pre-fill the confirm input.

What did _not_ happen in #163 is spec reconciliation. The main specs still document the
retired `pay-collector` automation and its `collectorId` slot in 12 places, and
`task-automation-catalog` states the opposite of shipped behavior:

> Its confirm card context SHALL include the collector's name and the current week's
> collected total for that collector (computed, display-only — **it does not prefill the
> amount**).

A spec that contradicts the code is worse than no spec: the next change to this automation
will be reasoned about from a false baseline. This change makes the specs describe what
ships, and fixes the one real UI gap the audit surfaced.

## What Changes

- **Retire `pay-collector` from the specs.** Replace the requirement with `payment`: the
  renamed id, `employeeId` (static, **optional** — salary and vendor payments have no
  employee), `accountId`/`categoryId` (static, required), the static optional
  `suggestedAmount`, and the ask slots `amount` (defaulting from `suggestedAmount`) and
  `note`. Update the 5 stale scenario references in `founder-tasks` and one each in
  `founder-feed` and `founder-copilot`.
- **Specify the prefill contract generically.** `defaultFrom` is a property of the slot
  descriptor, not a `payment` special case: any `ask` slot may name a gathered payload field
  whose value seeds its input, and the input stays freely editable. Document that an absent
  or non-scalar source value yields no prefill.
- **Specify the role-gated week context.** The trailing-week "cobró" sentence only renders
  when the configured employee actually holds `COLLECTOR`; it degrades to no context
  otherwise, so a vendor payment never shows a nonsensical "cobró RD$0.00".
- **Fix the amount input (the one real code gap).** `TaskFormModal` renders every static
  slot without catalog-backed options as `<input type="text">`, so `suggestedAmount` — a
  money field — gets a free-text box with no numeric affordance. Render `kind: "amount"`
  slots as a numeric input with an RD$ prefix and the schema's bounds.

## Capabilities

### New Capabilities

<!-- None. This change documents shipped behavior and polishes one input. -->

### Modified Capabilities

- `task-automation-catalog`: the `pay-collector` requirement becomes the `payment`
  requirement (optional employee, static `suggestedAmount`, prefilled ask `amount`,
  role-gated week context).
- `founder-tasks`: stale `pay-collector`/`collectorId` scenario references updated; the
  schema-driven form requirement gains the amount-slot rendering rule.
- `founder-feed`: task action card scenario renamed to `payment`.
- `founder-copilot`: `createTask` scenario renamed to `payment`.

## Impact

- **Specs**: 4 files reconciled; 12 stale references retired. No requirement is deleted —
  `pay-collector`'s requirement is rewritten in place as `payment`.
- **Code**: one presentational change in `mods/dashboard/src/founder/components/TaskFormModal.tsx`
  plus a Storybook story for the amount-slot variant. No apiserver, schema, or DB change —
  the automation, catalog descriptors, and prefill path are already correct and tested.
- **Design**: Pencil screen `aMH1d` (Nueva tarea / Editar tarea) predates #163 and does not
  show the `suggestedAmount` field; bring it to parity with the shipped form.
- **Issue #224**: closed by this change, with the behavior credited to #163 and the input
  polish delivered here.
- **Out of scope**: renaming the user-facing label to the issue's word "Cantidad". The
  shipped label "Monto sugerido (RD$, opcional)" is more accurate — it says the value is a
  suggestion, not a pinned charge — and `Monto` is the term used across the rest of the app.
