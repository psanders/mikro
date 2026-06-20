## Why

Agent definitions (María, José, and any future agent) are TypeScript objects compiled into the `@mikro/agents` package and baked into the apiserver Docker image. Every copy tweak — a system-prompt wording fix, a decline message, an `allowedTools` adjustment, a temperature bump — requires a rebuild and a new image push to take effect. The José prospect-intake flow shipped recently and already needs iteration (premature finalization, placeholder data trusted blindly, contradictory accept-then-reject messaging), and tuning agent prompts by redeploying is too slow a loop. Agents are configuration, not code, and should be editable without shipping a new binary.

## What Changes

- Agent definitions move out of compiled TypeScript (`mods/agents/src/agents/{maria,jose}/`) into an external YAML file, so `systemPrompt`, `allowedTools`, `temperature`, `model`, display label, and all decline/zone/closing copy can be edited and applied by restart without rebuilding the apiserver image.
- The apiserver loads agents from the YAML file at startup, validating each entry with the `agentConfigSchema` Zod schema and verifying every `allowedTools` entry exists in code. Loading fails fast with a clear error on invalid config.
- **Agents are identified by audience profile only — no agent names anywhere in code.** Each agent declares a `profile` (`ADMIN`, `COLLECTOR`, `REVIEWER`, `PROSPECT`, or `GUEST`); agents are keyed and routed by profile, one agent per profile. `name` survives purely as a display label for logs/eval output and the application never branches on it. This removes the `AgentName`/`AGENT_NAMES`/`AGENT_MARIA`/`AGENT_JOSE` constants, the hardcoded `ROLE_TO_AGENT` map, and the special-cased José wiring.
- A new agent is added entirely through config — no new TS module, no registry edit, no image rebuild — provided its `profile` is one of the fixed code-defined profiles and its `allowedTools` exist. A profile is served only if an agent is assigned (today: María→ADMIN, José→PROSPECT; COLLECTOR/REVIEWER/GUEST unassigned → no automated reply, preserving current behavior).
- Routing resolves the serving agent by the profile the phone-number lookup yields: DB user → role profile; unknown phone with a partial application → PROSPECT; unknown phone with no application → GUEST.
- **Evaluations live in the agent file**, not in code: each agent may carry an `evaluations` block (José's scenario suite) in `agents.yaml`. Nothing about an agent is hardcoded.
- **Each agent enables/disables itself** via an `enabled` flag in its `agents.yaml` entry (default `true`); a disabled agent leaves its profile unserved. There is no disable list in `mikro.json`. The canonical `Profile`/`AGENT_PROFILES` enum lives in `@mikro/common` alongside `Role`.
- **The agents file path is set in `mikro.json`** via `agentsFile` (default `agents.yaml`, resolved relative to the `mikro.json` directory), so it follows the existing `getConfig()` mechanism. A checked-in `agents.yaml.example` documents the shape. The file is YAML only.

## Capabilities

### New Capabilities

- `agent-configuration`: How agents are defined, stored, validated, loaded from an external YAML file; the schema contract for an agent entry; how evaluations live in the file; how a new agent is added through config alone.

### Modified Capabilities

<!-- No existing spec's documented requirements change. José's conversational behavior bugs are tracked separately; this change is about where agents live, not what they say. -->

## Impact

- **Code**: `mods/common/src/schemas/user.ts` (canonical `profileEnum`/`AGENT_PROFILES`/`Profile`), `mods/common/src/config.ts` (`agentsFile` path + YAML loader, removed `disabledProfiles`), `mods/agents/src/constants.ts` (re-export Profile; removed all name constants), `mods/agents/src/llm/types.ts` (`Agent.profile` + `enabled`, `name` demoted to label), `mods/agents/src/agents/` (profile-keyed YAML loader, schema incl. `evaluations`; deleted the code-owned eval suite), `mods/agents/src/router/` (resolve by profile, new `guest` route, dropped name-based disable), `mods/agents/src/whatsapp/handleWhatsAppMessage.ts` (resolve by profile), `mods/apiserver/src/agents/loadAgents.ts` + `mods/apiserver/src/index.ts` (profile-keyed map, per-agent `enabled`).
- **Config**: New `agents.yaml` (+ checked-in `agents.yaml.example`) carrying `profile`, `enabled`, and optional `evaluations` per agent; `mikro.json` gains `agentsFile` and drops `disabledAgents`. `@mikro/common` gains a `yaml` dependency.
- **Ops**: Operators edit agent copy/prompts/profile/enabled/evals in `agents.yaml` and apply by restart, no image push. **Breaking `mikro.json` change**: remove `disabledAgents` (disable agents via `enabled: false` in `agents.yaml`); optionally set `agentsFile`.
- **No API/DB changes**; tool implementations and tRPC surface unchanged.
