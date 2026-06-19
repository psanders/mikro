## Why

The generated loan contract PDF prints raw enum codes instead of human-readable labels: the debtor's province shows as `PUERTO_PLATA` and the business type (used as occupation) shows as `CENTRO_UNAS`. These leak into a legal document signed by the borrower, so they must read as `Puerto Plata` and `Centro de uñas`. The application summary PDF already resolves these via the shared label maps; the contract path does not.

## What Changes

- Resolve the debtor's **city/province** through `PROVINCE_LABELS` when building `ContractData` so the contract prints the Spanish label, not the enum code.
- Resolve the debtor's **occupation** (sourced from `businessType`) through `BUSINESS_TYPE_LABELS` so the contract prints the Spanish label, not the enum code.
- Keep raw value as a graceful fallback if a code is missing from the label map (same `?? raw ?? "—"` pattern the summary generator uses).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `loan-application-signing`: Add a requirement that the generated loan-contract PDF renders applicant enumerated fields (province, business type/occupation) as human-readable Spanish labels rather than raw enum codes.

## Impact

- Code: `mods/apiserver/src/api/applications/createGenerateApplicationContract.ts` (maps `app.province` / `app.businessType` into `ContractData`). Imports `PROVINCE_LABELS` / `BUSINESS_TYPE_LABELS` from `@mikro/common`.
- No schema, DB, or API-shape changes. No new dependencies.
- Behavior: contracts generated after this change print labels; previously generated/stored contract files are unaffected.
