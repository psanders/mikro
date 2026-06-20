## 1. Config file + example

- [x] 1.1 Decide path/env: `agents.json` beside `mikro.json`, override via `MIKRO_AGENTS_FILE`; resolver `getAgentsConfigFilePath` added in `@mikro/common` (env → cwd default), mirroring `getConfigFilePath`
- [x] 1.2 Create checked-in `agents.json.example` with María and José entries (`name`, `systemPrompt`, `allowedTools`, `temperature`, `model`), no `evaluations` (generated from the in-code objects to preserve fidelity)
- [x] 1.3 Gitignore the real `agents.json`; local `agents.json` created for dev from the example

## 2. Loader: JSON-backed agents

- [x] 2.1 `agentConfigSchema` moved into `@mikro/agents` (`agents/agentSchema.ts`); shared by runtime + eval CLI; agent-named/field-named fail-fast errors
- [x] 2.2 Rewrote `@mikro/agents` `loadAgents()` to read+parse JSON via `loadRawAgentsConfig`; apiserver `loadAgents.ts` now delegates to it; `Map<AgentName, Agent>` return preserved so callers are unchanged
- [x] 2.3 `loadRawAgentsConfig` fails fast when the file is absent, naming the path and pointing at `agents.json.example`
- [x] 2.4 N/A for v1 — `loadAgents()` reads the file fresh on each call (no cache), so a restart re-reads; hot reload deferred per design

## 3. Tool-existence validation

- [x] 3.1 After schema parse, cross-check every `allowedTools` entry against `getToolByName`
- [x] 3.2 Fail with a hard error on unknown tool names, naming the agent and the missing tool (verified)

## 4. Code-owned evaluations binding

- [x] 4.1 `agents/evaluations.ts` holds José's suite (helpers + scenarios) in a `name → AgentEvaluation` map; removed from the agent object
- [x] 4.2 `loadAgents()` attaches the eval suite by `name`; JSON omits `evaluations`
- [x] 4.3 `loadAgents()` throws if an eval suite names an agent absent from the config (verified)

## 5. Agent-name roster fix

- [x] 5.1 Removed stale `AGENT_NAMES_CONFIG = ["joan","maria"]`; `disabledAgents` now validates as strings and is cross-checked against loaded agents at apiserver startup
- [x] 5.2 Unknown `disabledAgents` names fail fast at startup naming the unknown name + loaded agents; real names (`jose`) accepted

## 6. Profile-based routing

- [x] 6a.1 Add `AGENT_PROFILES`/`Profile` (`ADMIN|COLLECTOR|REVIEWER|PROSPECT|GUEST`, superset of DB `Role`) + `VALID_AGENT_PROFILES` to `constants.ts`; remove hardcoded `ROLE_TO_AGENT`
- [x] 6a.2 Add required `profile` to `Agent` type and `agentConfigSchema`; add `profile` to `agents.json(.example)` (maria=ADMIN, jose=PROSPECT)
- [x] 6a.3 `loadAgents()` enforces one-agent-per-profile; add `getAgentByProfile(agents, profile)` resolver; export `Profile`/`AGENT_PROFILES`/`getAgentByProfile`
- [x] 6a.4 Router: add `getAgentForProfile` dep, resolve user role profile via it, emit `guest` route for unknown phones (replacing `ignored`)
- [x] 6a.5 WhatsApp handler: replace `getAgent`/`joseAgent` deps with `getAgentForProfile`; resolve PROSPECT (José) and GUEST agents by profile; guest replies only when a GUEST agent is assigned
- [x] 6a.6 apiserver: build `getAgentForProfile` from `getAgentByProfile` (skipping disabled agents); wire into router + message processor; drop `getAgent`/`joseAgent`/`AGENT_JOSE` usage
- [x] 6a.7 Update `handleWhatsAppMessage` test mock (`getAgent` → `getAgentForProfile`)

## 7. Name-independent: profile is the only identity

