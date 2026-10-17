## MODIFIED Requirements

### Requirement: Mora accrues only while the loan is behind

The system SHALL accrue mora only when the loan has at least one missed cycle.
The accrued amount SHALL be `moraRate × (daysLate / 30) × cuota`, where
`daysLate` is measured in whole calendar days from the accrual start to the
as-of instant. The policy cap (`moraCapInCuotas × cuota`), the policy minimum
(`moraMinDop`) and the grace window (`moraGraceDays`) SHALL be applied to that
amount. When `moraStopOnDefault` is set and the loan is DEFAULTED, the as-of
instant SHALL be clamped to the loan's last update. When the loan is RENEWED,
the as-of instant SHALL be clamped to the loan's `closedAt`, regardless of
policy.

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

#### Scenario: Renewed loan stops accruing

- **WHEN** accrued mora is computed for a RENEWED loan 30 days after its `closedAt`
- **THEN** the result equals the mora computed as of `closedAt`
