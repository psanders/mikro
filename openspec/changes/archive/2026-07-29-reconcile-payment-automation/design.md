# Design — reconcile payment automation

## Context

This change is mostly documentation debt repayment, so the design work is narrow: decide how
the spec should express the prefill contract, and how the form should render a money slot.

Ground truth as verified in code (not assumed):

| Concern                             | Where                                                                                            | State                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `payment` automation, id + slots    | `mods/apiserver/src/tasks/automations/payment.ts:51`                                             | ships                                              |
| static optional `suggestedAmount`   | same, `:75`                                                                                      | ships                                              |
| ask `amount` with `defaultFrom`     | same, `:82`                                                                                      | ships                                              |
| `defaultFrom` on the wire           | `mods/apiserver/src/tasks/catalog.ts:38`, `service.ts:79`, `mods/common/src/schemas/task.ts:142` | ships                                              |
| confirm-time prefill                | `mods/dashboard/src/founder/components/TaskActionCard.tsx:112-125`                               | ships                                              |
| catalog test asserts the descriptor | `mods/apiserver/test/tasks/catalog.test.ts:32-43`                                                | covered                                            |
| static amount slot rendering        | `mods/dashboard/src/founder/components/TaskFormModal.tsx:298`                                    | **gap: plain text input**                          |
| specs describe any of this          | `openspec/specs/**`                                                                              | **gap: describes `pay-collector`, denies prefill** |

## Decisions

### 1. Specify `defaultFrom` as a generic slot property, not a `payment` behavior

The temptation is to write the prefill into the `payment` requirement ("the amount input
SHALL default to `suggestedAmount`"). That would misdescribe the mechanism: `defaultFrom` is
declared on the slot descriptor, travels through the catalog descriptor to the client, and is
honored by a loop in `TaskActionCard` that knows nothing about `payment`. A second automation
adding a prefilled ask slot would silently satisfy a spec that never mentioned it.

So the generic contract lands in `task-automation-catalog`'s registry requirement (any `ask`
slot MAY declare `defaultFrom`; the value seeds the input; the input stays editable; absent or
non-scalar source ⇒ no prefill), and the `payment` requirement just says it uses it.

### 2. Keep `suggestedAmount` as a suggestion, not a pinned amount

`amount` remains a required `ask` slot with `defaultFrom`, rather than becoming optional-with-
fallback-to-static. The founder still confirms every peso that leaves the account, which is
what `gateFloor: "confirm"` exists to guarantee. Pinning the amount would turn a confirm-gated
expense into a rubber stamp. This also matches the issue's own wording ("pre-populates",
"allowing users to skip amount entry") — pre-fill, not auto-charge.

### 3. Reject the "Cantidad" relabel

The issue calls the field "Cantidad". Shipped label is "Monto sugerido (RD$, opcional)". Keep
the shipped label: "Cantidad" reads as a count rather than a sum, `Monto` is the term used
throughout the app's money surfaces, and "sugerido" is the part that tells the founder the
value is editable at confirm time. Recorded here so the divergence from the issue text is a
decision, not an oversight.

### 4. Render money slots numerically, keyed off `kind`, not slot name

`TaskFormModal` already branches on `slot.kind` for catalog-backed selects via `optionsFor`.
The amount case belongs in the same dispatch, not in a `slot.name === "suggestedAmount"`
special case — `record-expense` and any future automation with a money static slot get it
free.

Rendering follows the Pencil design rather than an invented affordance. Screen `aMH1d`'s
`f-monto-sugerido` field (`dOBaU`) communicates currency through the label
"Monto sugerido (RD$, opcional)" plus a muted 2,500 placeholder — there is no RD$ prefix inside
the field. So: a numeric input with `inputMode="decimal"`, `min={0}`, a `step` allowing cents,
and a 2,500 placeholder. No prefix element.

Values stay strings in `staticParams` (the form's existing contract — `Record<string, string>`);
the server coerces via `z.coerce.number()`, so no client parsing is introduced and empty string
continues to mean "not set".

The design also puts a leading icon inside every field (`banknote` here, `tag` on Nombre,
`clock` on Hora) while the shipped form has icons in no field at all. That divergence is
pre-existing, spans the whole modal, and is out of scope for this change — noted so the next
person doesn't read its absence as a regression introduced here.

## Risks

- **Spec rewrite loses a scenario.** `pay-collector`'s "Weekly context is shown but not
  binding" scenario is still meaningful — the week total is display-only even now, and the
  prefill comes from a different field. It is preserved and extended with the role gate rather
  than dropped.
- **`type="number"` and locale decimals.** DOP amounts are usually whole pesos; `step` allows
  cents. `type="number"` with a comma decimal separator can yield an empty `e.target.value` in
  some locales. Accepted: the field is optional and the server validates; a lost keystroke is
  visible immediately. Not introducing a masked-currency component for one optional field.

## Open questions

None blocking. **Pencil needed no edit:** screen `aMH1d` was checked node-by-node and is already
ahead of the code — automation reads "Pago", the employee field reads "Empleado (opcional)", the
`f-monto-sugerido` field exists with the shipped label, and the amber ask-note already says the
amount is asked at confirm "con el sugerido precargado". Whoever designed #163 updated Pencil and
only the spec was left behind.