- [x] 7.1 Move canonical `profileEnum`/`AGENT_PROFILES`/`Profile` into `@mikro/common` (`schemas/user.ts`, superset of `Role`); export from common; re-export from `@mikro/agents` constants
- [x] 7.2 Remove `AgentName`/`AGENT_NAMES`/`AGENT_MARIA`/`AGENT_JOSE`/`VALID_AGENT_NAMES` from `@mikro/agents`; demote `Agent.name` to display-label-only (doc comment)
- [x] 7.3 Key the agents map by `Profile` (`loadAgents(): Map<Profile, Agent>`); `getAgentByProfile` = map lookup; drop name-roster validation; drop apiserver `getAgent` helper
- [x] 7.4 Bind code-owned evaluations by `profile` (`{ PROSPECT: joseEvaluation }`); loader reports an eval profile with no serving agent
- [x] 7.5 Rename config `disabledAgents` → `disabledProfiles` (validated against profile enum); `getDisabledProfiles`; apiserver resolves disabled at profile level; drop router `isAgentDisabled` dep; update `mikro.json`/`mikro.json.example`
- [x] 7.6 Add `profile` to `agents.json(.example)`; keep `name` as label

## 7b. Path in mikro.json + self-disable per agent

- [x] 7b.1 Add `agentsFile` to `mikroConfigSchema` (default `agents.json`); `getAgentsConfigFilePath` resolves it via `resolvePathFromConfigDir` (relative to mikro.json dir); drop the `MIKRO_AGENTS_FILE` env path
- [x] 7b.2 Add `enabled` to `agentConfigSchema` (default `true`) and `Agent` type; apiserver `getAgentForProfile` treats `enabled: false` as unserved
- [x] 7b.3 Remove `disabledProfiles` from `mikroConfigSchema`, `getDisabledProfiles`, and apiserver usage; update `mikro.json`/`mikro.json.example` (`disabledProfiles` → `agentsFile`); add `enabled` to `agents.json(.example)`
- [x] 7b.4 Verified: agents load via `mikro.json` `agentsFile`; `enabled: false` leaves the profile unserved; builds + lint clean; 130/15 test baseline held

## 7c. Evaluations in the file + YAML only

- [x] 7c.1 Add `evaluations` (optional) to `agentConfigSchema`; delete the code-owned `evaluations.ts` and its export — nothing about an agent is hardcoded
- [x] 7c.2 Loader reads evals straight from the parsed entry (no code attach / no eval-profile cross-check)
- [x] 7c.3 Add `yaml` dep to `@mikro/common`; `loadRawAgentsConfig` parses YAML; `agentsFile` default `agents.yaml`
- [x] 7c.4 Migrate María + José (incl. José's 5-scenario suite) into `agents.yaml` (block-scalar prompts); write `agents.yaml.example`; point `mikro.json` at it; gitignore `agents.yaml`
- [x] 7c.5 Remove JSON entirely: delete `agents.json`/`agents.json.example`; loader is YAML-only; purge JSON wording from code comments
- [x] 7c.6 Verified: loads from `agents.yaml` via `mikro.json`; José's 5 scenarios load from the file; builds + lint clean; 130/15 test baseline held

## 8. Cleanup + verification

- [x] 8.1 Deleted `mods/agents/src/agents/{maria,jose}/`; removed `jose`/`maria`/`JOSE_SYSTEM_PROMPT` exports; deleted apiserver `agentSchema.ts`; cleared stale dist output
- [x] 8.2 Verified loader binds José's 5 scenarios to the config-loaded agent by profile; María loads with no evals (direct loader run, not full LLM eval — eval run needs configured judge/keys)
- [x] 8.3 Smoke-tested loader against `agents.json.example`: load, missing-tool, dup-profile, missing-profile, unserved-eval-profile all behave correctly
- [x] 8.4 Lint clean on changed files; `@mikro/common`/`@mikro/agents`/`@mikro/apiserver` typecheck clean; agents test suite unchanged (130 pass / 15 pre-existing config-env fails, identical on clean tree); repo-wide grep confirms zero references to removed name symbols
