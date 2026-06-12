## Context

Applications currently enter the system only via the public website form (`POST /v1/applications`). The pipeline: payload → `applicationPayloadSchema` normalization → `scoreApplication` → `LoanApplication` upsert. The `updateApplication` tRPC mutation reuses this same normalization+scoring path for reviewer edits. We now need a parallel `createApplication` mutation that creates a fresh record via the same pipeline, initiated from the dashboard.

The Pencil screen 03b (node `FULqF`) is already designed. The `EditSolicitudModal` and `applicationFields` lib are the implementation reference.

## Goals / Non-Goals

**Goals:**

- Allow a reviewer to create a `LoanApplication` in `DRAFT` status from the dashboard.
- Reuse the existing normalize + score pipeline — no special-casing.
- Keep the modal lightweight: only 6 core fields; remaining fields edited post-creation via the existing edit modal.

**Non-Goals:**

- Full parity with the public form (all 20+ fields) — that belongs in a future "full intake" workflow.
- Sending WhatsApp notifications on manual creation.
- Auto-assigning an evaluator on creation.

## Decisions

### 1. New `createApplication` tRPC mutation vs. repurposing the public endpoint

**Decision**: new protected tRPC mutation.

The public endpoint is unauthenticated and session-keyed. A dashboard creation needs reviewer auth and should not require a `sessionId`. Reusing the public path would require threading auth through an unauth route — not worth it.

### 2. Schema: `createApplicationSchema` vs. reusing `applicationPayloadSchema`

**Decision**: new `createApplicationSchema` in `schemas/application.ts`.

`applicationPayloadSchema` requires `sessionId` and is designed for lenient form posts. The create schema takes typed dashboard inputs (English content keys as optional strings, same shape as `updateApplication`'s `patch`) and generates a UUID `sessionId` server-side. This isolates public form concerns from the internal API.

**Shape**:

```ts
z.object({
  patch: z.record(z.string(), z.string()).default({})
});
```

The `patch` record mirrors `updateApplicationSchema.patch` so the same normalization path applies.

### 3. Status on creation

**Decision**: `DRAFT`.

A manually-entered record is inherently incomplete at creation time. The reviewer promotes it to `RECEIVED` (via the existing `promoteApplication` mutation) once the full intake is confirmed.

### 4. Handler location

**Decision**: `mods/apiserver/src/api/applications/createCreateApplication.ts`, following the project's `createXxx` factory pattern.

### 5. Modal field set

**Decision**: 6 fields across 3 groups (Nombre, Apellido, Teléfono, Cédula; Tipo de negocio, Nombre del negocio; Monto solicitado, Plazo).

These are the fields reviewers reliably capture over the phone. All match keys already in `applicationFields.ts` (same masking/select options apply). The rest go through the edit modal after creation.

## Risks / Trade-offs

- **Duplicate records**: A reviewer could accidentally create a duplicate for an applicant who later submits via the website. Mitigation: the same `sessionId` dedup applies to the website path but not to manually-created records. Acceptable — duplicates are visible and can be deleted.
- **Incomplete scoring**: A 6-field intake yields a low/partial score. Acceptable — DRAFT records are not evaluated until promoted.

## Open Questions

- Should the modal redirect to the new application's detail page after save? **Proposed**: yes, navigate to `/solicitudes/:id` so the reviewer can immediately fill in remaining fields.
