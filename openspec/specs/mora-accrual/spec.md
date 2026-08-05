# mora-accrual Specification

## Purpose

How past-due fees (mora) accrue on a loan: when a window opens, what it is measured over, and what happens to that window once money has been charged against it. Mora is derived on read from the payment ledger — never stored as an amount — but the accrual start of a charged window IS persisted on its LATE_FEE row, so applying a payment cannot retroactively shorten the window the customer was already charged for. Also fixes what the system guarantees about gross versus collected mora, so an over-collected window surfaces as a failed control instead of being clamped silently to zero.

## Requirements

### Requirement: Mora accrues only while the loan is behind

The system SHALL accrue mora only when the loan has at least one missed cycle.
The accrued amount SHALL be `moraRate × (daysLate / 30) × cuota`, where
`daysLate` is measured in whole calendar days from the accrual start to the
as-of instant. The policy cap (`moraCapInCuotas × cuota`), the policy minimum
(`moraMinDop`) and the grace window (`moraGraceDays`) SHALL be applied to that
amount. When `moraStopOnDefault` is set and the loan is DEFAULTED, the as-of
instant SHALL be clamped to the loan's last update.

#### Scenario: Loan with no missed cycle accrues nothing

- **WHEN** accrued mora is computed for a loan whose payments cover every cycle
  due so far
- **THEN** the accrued mora is zero and no accrual window is opened

#### Scenario: Accrual inside the grace window is zero

- **WHEN** the days late from the accrual start is within `moraGraceDays`
- **THEN** the accrued mora is zero and the result reports that grace was
  applied

#### Scenario: Accrual is capped

- **WHEN** the computed mora exceeds `moraCapInCuotas × cuota`
- **THEN** the gross mora is the cap and the result reports that the cap was
  applied

### Requirement: A charged mora window is anchored at charge time

When the system records a LATE_FEE payment, it SHALL persist the accrual start
that the charge was computed from. Gross mora for a window SHALL be measured
from the earliest accrual start persisted on the non-reversed LATE_FEE rows
inside that window, so that applying a payment cannot retroactively shorten a
window that mora was already charged against.

#### Scenario: Payment does not shrink the window it paid mora into

- **WHEN** a payment carries mora computed from an accrual start, and the same
  payment's installment portion covers enough to move the loan's oldest missed
  due date forward
- **THEN** gross mora for that window is still measured from the persisted
  accrual start, and the gross mora reported afterwards is not less than the
  mora collected for that window

#### Scenario: Several charges in one window use the earliest anchor

- **WHEN** more than one non-reversed LATE_FEE row falls inside the current
  window, each carrying its own accrual start
- **THEN** gross mora is measured from the earliest of those accrual starts

#### Scenario: Reversed charges release their anchor

- **WHEN** a LATE_FEE row inside the window has been reversed
- **THEN** its accrual start is ignored for anchor selection, matching its
  exclusion from the collected-mora total

### Requirement: Windows with no persisted anchor keep the live due date

The system SHALL fall back to the loan's current oldest missed due date when no
non-reversed LATE_FEE row in the window carries a persisted accrual start.
Historical charges SHALL NOT be reinterpreted or restated.

#### Scenario: Loan whose mora predates anchoring

- **WHEN** accrued mora is computed for a loan whose LATE_FEE rows carry no
  persisted accrual start
- **THEN** gross mora is measured from the current oldest missed due date,
  identical to the behaviour before anchoring existed

#### Scenario: Anchor never predates the policy start

- **WHEN** `moraEffectiveFrom` is configured and is later than the oldest missed
  due date
- **THEN** the accrual start is the policy date, and that is the value persisted
  when a charge is recorded

### Requirement: Net mora owed is gross minus what was already collected

The system SHALL report the mora still owed as the gross mora for the window
minus the non-reversed LATE_FEE money collected inside that window, never below
zero. The gross amount and the collected amount SHALL both be reported
alongside the net so that consumers can detect an over-collected window rather
than only seeing the clamped result.

#### Scenario: Partial mora payment leaves the remainder owed

- **WHEN** mora of 96 has accrued for the window and 24 has been collected
  inside it
- **THEN** the net mora owed is 72, and the result reports gross 96 and
  collected 24

#### Scenario: Over-collected window is visible, not hidden

- **WHEN** the mora collected inside a window exceeds the gross mora for that
  window
- **THEN** the net mora owed is zero and the result still reports the gross and
  collected amounts, so the discrepancy is detectable

### Requirement: Over-collected mora fails a health check

The ledger health check SHALL fail when the mora collected for a window exceeds
the gross mora for that window. This check SHALL be distinct from the invariant
that the reported net equals the clamped difference, so that a clamped
over-collection cannot be reported as a passing control.

#### Scenario: Over-collection is reported as a failed control

- **WHEN** a loan's snapshot shows collected mora greater than gross mora
- **THEN** the health check reports a failure identifying the over-collected
  amount

#### Scenario: Netting invariant still holds independently

- **WHEN** a loan's reported net mora does not equal `max(0, gross − collected)`
- **THEN** the health check reports a failure, independent of whether the window
  is over-collected
