## Context

Agents are TypeScript objects in `mods/agents/src/agents/{maria,jose}/`. `mods/apiserver/src/agents/loadAgents.ts` imports those objects, validates each with `agentConfigSchema` (Zod) in `agentSchema.ts`, and returns a `Map<AgentName, Agent>`. The validation step already treats agents as if they were external data — the comment in `loadAgents.ts` literally says "loaded from JSON" — but the source is compiled code, so every prompt edit needs an image rebuild.

The project already has a config mechanism: `mikro.json` at repo root (gitignored), resolved by `@mikro/common`'s `getConfig()` via `MIKRO_CONFIG_FILE`, with a checked-in `mikro.json.example`. `disabledAgents` already lives there, validated against `AGENT_NAMES_CONFIG`, which is stale (`["joan", "maria"]` — predates José).

Constraints: ESM + zod everywhere (shared via `@mikro/common`); agents run under LangChain multi-provider; `evaluations` blocks are large and code-shaped (José's is ~40KB of scenarios and mock tool responses) and belong to the eval harness, not to operator-editable config.

## Goals / Non-Goals

**Goals:**

- Agent `name`, `systemPrompt`, `allowedTools`, `temperature`, `model`, and all decline/zone/closing copy editable via an external JSON file, applied by restart/reload — no image rebuild.
- Reuse the existing `agentConfigSchema` for validation; fail fast with agent-named errors.
- Adding a new agent = adding a JSON entry (tools must already exist in code).
- `evaluations` stay code-owned; bind onto config agents by `name`.
- Fix `AGENT_NAMES_CONFIG` so `disabledAgents` accepts real agents.

**Non-Goals:**

- Fixing José's conversational bugs (premature finalize, trusting placeholder data, accept-then-reject). Tracked separately; this change only relocates where agents live.
- Hot-reload-on-file-change / watch semantics. Restart (or an explicit reload call) is sufficient.
- A UI/admin surface for editing agents. The artifact is a JSON file.
- Moving tool _implementations_ to config. Tools stay in code; config only references them by name.

## Decisions

**1. Store agents in their own JSON file, not inside `mikro.json`.**
Agents are large, multi-line (prompts with embedded newlines), and iterated independently of infra config (WhatsApp tokens, LLM keys). A dedicated `agents.json` (path resolved next to / alongside `mikro.json`, overridable via env e.g. `MIKRO_AGENTS_FILE`) keeps prompt churn out of the secrets-bearing infra config and makes diffs readable. Checked-in `agents.json.example` documents the shape.
_Alternative considered_: an `agents` key inside `mikro.json` — rejected; bloats the secrets file and couples prompt edits to infra config validation.

**2. Reuse `agentConfigSchema`; extend with a tool-existence check.**
The schema already validates `name`/`systemPrompt`/`allowedTools`/`temperature`/`model`/`evaluations`. Add a post-parse check that every `allowedTools` entry resolves against the in-code tool registry (`getToolByName`/`allTools`), since an agent that lists a non-existent tool is a silent runtime failure today.
_Alternative considered_: trust runtime to skip unknown tools — rejected; fails silently, exactly the kind of bug hard to catch without a rebuild loop.

**3. `evaluations` are code-owned and merged by name.**
Evaluations live in the agent's own entry in `agents.yaml` (optional `evaluations` block, validated by the agent schema). Nothing about an agent is hardcoded — superseding the earlier "code-owned evals" iteration. YAML's block scalars and lack of escaping make the ~40KB of prompts + scenarios maintainable by hand, which was the original objection to putting evals in JSON. The eval harness reads scenarios straight from the loaded agent.

**4. Derive the agent-name roster from the loaded agents, not a hardcoded list.**
Replace stale `AGENT_NAMES_CONFIG = ["joan","maria"]`. `disabledAgents` validation should accept any name present in the loaded agent set. Where Zod needs a static enum at parse time (config loaded before agents), validate `disabledAgents` membership as a post-load cross-check against loaded agent names rather than a frozen enum, OR source the enum from `AGENT_NAMES` in `@mikro/agents/constants`. Prefer sourcing from `AGENT_NAMES` (already the real roster: `["maria","jose"]`) to keep a single source of truth.
_Alternative considered_: just edit the literal to `["maria","jose"]` — works short-term but re-introduces the same staleness on the next agent; deriving from `AGENT_NAMES` prevents recurrence.

**5. `loadAgents()` reads + parses the JSON, keeping its current return type.**
`loadAgents(): Map<AgentName, Agent>` stays the public contract. Internally it reads the JSON file, parses each entry through `agentConfigSchema`, attaches code-owned evals, and validates tool existence. Callers in `apiserver/src/index.ts` are unchanged. Provide a `clearAgentsCache()`/reload entrypoint mirroring `clearConfigCache()` so a reload is possible without full process restart.

**6. Bind agents to audience profiles in config; route by profile.**
Add a required `profile` field per agent (`ADMIN | COLLECTOR | REVIEWER | PROSPECT | GUEST`). `Profile` is defined as a superset of the DB `Role` (ADMIN/COLLECTOR/REVIEWER) plus the router-derived PROSPECT and GUEST. `loadAgents()` enforces one-agent-per-profile. A `getAgentByProfile(agents, profile)` resolver replaces the hardcoded `ROLE_TO_AGENT` map and the special-cased `joseAgent` dependency. The router resolves the user's role profile via `getAgentForProfile`, and now emits a `guest` route for unknown phones (instead of `ignored`); the WhatsApp handler resolves PROSPECT/GUEST agents the same way. The apiserver's `getAgentForProfile` also treats a `disabledAgents` agent as unassigned, so disabling an agent leaves its profile unserved.
_Alternatives considered_: (a) keep `ROLE_TO_AGENT` in code — rejected; it's exactly the hardcoded registry this change removes. (b) Make `AgentName` a plain string for fully dynamic agents — rejected as out of scope; the typed roster stays, profiles are the routing key. (c) Resurrect a full guest auto-reply path — deferred; GUEST is wired through `getAgentForProfile` but unassigned by default, so behavior is unchanged until an operator assigns a guest agent.

**7. Profile is the sole agent identity in code; no agent names.**
Remove `AgentName`/`AGENT_NAMES`/`AGENT_MARIA`/`AGENT_JOSE`/`VALID_AGENT_NAMES`. Agents are keyed by `Profile` everywhere (`Map<Profile, Agent>`), evals bind by profile, and disabling is by profile (`disabledProfiles`). `name` remains on the agent as a display label only (logs, eval output); the application never branches on it. The canonical `profileEnum`/`AGENT_PROFILES`/`Profile` moves to `@mikro/common` (next to `Role`, of which it is a superset), so the config schema can validate `disabledProfiles` directly; `@mikro/agents` re-exports it. This makes a one-agent-per-profile model the contract: `loadAgents()` rejects a profile claimed twice, and routing is "look up the phone → get a profile → resolve the agent for that profile."
_Alternatives considered_: keep a typed name roster (previous iteration) — rejected per the requirement that no agent names appear in code; the roster was the last name-shaped coupling. Keying by name with a profile field — rejected; two identities invite drift and keep name in routing logic.

## Risks / Trade-offs

- **Editable prompts ship to prod via a file, not code review** → Provide `agents.json.example`, keep Zod validation strict (fail fast), and document that prompt edits should still go through the normal change process; the file is gitignored but the example + this spec define the contract.
- **Invalid edits take down agent loading at startup** → Fail-fast with agent-named, field-named errors; keep the example file as a known-good reference; a bad deploy is caught at boot, not mid-conversation.
- **Tool-existence check couples config load to the tool registry import** → Acceptable; the registry is already imported wherever agents run, and catching a bad tool name at load is the whole point.
- **Drift between code-owned evals and config agents** → The harness reports agents named in evals but missing from config (and vice versa), surfacing drift instead of silently passing.
- **`AGENT_NAMES` enum still requires a code edit per new agent name** → True, but it is a one-line constant, not a Docker rebuild concern for _prompt_ iteration (the stated pain). Full nameless dynamism is a non-goal here.

## Migration Plan

1. Add `agents.json.example` capturing current María + José (`name`, `systemPrompt`, `allowedTools`, `temperature`, `model`), minus `evaluations`.
2. Implement JSON-backed `loadAgents()` + tool-existence check + eval-by-name binding.
3. Keep code-owned `evaluations` (José's suite) in a `name → evaluation` map.
4. Fix `AGENT_NAMES_CONFIG` to source from `AGENT_NAMES`.
5. Operators create `agents.json` from the example (or it is provisioned by deploy).
6. **Rollback**: revert the loader to import the in-code objects (kept until the JSON path is proven), or restore the previous image. No DB/API migration to undo.

## Open Questions

_Resolved:_

- **File path/env**: `agents.json` beside `mikro.json`, `MIKRO_AGENTS_FILE` override. Confirmed.
- **Reload trigger**: restart-only for v1. Manual restart on config change; no reload endpoint.
- **In-code agent objects**: delete `mods/agents/src/agents/{maria,jose}/` runtime modules; their prompts/copy seed `agents.json.example`. José's `evaluations` move to a code-owned map (not deleted).
