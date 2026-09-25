# Mikro Agents

This module is part of the Mikro. By itself, it does not do much. It is intended to be used as a dependency for other modules. For more information about the project, please visit https://github.com/psanders/mikro.

## WhatsApp routing

Every inbound WhatsApp message goes to one profile, and the agent assigned to that profile in `agents.yaml` answers. A profile with no enabled agent gets no reply. The rules are in `src/router/createMessageRouter.ts`:

| Who is writing                                    | Profile     | Agent                                                 |
| ------------------------------------------------- | ----------- | ----------------------------------------------------- |
| Enabled staff user (ADMIN > REVIEWER > COLLECTOR) | their role  | none by default: no reply, the message is in Chatwoot |
| Customer                                          | `CUSTOMER`  | Carmen: own loans, balance, receipts                  |
| Application in `DRAFT`                            | `PROSPECT`  | José: finishes the intake                             |
| `ABANDONED` and never submitted                   | `PROSPECT`  | reopened to `DRAFT`, then José                        |
| Application `RECEIVED` → `APPROVED`               | `APPLICANT` | Sofía: stage + missing evidence only                  |
| Anyone else                                       | `GUEST`     | Lucía: FAQ + link to the solicitud                    |

Every agent except staff can hand the conversation to a person (`requestHumanHandoff`). An explicit request like "quiero hablar con una persona" also triggers it. While a hand-off is open, no agent replies to that phone; it closes after 24h of silence. Each hand-off shows up in the founder feed as `cx.handoff_requested`.

`whatsapp.agentRepliesEnabled: false` in `mikro.json` silences every route.

### Rollout

The CX agents (Lucía, Sofía, Carmen) are enabled. Production reads its own copy of `agents.yaml` next to `mikro.json`, and deploys never update it. After changing `agents.yaml`, copy it to the server and restart the container. To turn one agent off quickly, set its `enabled: false` in the server's copy and restart. To check a prompt change, run `npm run agents:eval -- <agent>`.

## Example customers report

To generate a sample Excel report with rating, missed payments count, and trend columns (for manual inspection) from the root of the project:

```bash
npm run report:example -w @mikro/agents
```

This writes `reporte-ejemplo-YYYY-MM-DD.xlsx` in the current working directory. You can also run from the repo root:
