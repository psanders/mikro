## MODIFIED Requirements

### Requirement: Admin decides a pending application

Only an ADMIN SHALL act on a `PENDING_DECISION` application:

- **approve** with required `approvedAmount` and `approvedTermWeeks` (and optional note) → `APPROVED`
- **return to reviewer** with a required note → `IN_REVIEW` (assignee unchanged)
- **reject** with a required reason → `REJECTED`

Each SHALL record `decidedById`, `decidedAt` and `decisionNote`.

**approve** SHALL fail with `CREDIT_POLICY_BLOCKED` only when the application's latest `CreditDecision` is `REJECT`. There is no override. `REVIEW` and `APPROVE` do not block, and neither do lookups that weren't done: the admin may approve with the information in hand. The approved and rejected events SHALL carry `creditDecisionId`, `creditOutcome` and `policyVersion`.

#### Scenario: Approve with adjusted terms

- **WHEN** an admin approves a pending application whose latest credit decision is `APPROVE`, with `approvedAmount` 10000 and `approvedTermWeeks` 10
- **THEN** its status becomes `APPROVED`, and those terms are stored

#### Scenario: Hard NO blocks approval

- **WHEN** an admin approves a pending application whose latest credit decision is `REJECT`
- **THEN** the request fails with `CREDIT_POLICY_BLOCKED`, and the status stays `PENDING_DECISION`

#### Scenario: Approve without bureau lookups

- **WHEN** an admin approves a pending application whose decision is `APPROVE` with Equifax and PrestamosCloud unchecked
- **THEN** its status becomes `APPROVED`

#### Scenario: Review is advisory

- **WHEN** an admin approves a pending application whose latest credit decision is `REVIEW`
- **THEN** its status becomes `APPROVED`

#### Scenario: Return requires a note

- **WHEN** an admin returns a pending application without a note
- **THEN** the request fails validation

#### Scenario: Reviewer cannot decide

- **WHEN** a REVIEWER-only user approves a pending application
- **THEN** the request is rejected as forbidden

### Requirement: Rejection carries a reason from a fixed list

Rejections SHALL store `rejectionReason` ∈ {`OUT_OF_COVERAGE_AREA`, `PAYMENT_CAPACITY`, `DOCUMENTS`, `CREDIT_POLICY`, `OTHER`}, with `decisionNote` required when the reason is `OTHER`. The assignee MAY reject from `IN_REVIEW`; an admin MAY reject from `PENDING_DECISION`. `OUT_OF_COVERAGE_AREA` is also set by the system at intake.

`CREDIT_POLICY` SHALL be accepted only when the application's latest credit decision is `REJECT` because of a policy rule, and it follows the same who-and-when rules as every other reason. No note is required, and the decision's reason codes are stored with the rejection.

#### Scenario: Reviewer rejects during review

- **WHEN** the assignee rejects an `IN_REVIEW` application with reason `PAYMENT_CAPACITY`
- **THEN** its status becomes `REJECTED` with that reason

#### Scenario: OTHER needs a note

- **WHEN** a rejection uses `OTHER` with no note
- **THEN** the request fails with reason `NOTE_REQUIRED`

#### Scenario: Hard NO rejected without a note

- **WHEN** the assignee rejects an `IN_REVIEW` application with `CREDIT_POLICY`, and its latest decision is `REJECT` with reasons `PCLOUD_DELINQUENT` and `PCLOUD_UNCOLLECTIBLE`
- **THEN** its status becomes `REJECTED` with reason `CREDIT_POLICY`, and those codes are stored

#### Scenario: CREDIT_POLICY without a hard NO

- **WHEN** a rejection uses `CREDIT_POLICY` and the latest decision is `REVIEW`
- **THEN** the request fails with `CREDIT_POLICY_NOT_REJECTED`
