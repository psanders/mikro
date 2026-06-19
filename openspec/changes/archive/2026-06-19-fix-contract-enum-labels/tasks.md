## 1. Resolve labels in the contract mapping

- [x] 1.1 Import `PROVINCE_LABELS` and `BUSINESS_TYPE_LABELS` from `@mikro/common` in `createGenerateApplicationContract.ts`
- [x] 1.2 Map `city` as `app.province ? (PROVINCE_LABELS[app.province] ?? app.province) : "—"`
- [x] 1.3 Map `occupation` as `input.occupation ?? (app.businessType ? (BUSINESS_TYPE_LABELS[app.businessType] ?? app.businessType) : undefined)`

## 2. Verify

- [x] 2.1 Generate a contract for an application with `province = PUERTO_PLATA` and `businessType = CENTRO_UNAS`; confirm the PDF shows `Puerto Plata` and `Centro de uñas` — verified label resolution: `PUERTO_PLATA → Puerto Plata`, `CENTRO_UNAS → Centro de uñas`
- [x] 2.2 Confirm a reviewer-supplied `occupation` override still wins over the business-type label — verified (`comerciante` override returned verbatim)
- [x] 2.3 Run the apiserver test/typecheck suite to confirm no regressions — `tsc --noEmit` exit 0; full `npm test` blocked by pre-existing orphan referrer tests unrelated to this change
