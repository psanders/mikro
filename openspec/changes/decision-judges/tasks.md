## 1. Eval rubric checks

- [x] 1.1 `checks` on scenario turns (schema and types). The runner judges them via the decision model, with the LLM for unsure answers and for the reasons behind failures, and a dispute ceiling of 0.9.
- [x] 1.2 `--judge auto|similarity|checks|both` and stats.
- [x] 1.3 Add checks to every José/Lucía/Sofía/Carmen scenario (54), one concept per check.
- [x] 1.4 Unit tests (stubbed decision provider and LLM).

## 2. Audit

- [x] 2.1 Judge each agent's turns against its own rules; the judge prompt names the agent.
- [x] 2.2 Code checks `double_reply`, `stuck_loop`, `unanswered` and `closing_loop`, with tests.

## 3. Follow-ups

- [ ] 3.1 Founder confirms the provisional labels (hand-labels.json, policy-truth.json) and the check wording.
- [ ] 3.2 Store tool results and SISTEMA notes in `conversation_turns`, so `no_inventar` and `numeros_exactos` can be judged.
- [ ] 3.3 Consolidate overlapping policies (`no_insiste` / `no_interesa` / `handoff` / `envia_pronto`).
- [ ] 3.4 Copy `agents.yaml` to prod after merge.
- [ ] 3.5 Revisit the layered audit judge (design D3) once 3.2 is done.
