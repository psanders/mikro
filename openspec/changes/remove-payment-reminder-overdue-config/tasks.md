## 1. Remove dead config keys

- [x] 1.1 Remove `paymentReminder` and `paymentOverdue` from `whatsapp.templates` in `mikro.json.example` (keep `paymentConfirmation`).
- [x] 1.2 Remove `paymentReminder` and `paymentOverdue` from `whatsapp.templates` in the local `mikro.json` (keep `paymentConfirmation`).

## 2. Verify nothing breaks

- [x] 2.1 Repo-wide sweep confirms no remaining `payment_reminder`/`payment_overdue`/`paymentReminder`/`paymentOverdue` references.
- [x] 2.2 `@mikro/common` builds and `mikro.json` still loads/validates (keys were never in the schema; `paymentConfirmation` retained).
