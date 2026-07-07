# Collections Spec

> Generated from the check registry (`mods/common/src/eval/checks.ts`). Do not edit by hand — run the spec generator.

Each rule below is an executable check evaluated over a loan snapshot. A loan is healthy when every check passes.

## Consistency rules

Recompute a derived number independently from the raw ledger and compare. These catch plumbing and row-selection bugs.

### Pending payments reconcile with money paid

- **id:** `pending-count`
- **severity:** critical

Cuotas covered must equal floor(total installment money paid / cuota), and pending must equal term minus that. This is the exact invariant the #10034 bug violated: PARTIAL rows were excluded, freezing the count.

### Remaining balance matches obligation minus money paid

- **id:** `balance-consistency`
- **severity:** critical

remainingBalance must equal max(0, term·cuota − total installment paid). The prestamo screen once derived balance from disbursed principal instead, disagreeing with every other screen.

### Reversed and pending rows never count toward cuotas

- **id:** `reversed-and-pending-excluded`
- **severity:** critical

Only COMPLETED and PARTIAL INSTALLMENT rows count. Money paid must exclude REVERSED (undone) and PENDING (unsettled) rows, otherwise reversed payments phantom-advance the loan.

### Payments dated after as-of are not counted

- **id:** `no-future-payments-counted`
- **severity:** warning

Cycle metrics and totals are as-of a date. A payment recorded with a future paidAt must not advance the loan or reduce the balance for an earlier evaluation instant.

## Invariant rules

Pure arithmetic and policy assertions over the derived numbers. These catch engine bugs the engine cannot catch about itself.

### Installments paid plus balance equal the total obligation

- **id:** `money-conservation`
- **severity:** critical

The total repayment obligation is term × cuota. Money paid toward installments plus the remaining balance must equal it (unless the customer overpaid, in which case balance is zero). Independent of the counting engine.

### Cuotas covered stay within [0, term]

- **id:** `cuotas-covered-bounds`
- **severity:** critical

Overpayment must cap coverage at the term, and coverage can never go negative. A loan can never be more than fully paid.

### No mora inside the grace window

- **id:** `mora-grace-respected`
- **severity:** critical

Mora must not accrue while days-late is at or below the grace period. Charging mora during grace is exactly the phantom-mora spiral #10034 suffered.

### Mora never exceeds the cap

- **id:** `mora-cap-respected`
- **severity:** critical

Gross mora is capped at moraCapInCuotas × cuota (the minimum-DOP floor may raise a small positive mora to the floor, so the ceiling is max(cap, floor)).

### Mora only accrues when cycles are missed

- **id:** `mora-only-when-behind`
- **severity:** critical

A customer who is current (zero missed cycles) must owe zero mora. Mora with no missed cycle means the cycle counter and the mora engine disagree.

### Net mora equals gross minus collected, never negative

- **id:** `mora-net-nonneg`
- **severity:** warning

moraAccrued (net owed) must equal max(0, grossMora − collectedMora). A negative or mismatched net means collected LATE_FEE was double-counted or ignored.

### A fully paid loan owes nothing further

- **id:** `fully-paid-has-no-dues`
- **severity:** warning

When cuotas covered reach the term, pending payments and remaining balance must both be zero. A fully paid loan still showing dues is a UI/logic contradiction.
