## Context

`createGenerateApplicationContract` builds a `ContractData` object from the stored `LoanApplication` row, then calls `renderContractPdf`. Two fields are copied straight from the DB enum columns:

- `city: app.province ?? "—"` — `province` is a raw enum code (e.g. `PUERTO_PLATA`).
- `occupation: input.occupation ?? app.businessType ?? undefined` — `businessType` is a raw enum code (e.g. `CENTRO_UNAS`).

The contract PDF therefore prints the codes verbatim. The sibling summary PDF (`summaryGenerator.ts`) already imports `PROVINCE_LABELS` / `BUSINESS_TYPE_LABELS` from `@mikro/common` and resolves these with the `LABELS[value] ?? value` pattern — the contract path simply never adopted it.

## Goals / Non-Goals

**Goals:**

- Contract PDF prints `Puerto Plata` / `Centro de uñas` instead of enum codes.
- Reuse the existing shared label maps; no new mapping data.
- Preserve graceful fallback to the raw value for unmapped codes.

**Non-Goals:**

- No change to how the public form, scoring, or DB store these values (codes remain canonical).
- No re-rendering or migration of already-generated contract files.
- No change to `maritalStatus` handling (stored values are already label-shaped).

## Decisions

**Resolve labels at the mapping site in `createGenerateApplicationContract`, not in `renderContractPdf`.**
`ContractData` is a presentation-ready DTO; the renderer should stay enum-agnostic. The API layer already owns the DB→DTO mapping and already imports from `@mikro/common`, so adding `PROVINCE_LABELS[app.province] ?? app.province` and `BUSINESS_TYPE_LABELS[app.businessType] ?? app.businessType` there is the smallest, most consistent change. Alternative — resolving inside the renderer — was rejected because it would couple PDF rendering to the application enum vocabulary and duplicate the summary generator's already-correct pattern in a different layer.

**Keep the `?? raw ?? "—"` fallback chain.** Matches the summary generator and avoids dropping data if a code is ever missing from a map.

## Risks / Trade-offs

- [A code exists in the DB but not in the label map] → Fallback prints the raw code, same as today for that field; no regression, and the summary PDF behaves identically.
- [Occupation semantics] → Using `businessType` as the debtor's "occupation" is pre-existing behavior; this change only fixes the rendering, not the field choice.
