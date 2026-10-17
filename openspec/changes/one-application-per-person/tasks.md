## 1. Detection

- [x] 1.1 `createFindPriorApplication`: match by phone or cédula (both cédula formats); in_process > cooldown > draft; own session never in process/draft but its rejection counts; tests
- [x] 1.2 `REAPPLY_COOLDOWN_DAYS` in `@mikro/common` (both barrels); router and apiserver use it

## 2. Intake paths

- [x] 2.1 Website intake: final submit checked; `outcome: "cooldown"` (+ `reapplyFrom`, `outOfArea`) / `"in_process"`; older draft takes the answers and this session's DRAFT is discarded; no Lead for blocked submits; tests
- [x] 2.2 WhatsApp Flow: returns the outcome; the reply gives the date / says one is in process; tests
- [x] 2.3 José `finalizeApplication`: cooldown / in process → not submitted, draft ABANDONED, outcome for José; prompt lines in `agents.yaml`; tests

## 3. WhatsApp routing and messaging

- [x] 3.1 Lookup carries the person's most recent rejection when the latest application isn't it; router: cooldown wins over a newer DRAFT / never-submitted ABANDONED; tests
- [x] 3.2 Out-of-area note gives the reapply date; eval scenario updated

## 4. Site

- [x] 4.1 Cooldown and in-process result screens (existing result-screen styling)
- [ ] 4.2 Pencil: add the two result screens to the solicitud board (follow-up)
