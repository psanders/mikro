## 1. Reply mode (bug #1)

- [x] 1.1 Added `replyMode: z.enum(["final","pre-tool"]).default("final")` to `agentConfigSchema` + `Agent` type
- [x] 1.2 `createInvokeLLM` branches the final-response selection on `agent.replyMode`: `final` → post-tool text (pre-tool fallback); `pre-tool` → prior behavior
- [x] 1.3 `agents.yaml` + example: María `pre-tool`, José `final`; José TURNO 1 prompt now greets + asks the first question in one post-tool message, neutral greeting (no web-application assumption, no "déjame revisar" filler)

## 2. Zone-check fix (bug #2, core scoring)

- [x] 2.1 Added `normalizeProvince()` in `scoring/engine.ts` (NFD + strip `\p{Diacritic}`, uppercase, non-alnum → `_`, trim `_`)
- [x] 2.2 Applied on both sides of the `OUT_OF_ZONE` comparison vs `CONFIG.zona_cobertura`
- [x] 2.3 Verified via runtime scoreInput: `"Puerto Plata"`, `"Puerto Plata."`, `"puerto  plata"`, `"PUERTO_PLATA"` → not flagged; `"Santiago"`, `"Samaná"` → flagged; `""` → not flagged

## 3. Timing copy (bug #3)

- [x] 3.1 `agents.yaml` (+ example): replaced the weekend/`lunes a viernes` finalization copy (2 prompt spots) with "Un asesor la revisará en 24 a 48 horas hábiles…"; rejection copy unchanged (still declines)
- [x] 3.2 Updated José's eval `expectedAI` (3 closings → 24–48h; 3 turn-1 greetings → greeting + first question)

## 4. Verification

- [x] 4.1 `@mikro/common`/`@mikro/agents`/`@mikro/apiserver` build clean; lint clean on changed files
- [x] 4.2 Ran the full eval suite (live LLM + judge): José 5/5 scenarios (15/15 turns) — turn-1 greeting+question in one message, 24–48h closings; María 4/4 (5/5 turns) — pre-tool "¡Listo! ¿Algo más?" still surfaces
- [x] 4.3 María pinned `replyMode: pre-tool`; payment eval confirms her alongside-tool reply surfaces — no behavior change
- [x] 4.4 Stood up the first `@mikro/common` test harness (mocha + tsx + chai, `.mocharc.json`, `test:` script) and added `test/scoring/zoneFlag.test.ts` — 8 passing (served province in all forms not flagged; other provinces flagged; empty not flagged)

## 5. Regression coverage (all agents)

- [x] 5.1 Added a María eval suite to `agents.yaml` (greeting, register-payment, mora report, off-topic guardrail) so the pre-tool reply path is regression-covered alongside José
- [x] 5.2 Full `npm run agents:eval` green for both agents
