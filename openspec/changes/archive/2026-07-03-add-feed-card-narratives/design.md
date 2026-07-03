# Design: add-feed-card-narratives

## Visual pattern (locked in Pencil)

Board `EzobQ` → section `04 · Catálogo de tarjetas del feed` → row `VIflA` (node ids: `J8JU9A` "Pago cobrado", `OsYhn` "Elemento eliminado"). One card shape covers every event type — no per-type layout differences:

```
[icon] Actor did X                              [chevron]
       secondary meta line
─────────────────────────────────────────────── (only when expanded)
{narrative sentence, when resolveNarrative() returns non-null}

{} Metadata      ✨ IA insights

[type-specific actions: Restaurar / Ver X / ask-copilot chip]
```

`cp/metadata-link` and `cp/insights-link` are the two new reusable Pencil components (small inline text+icon links, not buttons). No async "generating" state — the sentence renders synchronously on expand, same render pass as everything else in the card.

## Data flow (no LLM, no network call)

Every field used below is already present at write time — confirmed against `mods/apiserver/src/api/events/mappers.ts` (and `createRestoreApplication.ts`, `createConfirmCopilotAction.ts`, `evaluateWatchRules.ts` for the three events not in the mapper registry). `resolveNarrative` is a pure function over the `FeedEvent` the dashboard already has in memory:

```ts
// mods/dashboard/src/founder/components/typeConfig.ts
export function resolveNarrative(event: FeedEvent): string | null;
export function resolveInsightsQuestion(event: FeedEvent): string;
```

## Per-type narrative templates

| Event type              | Extra fields beyond the compact `summary`                                              | Template                                                                                                                              | Notes                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `payment.collected`     | `payload.method`, `payload.kind`, `payload.lateFeeAmount`                              | "Pago {method↓} registrado como {kind↓}{, incluye recargo por mora de {amount}}."                                                     | method/kind already translated via existing `PAYMENT_METHOD_LABELS`/`PAYMENT_KIND_LABELS` |
| `payment.reversed`      | `payload.reason`                                                                       | "{actorName} revirtió el pago{ de customerName}. Motivo: {reason}." / omit "Motivo…" clause if absent                                 |                                                                                           |
| `application.approved`  | `payload.policyException`, `payload.note`                                              | "Solicitud de {customerName} aprobada por {actorName}{, con excepción de política}{. Nota: {note}}."                                  |                                                                                           |
| `application.rejected`  | `payload.note`                                                                         | "Solicitud de {customerName} rechazada por {actorName}{. Motivo: {note}}."                                                            |                                                                                           |
| `application.signed`    | — (no extra payload fields)                                                            | **null** — falls back to compact `summary` only, no duplicate row                                                                     |                                                                                           |
| `application.converted` | `payload.loanNumber`, `payload.principal`                                              | "Solicitud de {customerName} convertida en el préstamo #{loanNumber}{ por {principal}}."                                              |                                                                                           |
| `application.deleted`   | `snapshot.{businessName\|businessType, requestedAmount, requestedTermWeeks, province}` | "{customerName} solicitó {amount} a {term} semanas{ para su negocio en {province}}; {actorName} la eliminó. Restaurable por 30 días." | **no "motivo" clause — see Open Question 1**                                              |
| `application.restored`  | — (no extra payload fields)                                                            | **null** — falls back to compact `summary`                                                                                            | `payload.deletionEventId` surfaces in the Metadata link instead                           |
| `loan.status_changed`   | `payload.from`, `payload.to`                                                           | "Préstamo actualizado{ de {from}} a {to}." — degrades to "Préstamo actualizado a {to}." when `from` is empty                          | **see Open Question 2**                                                                   |
| `customer.created`      | — (no extra payload fields)                                                            | **null** — falls back to compact `summary`                                                                                            |                                                                                           |
| `copilot.action`        | `payload.toolName`, `payload.args`, `payload.resultSummary`                            | "{resultSummary}" when present, else "Herramienta ejecutada: {toolName}."                                                             | `args` stay in the Metadata JSON, not the sentence — keeps it short                       |
| `rule.alert`            | — (compact `summary` is already the full sentence: rule name + metric + threshold)     | **null** — falls back to compact `summary`                                                                                            |                                                                                           |

`resolveNarrative` returning `null` is a first-class case, not an error: `FeedCard` simply omits the narrative row and goes straight to the Metadata/IA-insights links. Confirmed 5 of 12 types resolve to `null` — the compact summary already carries all the information the server captured for those types.

## IA insights question per type

Reuses `subjectQuestion()` where a subject link exists (approved/rejected/signed/converted/restored/customer.created all already have one); new type-specific fallbacks for the rest:

| Event type                               | Question                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `payment.collected` / `payment.reversed` | "Cuéntame más sobre este pago{ de customerName}."                        |
| `application.deleted`                    | "Cuéntame más sobre la solicitud eliminada de {customerName}."           |
| `loan.status_changed`                    | "Cuéntame más sobre este cambio de estado del préstamo."                 |
| `copilot.action`                         | "Cuéntame más sobre esta acción del copiloto."                           |
| `rule.alert`                             | "Cuéntame más sobre esta alerta: {ruleName}."                            |
| everything with a subject link           | `subjectQuestion(resolveSubjectLink(event)!.target, event.customerName)` |

## Metadata link

Generic, no per-type work: opens a modal/popover (new small component, reuse the Pencil `panel` treatment — dark code block, `JetBrains Mono`) showing `JSON.stringify({ type, occurredAt, actorName, ...payload }, null, 2)`. Same component instance for all 12 types.

## Removed surface

`resolveDetailRows()` and its generic-fallback loop over unhandled payload keys (`typeConfig.ts:378-385`) are deleted — narrative + Metadata link supersede it. `snapshotDetailRows()` is repurposed: its field extraction becomes the input to the `application.deleted` narrative template instead of KV rows.
