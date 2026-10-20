# Ship checkpoint — add-application-origin

Started: 2026-10-20
Branch: `feat/application-origin` (worktree `.claude/worktrees/app-origin`, off main v3.16.2)
Current stage: 5 — Sync (gate)

**Scope:** Show where each loan application came from: `Form (ad|organic|unknown)`, `WhatsApp` or `Manual`, derived from `source` + `adId` + the 2026-09-18 02:52 UTC tracking cutoff (no schema change). CLI `applications:list` gets an ORIGIN column, `--origin` filter and readable statuses; `applications:get` gets ORIGIN. Ops shows an origin chip on the feed card and an `Origen` row in the panel. Which ad/campaign is out of scope.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes (`mods/dashboard`) · E2E: yes (`mods/dashboard/e2e`, Playwright)

| #   | Stage           | Status      | Notes                                                                                                                                                                                                                              |
| :-- | :-------------- | :---------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | Change written; `validate --strict` green                                                                                                                                                                                          |
| 1   | Design (Pencil) | done        | Drawn on board `EzobQ` sec-08: card chip in `Admin / Feed — esperando decisión` (head `aWxjw`, card `FHXJH`), `Origen` row atop panel content (`G0JK9s` in `RFOWD`, drawer `UbCzS`), 5-variant strip `PKRXW`. Approved 2026-10-20. |
| 2   | Spec reconcile  | done        | No behavior change from design (icons/colors are styling); validate --strict green.                                                                                                                                                |
| 3   | Build           | in-progress |                                                                                                                                                                                                                                    |
| 4   | Test            | pending     |                                                                                                                                                                                                                                    |
| 5   | Sync            | pending     |                                                                                                                                                                                                                                    |
| 6   | Archive         | pending     |                                                                                                                                                                                                                                    |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-10-20 — Scope revised by user: no feed chip (keep the feed light); origin only in the full application. Added: application PDF header, `customers:get` ORIGIN (new `getCustomerOrigin` query; `getCustomer` untouched). Spec/tasks updated, validate --strict green. Tests: common 354, apiserver unit 676, integration 961, Playwright 11/12 with `reviewer.spec` flaky (also flaky with main's seed and without origin.spec, so pre-existing).
- 2026-10-20 — Pencil: chip + variants strip deleted in the Mikro tab but NOT saved. My ⌘S hit another session's file (fonoster-metering Billing design, saved 12:51:49) because that session switched Pen's active canvas. Reported to user; waiting on a free Pen window before saving.
- 2026-10-20 — Local build vs prod: desktop release bundle (VITE_API_URL=prod, updater off) at mods/dashboard/src-tauri/target/release/bundle/macos/Mikro.app (main checkout's shared target dir); CLI from this worktree verified read-only against prod. Old prod server ignores --origin, so ctl re-checks rows client-side (bd98d09). Waiting on user test, then PR + sync gate.
- 2026-10-20 — Tests green. Gotcha: dashboard must import common runtime values from `@mikro/common/schemas`; the root barrel blanks the page (server-only deps) and typecheck doesn't catch it. One integration timeout (copilot statement PDF) was load from parallel runs; passes alone.
- 2026-10-20 — Feed card chip needs the new server (feed state gains `origin`); card hides the chip against older servers. Panel row works against prod today.
- 2026-10-20 — Design approved. Origin computed client-side from fields prod already returns, so the local client works against prod; only `--origin` needs the new server. User wants a local build against prod at the end.
- 2026-10-20 — Shipping while add-loan-renewal is still open (waiting on its design gate): user asked for this now. Separate worktree/branch, so the two don't touch.
- 2026-10-20 — User decisions: origin = channel + ad/organic only (no ad or campaign name); statuses readable; pre-2026-09-18 FORM rows = "unknown", not "organic".
- 2026-10-20 — Checkpoint created; change `add-application-origin` written and validated.
