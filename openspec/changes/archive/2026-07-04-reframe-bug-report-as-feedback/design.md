# Design — reframe-bug-report-as-feedback

## Context

The bug-report feature shipped web-first (PR #75, mikro/#69) and was later extended with
native desktop + mobile capture (archived change `extend-bug-report-native-capture`). It is
deeply named `bugReport` across `common`, `apiserver`, `dashboard`, and `mobile`. This change
is primarily a **rename + light reframing**, not new behavior: capture/consent/upload stays
as-is; the framing, naming, one desktop icon, and tooltips change.

## Decisions

### 1. Term = "Feedback", one generic flow

Locked with the user: user-facing word is **"Feedback"** (English, kept as-is), code
identifier is `feedback`. **No category picker** — a single generic channel. The team
categorizes on the GitHub side after submission. This keeps the client flow identical to
today and avoids new UI states.

### 2. GitHub issue: generic, not bug-labeled

`createSubmitFeedback` files the issue with generic feedback framing (title/body), and does
**not** force a `bug` label. If a label taxonomy is wanted later, it's a server-side triage
concern, out of scope here. This is the one observable behavior change beyond copy.

### 3. Desktop icon + tooltips

- `Bug` → `MessageSquare` (lucide) — a square message icon reads as "tell us something",
  not "something is broken".
- New reusable `Tooltip` component. It replaces the native `title=` attribute on `RailItem`
  and the feedback button, so **all** rail icons (Inicio, Excepciones, Buscar, Reportes,
  Feedback) get a styled hover tooltip. The native `title` is hover-only and unstyled; the
  new one must also work on keyboard focus and degrade gracefully on touch (no hover) — the
  label stays available via `aria-label` regardless.
- Pencil already reflects this (icon swap on all 7 Feed rails, the 3 previously-missing
  Búsqueda/Copiloto/Reportes rails, a tooltip on the feed screen, and a design note).

### 4. Rename mechanics (build order)

Dependency order, all behavior-preserving except the GitHub framing:

1. `@mikro/common` — schema + utils rename; **both** barrel exports (schemas/index.ts and
   root index.ts) must be updated (known double-barrel gotcha).
2. `apiserver` — mutation + `createSubmitFeedback` + tests.
3. `dashboard` — `FeedbackButton`, `Tooltip`, copy.
4. `mobile` — dir/identifier rename, copy.

### 5. Spec capability IDs stay `bug-report-*-capture`

Renaming the two capture spec folders would be pure churn (their content is what matters, and
it's fully reframed via MODIFIED deltas). The new reframe-level contract lives in a net-new
`feedback-submission` capability. Sync/archive keeps the two capture IDs.

## Blocked

Another agent has uncommitted `bugReport*` edits in the working tree. The rename touches the
same files, so **no code lands until that WIP is committed/merged**. Pencil (this change's
stage 1) is independent and already done.
