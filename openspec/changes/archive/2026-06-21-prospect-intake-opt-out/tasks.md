## 1. ABANDONED status

- [x] 1.1 Add `ABANDONED` to the Prisma `ApplicationStatus` enum in `mods/apiserver/prisma/schema.prisma` (SQLite TEXT — no SQL migration)
- [x] 1.2 Add `ABANDONED` to the `ApplicationStatus` type in `mods/common/src/types/application.ts`
- [x] 1.3 Add `ABANDONED` to `applicationStatusEnum` in `mods/common/src/schemas/application.ts`
- [ ] 1.4 Run `prisma generate` in `mods/apiserver` so the generated client knows the value (deploy step; generated client is gitignored)

## 2. finalizeApplication outcome

- [x] 2.1 Add `outcome` (`complete` | `abandoned`, default `complete`) to the `finalizeApplication` tool schema in `mods/agents/src/tools/definitions.ts`; update the description (no longer sends a message; threshold is ISC ≥ 50)
- [x] 2.2 In `createFinalizeApplication`, branch on `outcome`: `abandoned` updates status to `ABANDONED` by id and skips the complete/RECEIVED upsert; both paths return `data.outcome`

## 3. Opt-out detection + prompt

- [x] 3.1 Add `isDecline` (conservative regex) to `handleProspectMessage`; inject an abandon directive on match
- [x] 3.2 Set directive precedence: decline > turn cap > stuck; turn-cap directive uses `outcome "complete"`, stuck directive uses `outcome "abandoned"`
- [x] 3.3 Add `FLUJO DE NO INTERÉS` to José's prompt; carve declines out of `TURNOS FUERA DE TEMA`; route the two system directives to the right outcome in `TURNO CON ALERTA DEL SISTEMA`

## 4. Evals + tests

- [x] 4.1 Add the permanent `not-interested-abandon` LLM scenario to `agents.yaml` (asserts `finalizeApplication` called with `outcome: abandoned`)
- [x] 4.2 Unit tests: finalize `abandoned` updates status to `ABANDONED` and does not upsert; default outcome is `complete`
- [x] 4.3 Unit tests: decline detector fires on explicit phrases and NOT on a plain "no"
- [x] 4.4 Run the live eval (`tsx mods/agents/src/eval/cli.ts jose not-interested-abandon`) — passes
