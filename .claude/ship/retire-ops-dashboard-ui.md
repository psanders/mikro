# Ship checkpoint — retire-ops-dashboard-ui

Started: 2026-07-04
Current stage: 3 — Build

**Scope:** Remove the operations dashboard UI (pages, Layout/NavSidebar, ops component library + stories) from mods/dashboard; founder path becomes the app (ADMIN → /founder; non-admin → AccessScreen pointing to mobile). APIs/SDKs/capabilities untouched. Pencil ops v2 cluster `YqrDN` marked DEPRECATED (done). User mandate 2026-07-04: "one hundred percent confident… remove all of the old dashboard except for what's in Pencil… mark that as deprecated… don't remove APIs/SDKs."

**Detected surfaces:** OpenSpec: yes · Pencil: yes · Storybook: yes · E2E: no dashboard harness

| #   | Stage           | Status | Notes                                                                                                                                                                                                                                                                    |
| :-- | :-------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | Change scaffolded, proposal written                                                                                                                                                                                                                                      |
| 1   | Design (Pencil) | done   | Deprecation marking = the design work; YqrDN renamed + red title + context note tOH67                                                                                                                                                                                    |
| 2   | Spec reconcile  | done   | 7 whole-capability REMOVED deltas + ops-dashboard-shell/founder-feed MODIFIED + dashboard-design-system/promo-send-shortcut partial REMOVED; validate green                                                                                                              |
| 3   | Build           | done   | 42 files deleted per keep-list; AccessScreen added; subject links → copilot openWith. Plus user design tweaks (Fable, in Pencil AND code): online indicators removed (EN VIVO chips, dock "en línea", sparkles dot), feed title "Hoy"→"Feed" (user chose from 4 options) |
| 4   | Test            | done   | typecheck/eslint/vite build/storybook green; grep proofs zero dangling refs; only pre-existing server-stub.ts lint findings remain                                                                                                                                       |
| 5   | Sync            | done   | User approved; 7 capability specs deleted, 5 specs merged/pruned                                                                                                                                                                                                         |
| 6   | Archive         | done   | archive/2026-07-04-retire-ops-dashboard-ui; commit c8c1ffc pushed to PR #74                                                                                                                                                                                              |

## Decision log

- 2026-07-04 — User's uncommitted SolicitudDetailPage.tsx edits preserved before deletion: patch at /tmp/solicitud-detail-page-user-edits.patch + git stash "user edits to SolicitudDetailPage before ops-UI retirement".
- 2026-07-04 — Kept: ops-dashboard-auth (all), empty-data-display (generic convention), design tokens/storybook/login-fidelity reqs, apiserver promo capability. Removed UI-only: 7 capabilities whole + Inicio/component-library/promo-UI requirements.
- 2026-07-04 — Non-admin decision: AccessScreen pointing to mobile app (no ops UI remains to land on); reviewer desktop flow retires (mobile evaluator + copilot are the migration).
