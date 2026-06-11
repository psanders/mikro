# WhatsApp intake Flow

`solicitud-credito.json` is the WhatsApp Flow that mirrors the website loan
application form (`site` → SolicitudPage). When enabled, a prospect who messages
the business number is greeted with a button that opens this native in-chat
form; on submit, the answers are mapped to the same `/v1/applications` intake
the website uses, so scoring and the dashboard are identical across channels.

The applicant's own phone is **not** in the form — it's taken from the WhatsApp
sender number.

## One-time setup (Meta side)

1. **WhatsApp Manager → Flows → Create Flow.** Name it (e.g. "Solicitud de
   crédito"), category "Sign up" / "Lead generation".
2. **Endpoint:** none. This is a static Flow — all screens render on-device and
   the form posts once on completion. Do not attach a data endpoint.
3. **Editor → `</>` (JSON):** paste the contents of `solicitud-credito.json`.
   Save, then **Publish**.
4. Copy the **Flow ID**.

## Enable it (Mikro config)

In `mikro.json`:

```json
"whatsapp": {
  "intakeFlow": { "enabled": true, "flowId": "<the published Flow ID>" }
}
```

Restart the apiserver. Until both `enabled: true` and a non-empty `flowId` are
set, unknown numbers are ignored exactly as before.

## Test

Message the business number from a phone that is **not** an existing user or
customer. You should get the greeting + "Solicitar crédito" button; completing
the form creates a `RECEIVED` application visible in the dashboard, scored.

## Editing the form

Keep dropdown option **ids** byte-identical to the website form's values
(`mods/dashboard/src/lib/applicationFields.ts` and `site` SolicitudPage) — the
deterministic scorer matches on those exact strings (e.g. `COLMADO`,
`PUERTO_PLATA`, `"Más de 5 años"`). Field **names** must match the English
content keys in `mods/common/src/schemas/application.ts`. After editing, re-paste
the JSON and publish a new version.
