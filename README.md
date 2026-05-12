# Mikro Créditos

This is the main repository for the Mikro project. It is a monorepo that contains all the modules for the Mikro project.

Build a linux compatible docker image (tagged as both `latest` and the version from `package.json`):

```bash
docker build --platform linux/amd64 -t psanders/mikro:latest -t psanders/mikro:$(node -p "require('./package.json').version") -f mods/apiserver/Dockerfile --push .
```

Run with either tag:

```bash
docker run -p 3000:3000 psanders/mikro:latest
```

## Docker Compose Setup

Before running with `docker compose up`, create the data directory with proper ownership:

```bash
mkdir -p data
sudo chown -R 1001:1001 data
```

The container runs as UID 1001 (`nodejs` user), so mounted volumes need matching ownership to allow writes (e.g., SQLite database).

## Accounting module

A small, self-contained accounting module lives alongside the loan system. It is
API-first (tRPC) with a prompt-driven CLI. It shares only authentication with
the rest of the app. For how this relates to loans, interest, and collections at
a conceptual level, see [ACCOUNTING.md](./ACCOUNTING.md).

## Past-due fee (mora)

When a loan is in arrears, Mikro can accrue a **past-due (mora)** amount using the
configured daily-prorated formula (one cuota’s worth, capped by policy). On
collection, cash is allocated **mora-first**: the server may create two `Payment`
rows for one deposit — `LATE_FEE` then `INSTALLMENT` — linked so reversals and
receipts stay consistent.

- Policy defaults live under `loans` in `mikro.json` (see `mikro.json.example`):
  `defaultMoraRate`, `moraGraceDays`, `moraCapInCuotas`, `moraMinDop`,
  `moraStopOnDefault`, `moraEffectiveFrom`.
- Optional per-loan override: `moraRate` on the loan.
- API: `previewLateFee` (read-only) and `createPayment` (returns `{ installment, lateFee }`).
- CLI: `mikro payments:create` shows cuota / mora / suggested total and supports
  `--late-fee-override` (DOP waived from accrued mora before split).
- Mora is **not** auto-posted to the accounting ledger; deposits are still
  recorded manually in the accounting module when appropriate.

### Seed data (accounts and categories)

After `prisma db seed`, the database includes four **accounts** (all in DOP, zero
opening and current balance) and eleven **categories** (no sample transactions).

| Name                  | Kind |
| --------------------- | ---- |
| Cuenta de Recaudación | BANK |
| Cuenta Operativa      | BANK |
| Caja General          | CASH |
| Caja Chica            | CASH |

| Name                           | Kind    |
| ------------------------------ | ------- |
| Alquiler                       | EXPENSE |
| Energía Eléctrica              | EXPENSE |
| Agua                           | EXPENSE |
| Combustible                    | EXPENSE |
| Mantenimiento de Vehículos     | EXPENSE |
| Suministros de Oficina         | EXPENSE |
| Salarios                       | EXPENSE |
| Comisiones de Referidos        | EXPENSE |
| Honorarios Contables y Legales | EXPENSE |
| Comisiones Bancarias           | EXPENSE |

Config (`mikro.json`):

```json
"accounting": {
  "attachmentsPath": "./mods/apiserver/data/attachments/accounting"
}
```

CLI commands (each prompts interactively when a flag is omitted):

```bash
# Accounts (bank, cash, credit card, other)
mikro accounting:accounts:create
mikro accounting:accounts:list
mikro accounting:accounts:update

# Categories (EXPENSE or INCOME)
mikro accounting:categories:create
mikro accounting:categories:list

# Transactions (DEPOSIT, WITHDRAWAL, EXPENSE, INCOME, TRANSFER)
mikro accounting:transactions:create              # walks through prompts
mikro accounting:transactions:create --attach ./scans/edesur.pdf
mikro accounting:transactions:list --start-date 2026-04-01 --end-date 2026-04-30
mikro accounting:transactions:show                # with --save-attachments ./out
mikro accounting:transactions:reverse             # creates mirror + flags original
```

Receipt attachments (PNG, JPG, PDF, max 10 MB) are stored server-side under
`accounting.attachmentsPath`.

## Authentication

The API only accepts per-user Bearer JWTs. There is no shared credential.

- Log in with `mikro auth:login` and provide the phone (E.164, e.g. `+18091234567`) and password of an existing user. The CLI stores the returned JWT under `~/.mikro/config.json` and sends it as `Authorization: Bearer <token>` on every request.
- Tokens expire after `jwtExpiresIn` (default `7d`). When a request returns 401, run `mikro auth:logout` followed by `mikro auth:login`.
- The dev seed creates an admin user at `+1000000001` with password `password123`.
- Most endpoints currently accept any authenticated user for backwards compatibility. Admin-only enforcement (`adminProcedure`) is wired up in the server and will be applied per-route in a follow-up.

TODO:

- Create a guardrail to prevent more payments than the loan amount
- Create a guardrail to enforce payment amount for the loan frequency
- Add a feature to allow partial payments for some loans
- Tighten per-route authorization (apply `adminProcedure` to user management, collections runs, and other sensitive operations)
