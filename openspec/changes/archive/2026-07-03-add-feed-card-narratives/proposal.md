# Proposal: add-feed-card-narratives

## Why

The expanded feed card today renders a generic KV-grid ("Método: Efectivo", "Monto: RD$1,500…") built by `resolveDetailRows()`. It's technically complete but reads like a form dump, not a story — and it duplicates information already visible in the compact line. During Pencil exploration (board `EzobQ`, row `VIflA`) we prototyped a narrative-sentence replacement for two event types (`payment.collected`, `application.deleted`) plus two small links — "Metadata" (raw JSON) and "IA insights" (opens the copilot dock for deeper synthesis) — and confirmed the sentence can be template-composed client-side with zero LLM calls, since every field it needs is already on `FeedEvent`/`payload` at write time (see `mods/apiserver/src/api/events/mappers.ts`, `mods/dashboard/src/founder/components/typeConfig.ts`).

That exploration only covered 2 of the 12 `BusinessEventType` values. This change extends the pattern to all of them.

## What Changes

- **New `resolveNarrative(event): string | null`** in `typeConfig.ts` — one Spanish template per event type, composed from fields already on `FeedEvent`/`payload`. Returns `null` for types where the compact `summary` line is already the complete sentence (no extra payload fields to add) — those cards skip the narrative row entirely rather than repeating the same text twice.
- **New `resolveInsightsQuestion(event): string`** — a per-type Spanish question prefilled into the copilot dock when "IA insights" is clicked, reusing the existing `subjectQuestion()` helper where a subject link already exists.
- **`FeedCard.tsx` expanded view** replaces the `detailRows` KV-grid with: narrative sentence (when present) → small "Metadata" link (opens raw `payload` JSON, generic across all types) → small "IA insights" link (opens the copilot dock via the existing `onAskCopilot` prop, prefilled per `resolveInsightsQuestion`) → existing type-specific actions row (unchanged: Restaurar, Ver X, ask-copilot chip).
- **Removed**: the KV-grid rendering path (`detailRows`) and its generic payload-key fallback in `resolveDetailRows` — superseded by the narrative + Metadata link.
- **Two data gaps surfaced and decided** (see Open Questions below) rather than papered over with invented data.

## Capabilities

### Modified Capabilities

- `founder-feed`: expanded card content changes from a generic KV grid to a per-type narrative sentence + Metadata/IA-insights links, covering all 12 event types.

## Impact

- **dashboard only** (`mods/dashboard/src/founder/components/typeConfig.ts`, `FeedCard.tsx`, their Storybook stories and unit tests). No apiserver or schema changes — everything the narratives need is already recorded.
- Existing `resolveSubjectLink`/`subjectQuestion` and per-type actions are unchanged.
- `cp/note-generating` Pencil component (built during exploration, then decided against) stays defined but unused — no cleanup needed, it's cheap to keep for a legitimately-async pattern elsewhere later.

## Open Questions (need a decision before Build)

1. **Deletion reason isn't captured today.** `deleteApplicationSchema` has no `reason` field, so `application.deleted` events never carry a "why" — the Pencil mockup's "Motivo: duplicada" was illustrative, not real. Default for this change: **omit "motivo" from the deletion narrative**; capturing a real reason is a separate, larger change (schema + mutation + UI input on the delete flow). Confirm or override.
2. **`loan.status_changed.from` is always `""`** (mapper comment: not observable at the tRPC boundary post-commit). Default: **template degrades to "→ {to}" when `from` is empty**, matching what `resolveDetailRows` already does today. Confirm or override.
