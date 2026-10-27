# Mikro Créditos

This is the main repository for the Mikro project. It is a monorepo that contains all the modules for the Mikro project.

Build a linux compatible docker image (tagged as both `latest` and the version from `package.json`):

```bash
docker build --platform linux/amd64 -t ghcr.io/psanders/mikro:latest -t ghcr.io/psanders/mikro:$(node -p "require('./package.json').version") -f mods/apiserver/Dockerfile --push .
```

Run with either tag:

```bash
docker run -p 3000:3000 ghcr.io/psanders/mikro:latest
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

- Policy defaults live under `loans` in `mikro.json` (see `mikro.example.json`):
  `defaultMoraRate`, `moraGraceDays`, `moraCapInCuotas`, `moraMinDop`,
  `moraStopOnDefault`, `moraEffectiveFrom`.
- `moraGraceDays` is a waiver window, not a deductible: at or below it no mora accrues and
  the loan tags as `status:pre_mora`; once passed, mora bills **every** elapsed day, grace
  days included. It is global — there is no per-loan grace. Default `0` (mora from day one).
- Optional per-loan override: `moraRate` on the loan.
- API: `previewLateFee` (read-only) and `createPayment` (returns `{ installment, lateFee }`).
- Mora preview and the auto-split **net out** already-collected (non-reversed) `LATE_FEE`
  payments for the current missed-cycle window, so a top-up after a partial cuota is not
  billed for mora twice.
- CLI:
  - `mikro loans:previewMora --loan-id 10001 [--as-of 2026-05-20]` — cuota, mora bruta,
    mora ya cobrada, mora neta, and suggested total without creating a payment.
  - `mikro payments:create` shows the same mora breakdown and supports `--late-fee-override`
    (DOP waived from accrued mora before split).
- Cash-total report metrics (`totalCollectedDop` in the portfolio report and `totalPaid` /
  `moraCollected` in the at-risk report) include non-reversed `PARTIAL` rows, so completing a
  cuota with a follow-up payment does **not** require reversing the earlier partial row.
- Optional cleanup: to consolidate into one payment row, run
  `mikro payments:reverse <partialPaymentId>` (the linked `LATE_FEE` is reversed automatically),
  then `mikro payments:create` for the full combined amount.
- Mora is **not** auto-posted to the accounting ledger; deposits are still
  recorded manually in the accounting module when appropriate.

## Loan pricing

Loan quotes (`mikro loans:calculate`, the founder copilot and the `calculateLoan` API)
follow one price curve by loan length in weeks. The rate is the **total interest as a
share of the principal over the whole loan**, not an annual rate.

- `referenceRate` applies to a loan of `referenceWeeks` weeks; each week longer adds
  `adjustmentPerWeek`, each week shorter subtracts it; the result is clamped to
  `minRate`–`maxRate`.
- Loan length in weeks: weekly = 1 week per payment, daily = 1/7, biweekly = 2,
  monthly = 52/12. This is used for pricing only; due dates are unchanged.
- The base duration only centers the list of options and does not change the price.

| Key                 | Default | Meaning                                                      |
| :------------------ | :------ | :----------------------------------------------------------- |
| `referenceRate`     | `0.30`  | Total interest (decimal, 0.30 = 30%) at `referenceWeeks`     |
| `referenceWeeks`    | `10`    | Loan length in weeks where `referenceRate` applies           |
| `adjustmentPerWeek` | `0.015` | Added per week longer, subtracted per week shorter (1.5 pts) |
| `minRate`           | `0.10`  | Lowest total interest any quote can have                     |
| `maxRate`           | `0.60`  | Highest total interest any quote can have                    |

```json
"loans": {
  "pricing": {
    "referenceRate": 0.30,
    "referenceWeeks": 10,
    "adjustmentPerWeek": 0.015,
    "minRate": 0.10,
    "maxRate": 0.60
  }
}
```

The section is optional; leave it out to use the defaults. An unknown key, a value out of
range, or `minRate ≤ referenceRate ≤ maxRate` not holding stops the server at boot.

Example, RD$10,000 paid weekly with the defaults:

| Weeks | Rate  | Total (RD$) | Payment/week (RD$) |
| :---- | :---- | :---------- | :----------------- |
| 7     | 25.5% | 12,550      | 1,800              |
| 8     | 27.0% | 12,700      | 1,600              |
| 9     | 28.5% | 12,850      | 1,450              |
| 10    | 30.0% | 13,000      | 1,300              |
| 11    | 31.5% | 13,150      | 1,200              |
| 12    | 33.0% | 13,300      | 1,150              |
| 13    | 34.5% | 13,450      | 1,050              |

Add `loans.pricing` to the production `mikro.json` only after the release that reads it is
live.

The mikro.do simulator does not read this setting; it uses `site/src/lib/simulatorConfig.ts`.
Changing `loans.pricing` makes Ops quotes differ from the public website until the site is
updated.

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
mikro accounting:transactions:get <transactionId> # with --save-attachments ./out
mikro accounting:transactions:reverse             # creates mirror + flags original
```

Receipt attachments (PNG, JPG, PDF, max 10 MB) are stored server-side under
`accounting.attachmentsPath`.

## Rejection SMS

When a reviewer or admin rejects an application (dashboard, `mikro applications:reject`
or the copilot), the applicant gets an SMS through Twilio. The automatic out-of-area
rejection at intake and every other status change (e.g. abandoned) send nothing.
Applicants with no phone on file are skipped. Configure it in `mikro.json`; nothing
is sent unless all four fields are set:

```json
"twilio": {
  "accountSid": "ACxxxxxxxx",
  "authToken": "your-auth-token",
  "from": "+18095550000",
  "rejectionMessage": "Gracias por tu interés en Mikro. En este momento no podemos aprobar tu solicitud."
}
```

`from` is a Twilio number or a Messaging Service SID (`MG…`). The message is sent as-is.

## Install the CLI (`mikro`)

To use `mikro` from anywhere on your machine, build and link `@mikro/ctl`:

```bash
npm install
npm run build -w @mikro/ctl
npm link -w @mikro/ctl
mikro --help
```

The link is a symlink to this repo, so just rebuild after code changes. If `mikro` isn't found,
add `$(npm prefix -g)/bin` to your `PATH`. Undo with `npm unlink -g @mikro/ctl`.

## Authentication

The API only accepts per-user Bearer JWTs. There is no shared credential.

- Log in with `mikro auth:login` and provide the phone (E.164, e.g. `+18091234567`) and password of an existing user. The CLI stores the returned JWT under `~/.mikro/config.json` and sends it as `Authorization: Bearer <token>` on every request.
- Tokens expire after `jwtExpiresIn` (default `30d`). When a request returns 401, run `mikro auth:logout` followed by `mikro auth:login`.
- The dev seed creates an admin user at `+18095551234` with password `password123`. See the [seed script](./mods/apiserver/prisma/seed.ts) for more details.
- Most endpoints currently accept any authenticated user for backwards compatibility. Admin-only enforcement (`adminProcedure`) is wired up in the server and will be applied per-route in a follow-up.

TODO:

- Create a guardrail to prevent more payments than the loan amount
- Create a guardrail to enforce payment amount for the loan frequency
- Add a feature to allow partial payments for some loans
- Tighten per-route authorization (apply `adminProcedure` to user management, collections runs, and other sensitive operations)
