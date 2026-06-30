## ADDED Requirements

### Requirement: Customers carry hybrid tags with an explicit source

The system SHALL store tags on a customer, each tagged with a `source` of `AUTO` or `MANUAL`.
`AUTO` tags are owned by the tag engine and MAY be added or removed by it on any recompute.
`MANUAL` tags are owned by humans; the tag engine SHALL NOT create, modify, or delete a `MANUAL`
tag, and SHALL NOT use `MANUAL` tags to decide which `AUTO` tags to derive. A given tag
string SHALL exist at most once per customer.

#### Scenario: Engine recompute leaves manual tags untouched

- **WHEN** the tag engine recomputes a customer that has a `MANUAL` `risk:premium` tag
- **THEN** `risk:premium` remains on the customer after the recompute
- **AND** only `AUTO` tags (`status:` / `dpd:`) are added or removed

#### Scenario: Duplicate tag is idempotent

- **WHEN** a tag that already exists on a customer is set again
- **THEN** the customer still has exactly one instance of that tag

### Requirement: AUTO lifecycle status is derived from loan state using the worst loan

For each customer the system SHALL derive exactly one `status:` tag from the customer's loans,
taking the most severe loan's state. The statuses are `status:new`, `status:current`,
`status:pre_mora`, `status:past_due`, `status:defaulted`, `status:written_off`, and
`status:completed`. `status:defaulted` SHALL be set when, and only when, a loan's
`Loan.status === DEFAULTED` (ops-controlled); the engine SHALL NOT infer default from days past due.
`status:pre_mora` SHALL be set when a loan is past its due date but still inside the mora grace
window (no mora accruing yet).

#### Scenario: Worst loan drives status

- **WHEN** a customer has one `current` loan and one loan 40 days past due
- **THEN** the customer's `status:` tag reflects the past-due loan, not the current one

#### Scenario: Ops default is trusted

- **WHEN** a loan has `Loan.status === DEFAULTED`
- **THEN** the customer is tagged `status:defaulted`
- **AND** no `dpd:` bucket tag is derived from that loan

#### Scenario: DPD alone does not create default

- **WHEN** a loan is 120 days past due but its `Loan.status` is not `DEFAULTED`
- **THEN** the customer is tagged `status:past_due` (with a `dpd:` bucket), not `status:defaulted`

#### Scenario: Inside grace window

- **WHEN** a loan is past its due date but within the configured mora grace days
- **THEN** the customer is tagged `status:pre_mora`

### Requirement: AUTO delinquency bucket is derived from days past due

When a customer's worst loan is delinquent (mora accruing), the system SHALL derive exactly one
`dpd:` aging-bucket tag from the worst loan's days past due, measured in calendar days:
`dpd:1_7` (1–7), `dpd:8_30` (8–30), `dpd:31_60` (31–60), `dpd:61_90` (61–90), `dpd:91_180` (91–180),
`dpd:180_plus` (180+). A `dpd:` tag SHALL be present only when the customer is `status:past_due`
(or `status:written_off`); it SHALL NOT be present for `current`, `pre_mora`, `defaulted`, `new`, or
`completed` customers.

#### Scenario: Bucket boundary

- **WHEN** the worst loan is exactly 8 days past due
- **THEN** the customer carries `dpd:8_30`

#### Scenario: No bucket when not past due

- **WHEN** the customer's worst loan is current
- **THEN** the customer has no `dpd:` tag

### Requirement: Payments recompute tags immediately

When a payment is recorded, the system SHALL recompute the affected customer's `AUTO` tags as part
of the payment side effects, so that a payment which brings every loan current results in
`status:current` and the removal of any `dpd:` and past-due tags without waiting for the scheduled
recompute.

#### Scenario: Full payment cures the account

- **WHEN** a `past_due` customer makes a payment that brings all their loans current
- **THEN** the customer's `status:` becomes `status:current`
- **AND** the previous `dpd:` tag is removed

### Requirement: Manual tags are managed through the API and CLI only

The system SHALL expose setting and clearing of `MANUAL` (`risk:`) tags through a protected tRPC
mutation and a `mikro` CLI command. There SHALL be no dashboard UI for tags in this version.
Setting a `MANUAL` tag SHALL record `source = MANUAL`; the tag engine SHALL never overwrite it.

#### Scenario: Operator sets a manual tag via CLI

- **WHEN** an operator runs the CLI command to add `risk:do_not_contact` to a customer
- **THEN** the customer carries `risk:do_not_contact` with `source = MANUAL`
- **AND** subsequent engine recomputes do not remove it

#### Scenario: Operator clears a manual tag via API

- **WHEN** an operator calls the mutation to remove `risk:premium` from a customer
- **THEN** the tag is removed and the change is reflected on the next sync
