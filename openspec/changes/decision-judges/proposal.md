## Why

Our two judges asked the wrong questions:

- **Evals** asked "is the reply similar to the expected reply?". That passed wrong facts and failed correct wording. On 2026-10-16, against 9 known-bad replies, it passed 2, including one that states the rejection reasons (a critical rule). Across 3 runs of every scenario, it failed 8 of 84 turn-runs on wording alone (`phone-validation-reask`, `customer-new-application-status`, `guest-out-of-zone`).
- **The audit** asked one LLM to grade a whole conversation against every rule of the agent that served it last. In a conversation José started and Sofía finished, José's turns were graded by Sofía's rules, and a Sofía turn was flagged under a Lucía rule. It found 0 of 13 hand-labeled violations in the 305 stored turns.

A decision model (OpenAI Decisions) answers closed yes/no questions with a probability, for about $0.10 per million input tokens. That makes it cheap to ask many explicit questions per turn. At confidence ≥ 0.9 it was right every time on our Spanish data.

## What Changes

- **Eval rubric checks:** a scenario turn may list `checks`, each a Spanish yes/no question about the reply plus the expected answer.
  - The decision model answers all of a turn's checks in one request.
  - An unsure answer (probability between 0.3 and 0.7) goes to the LLM judge.
  - A failing answer gets an LLM-written reason. Below 0.9 certainty, the LLM's disagreement wins.
  - When a turn has checks and a classifier is configured, the checks decide the turn instead of similarity.
  - `agents:eval --judge auto|similarity|checks|both` compares the two judges.
  - The four agents' 21 scenarios now carry 54 checks.
- **Audit, judge per agent:** each agent that wrote in a conversation is judged against its own rules, and the judge is told which agent's turns to grade.
- **Audit, layered judge:** applies when a `classifier` is configured.
  - The decision model screens every agent turn against every screenable rule. The question names what the rule forbids, because "incumple la regla «No da…»" confused it with a double negative.
  - Each flag is confirmed by one focused LLM question; the turn is the evidence.
  - Rules a single message can't show (`screen: false`: `no_inventar`, `numeros_exactos`) are graded by the whole-conversation judge, only for conversations already escalated.
- **New audit code checks:**
  - `double_reply`;
  - `stuck_loop` (the same request three times);
  - `unanswered`;
  - `closing_loop` (kept answering goodbyes, from the classifier labels).

## Capabilities

### New Capabilities

- `agent-evals`: rubric checks for eval scenarios, judged by the decision model.

### Modified Capabilities

- `conversation-audit`: per-agent judging and the layered decision screen.

## Impact

- **`mods/agents`:**
  - `eval/checks.ts`, `eval/runner.ts`, `eval/cli.ts`;
  - `audit/screen.ts`, `audit/runAudit.ts`, `audit/judge.ts`, `audit/checks.ts`;
  - `decisions/llmCheck.ts`.
- **`agents.yaml`:** eval `checks`, and `screen: false` on two rules. Prod reads its own copy, which must be updated by hand.
- **`mods/apiserver/src/index.ts`:** the layered judge is wired when `classifier` is set.
- **No migration, no new config key.** The layered audit and the decision checks turn on with the `classifier` section from `conversation-state`.
