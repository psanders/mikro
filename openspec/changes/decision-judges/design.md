## Context

Experiment run on 2026-10-16 against a copy of the production database (305 turns, 35 conversations). The raw results are in the session's scratchpad. The labels used as truth are provisional and need founder confirmation:

- 179 inbound turns labeled by hand;
- 13 (turn, rule) violations;
- 9 known-bad eval replies.

## Decisions

### D1. Checks replace similarity when present

- **The problem:** "similar to expected" punished wording and rewarded plausible but wrong replies.
- **What a check is:** one closed question about one concept. A compound question ("¿puntaje, probabilidades o motivos?") made the LLM misread a correct answer, so compound checks are split.
- **Order of judges:** the decision model answers first. Unsure answers (0.3–0.7) go to the LLM.
- **Failures:** every failure gets the LLM's reason. Below 0.9 certainty the LLM's disagreement wins. It caught a decision misreading at p = 0.8, and the LLM had once overruled a correct p = 1.0 answer.

### D2. The audit judges each agent against its own rules

`runAudit` creates one judge task per agent that wrote in the window. It is the biggest single improvement in the experiment: it took the existing judge from 0 to 3 of 5 problem conversations.

### D3. Layered audit: screen, then focused confirm

- **The screen question:** "La regla del agente dice: «…». ¿El mensaje hace lo que esta regla prohíbe, o deja de hacer lo que exige?".
- **Flag threshold:** p ≥ 0.7.
- **Confirmation:** each flag gets one focused LLM question, at most one finding per rule per conversation.

Measured against the old judge (after the D2 fix):

|           | Problem conversations found (of 5) | LLM calls | Decision calls |
| --------- | ---------------------------------- | --------- | -------------- |
| Old judge | 3                                  | 34        | 0              |
| Layered   | 4                                  | 30        | 113            |

The layered judge produces more findings, partly because overlapping rules (`no_insiste`, `no_interesa`, `handoff`, `envia_pronto`) all fire on the same spouse loop. Rules that need data the transcript lacks (`no_inventar`) produced most of the noise, so they are not screened.

## Risks / Trade-offs

- **Missing data:** the transcript lacks tool results and the SISTEMA notes (rejected / out-of-area directives). No judge can check `numeros_exactos` or `no_inventar` reliably, and the correct reapply-date replies look invented. Storing both is the next step.
- **Overlapping rules:** they produce duplicate findings on one problem. Consolidating them is a policy-authoring task.
- **Beta API:** the Decisions API is in public beta, and `gpt-6-luna` is an alias.
