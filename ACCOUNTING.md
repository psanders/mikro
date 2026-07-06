# Accounting at Mikro

This note is a high-level picture of how money is represented in the product:
what lives in the **loan system**, what lives in the **general accounting module**,
and how they fit together. It is not a bookkeeping manual for day-to-day data entry.

## Purpose

Mikro serves microcredit operations. Two complementary views of “money” exist:

1. **Loan servicing** — customer loans, scheduled installments, and payments
   recorded against each loan. This is the source of truth for **who owes what**
   and **what was collected** on a given loan.
2. **General accounting** — **company** cash and bank balances, plus categorized
   operating movements (rent, payroll, fuel, transfers between internal accounts,
   and similar). This is the place to reason about **where cash sits** and **how
   the business spends or earns** outside of (or in aggregate on top of) a single
   loan record.

The two layers are intentionally separate today. A payment on a loan does not
automatically post a ledger transaction; bridging them is a business process
(e.g. recording a deposit when consolidated collection hits the bank).

## Loans

Loans are modeled as **SAN** (fixed periodic payment) contracts: principal,
term length, payment frequency, and a **payment amount** per period until the
obligation is satisfied. Loan status (active, completed, defaulted, cancelled)
and the **Payment** rows tied to each loan describe collection activity over time.

This model answers operational questions: schedule, arrears, collector attribution,
and history. It does **not** split each installment into separate principal and
interest lines in the database; the economics of the deal are captured in the
chosen schedule as a whole.

**Past-due fees (mora):** collected mora is stored as separate `Payment` rows of
kind `LATE_FEE`, optionally created together with an `INSTALLMENT` row for the
same cash-in. These loan payments are **not** bridged automatically into
`AccountingTransaction` or any bank/cash account; teams that want ledger alignment
continue to record deposits and movements in the accounting module by hand (or
via the founder-task automations below).

**Founder-task bridge (`daily-close`):** the scheduled-task system offers a
`daily-close` automation that bridges one calendar day's collected loan
payments into the ledger — one `INCOME` deposit per payment method to a
configured account, idempotent per close date (reference marker
`daily-close:<date>`, a bridged date refuses to post again). It is
confirm-gated: the founder reviews the day's totals on the feed card before
anything posts. Companion automations `pay-collector` and `record-expense`
post confirm-gated `EXPENSE` transactions for collector payments and recurring
operating expenses. All three are code in `mods/apiserver/src/tasks/` — the
scheduler never invents entries an automation didn't define.

## Interest

Interest is part of **how a loan is priced**, not a separate running sub-ledger
inside the loan tables. When structuring a loan, tools and business rules derive
installments from principal, assumed total interest, frequency, and duration so
that the periodic payment reflects the full cost of credit to the borrower.

From an executive standpoint: **interest is embedded in the payment schedule**,
rather than posted as discrete “interest income” entries alongside principal in
the loan record. If the organization needs explicit interest recognition for
reporting, that would be layered on (spreadsheet, export, or future automation)—
it is not the current split in the core loan model.

## Other money movements (general accounting)

The accounting module treats **accounts** (bank, cash, card, or other) as wallets
with balances. **Transactions** move value in a small set of ways:

- **DEPOSIT** / **INCOME** — money in (e.g. bank deposit, fee recognized as income).
- **WITHDRAWAL** / **EXPENSE** — money out (e.g. cash withdrawal, vendor bill).
- **TRANSFER** — from one internal account to another without leaving the firm.

**Reversals** keep an audit trail when a posted entry must be undone.
**Attachments** support evidence such as receipts for operational expenses.

Together, this layer answers: **how much do we hold in each pocket**, and **what
kind of spend or income** does not naturally live on a single loan’s payment line.

## Categories

**Categories** are the chart-of-accounts-style labels for operating **EXPENSE**
and **INCOME** in the general ledger. Each category has a **kind** (`EXPENSE` or
`INCOME`). When a transaction is **EXPENSE** or **INCOME**, you may attach a
category; if you do, its kind must match the transaction type so reports stay
consistent. **DEPOSIT**, **WITHDRAWAL**, and **TRANSFER** do not use that same
kind pairing—they move cash between balances without replacing a labeled
operating line item.

Use categories to roll up spend and revenue for management: facilities, utilities,
fleet, people, professional fees, banking costs, and fee-style income that is not
tied to a single loan payment.

The seeded development database ships with the following **starter categories**
(all in Dominican Pesos context; names reflect typical field-office overhead):

| Category                       | Kind    | Typical use (examples)                                             |
| ------------------------------ | ------- | ------------------------------------------------------------------ |
| Alquiler                       | EXPENSE | Office or storage rent                                             |
| Energía Eléctrica              | EXPENSE | Power bills                                                        |
| Agua                           | EXPENSE | Water utility                                                      |
| Combustible                    | EXPENSE | Fuel for collection routes                                         |
| Mantenimiento de Vehículos     | EXPENSE | Repairs, tires, service                                            |
| Suministros de Oficina         | EXPENSE | Stationery, consumables                                            |
| Salarios                       | EXPENSE | Payroll                                                            |
| Comisiones de Referidos        | EXPENSE | Referrer compensation                                              |
| Honorarios Contables y Legales | EXPENSE | Accounting and legal fees                                          |
| Comisiones Bancarias           | EXPENSE | Bank fees and charges                                              |
| Cargos Administrativos         | INCOME  | Administrative or processing fees charged to borrowers or partners |

You can add more categories as the business grows; the seed list is a sensible
default for a small microcredit operation, not an exhaustive statutory chart.

## Summary

| Concern                                               | Primary home                    |
| ----------------------------------------------------- | ------------------------------- |
| Customer balance and collections                      | Loans and payments              |
| Pricing and total cost of credit                      | Built into SAN payment schedule |
| Firm-wide cash position and operating P&L-style flows | General accounting module       |

The design keeps loan operations fast and focused while still allowing disciplined
tracking of business cash and expenses as the organization scales.
