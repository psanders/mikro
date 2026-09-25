## ADDED Requirements

### Requirement: One guarded transition table decides every review action

`@mikro/common` SHALL export a pure `evaluateTransition(app, action, actor, input?, ctx?)` that returns either the target status or a typed block reason (`WRONG_STATUS`, `NOT_ALLOWED`, `NOT_ASSIGNEE`, `EVIDENCE_INCOMPLETE`, `RECOMMENDATION_REQUIRED`, `NOTE_REQUIRED`, `REASON_REQUIRED`, `TERMS_REQUIRED`, `CONTRACT_REQUIRED`). The actions are `promote`, `assign`, `sendToDecision`, `returnToReviewer`, `approve`, `reject`, `withdraw` and `convert`. Every review mutation on the server SHALL authorize through it, mapping role/assignee blocks to FORBIDDEN and status/requirement blocks to CONFLICT. The UI SHALL use the same function to decide which actions are enabled and to explain disabled ones.

#### Scenario: Server and UI agree

- **WHEN** `evaluateTransition` blocks an action with `EVIDENCE_INCOMPLETE`
- **THEN** the server rejects that mutation with CONFLICT and the UI shows the action disabled with the evidence reason

#### Scenario: Every status is covered

- **WHEN** a new `ApplicationStatus` value is added without transition expectations
- **THEN** the transition table test fails

### Requirement: Applications are assigned to a reviewer

A reviewer (REVIEWER or ADMIN) SHALL be able to assign a `RECEIVED` application to themselves, moving it to `IN_REVIEW` and recording `assignedReviewerId`/`assignedAt`. An admin SHALL be able to assign a `RECEIVED` application to any user holding REVIEWER or ADMIN, and to reassign an `IN_REVIEW` application to another such user (status unchanged). A non-admin SHALL NOT assign to others or reassign.

#### Scenario: Reviewer takes from the queue

- **WHEN** a reviewer assigns a `RECEIVED` application to themselves
- **THEN** its status becomes `IN_REVIEW` and `assignedReviewerId` is the caller

#### Scenario: Second taker loses the race

- **WHEN** two reviewers assign the same `RECEIVED` application and the first succeeded
- **THEN** the second request fails with CONFLICT and the assignee is unchanged

#### Scenario: Admin reassigns

- **WHEN** an admin reassigns an `IN_REVIEW` application to another reviewer
- **THEN** `assignedReviewerId` changes and the status stays `IN_REVIEW`

#### Scenario: Reviewer cannot reassign

- **WHEN** a REVIEWER-only user assigns an application to someone else
- **THEN** the request is rejected as forbidden

### Requirement: Assigned reviewer sends a complete application to decision

The assigned reviewer SHALL be able to move an `IN_REVIEW` application to `PENDING_DECISION`, only when its evidence is complete (see `application-evidence`) and a non-empty `reviewerRecommendation` is stored. The transition SHALL record `sentToDecisionAt`.

#### Scenario: Complete application is sent

- **WHEN** the assignee sends an application with both ID images, the minimum business photos, and a recommendation
- **THEN** its status becomes `PENDING_DECISION`

#### Scenario: Missing evidence blocks sending

- **WHEN** the assignee sends an application missing the ID back image
- **THEN** the request fails with CONFLICT and reason `EVIDENCE_INCOMPLETE`

#### Scenario: Only the assignee sends

- **WHEN** a reviewer who is not the assignee sends the application
- **THEN** the request is rejected as forbidden

### Requirement: Admin decides a pending application

Only an ADMIN SHALL act on a `PENDING_DECISION` application:

- **approve** with required `approvedAmount` and `approvedTermWeeks` (and optional note) → `APPROVED`
- **return to reviewer** with a required note → `IN_REVIEW` (assignee unchanged)
- **reject** with a required reason → `REJECTED`

Each SHALL record `decidedById`, `decidedAt` and `decisionNote`.

#### Scenario: Approve with adjusted terms

- **WHEN** an admin approves a pending application with `approvedAmount` 10000 and `approvedTermWeeks` 10
- **THEN** its status becomes `APPROVED` and those terms are stored

#### Scenario: Return requires a note

- **WHEN** an admin returns a pending application without a note
- **THEN** the request fails validation

#### Scenario: Reviewer cannot decide

- **WHEN** a REVIEWER-only user approves a pending application
- **THEN** the request is rejected as forbidden

### Requirement: Rejection carries a reason from a fixed list

Rejections SHALL store `rejectionReason` ∈ {`OUT_OF_COVERAGE_AREA`, `PAYMENT_CAPACITY`, `DOCUMENTS`, `OTHER`}, with `decisionNote` required when the reason is `OTHER`. The assignee MAY reject from `IN_REVIEW`; an admin MAY reject from `PENDING_DECISION`. `OUT_OF_COVERAGE_AREA` is also set by the system at intake.

#### Scenario: Reviewer rejects during review

- **WHEN** the assignee rejects an `IN_REVIEW` application with reason `PAYMENT_CAPACITY`
- **THEN** its status becomes `REJECTED` with that reason

#### Scenario: OTHER needs a note

- **WHEN** a rejection uses `OTHER` with no note
- **THEN** the request fails with reason `NOTE_REQUIRED`

### Requirement: An approved application can be withdrawn

The assignee or an admin SHALL be able to mark an `APPROVED` application as withdrawn (the customer backed out), moving it to `ABANDONED`.

#### Scenario: Customer backs out after approval

- **WHEN** the assignee withdraws an `APPROVED` application
- **THEN** its status becomes `ABANDONED` and it can no longer be converted

## MODIFIED Requirements

### Requirement: Review actions are restricted to reviewers

The review mutations SHALL be restricted to callers whose roles include `ADMIN` or `REVIEWER`, and further narrowed per action by the transition table: decisions on `PENDING_DECISION` are ADMIN-only, and evidence/data changes, `sendToDecision` and reviewer rejection are limited to the assigned reviewer.

#### Scenario: Non-reviewer is forbidden

- **WHEN** an authenticated user without `ADMIN` or `REVIEWER` (e.g. only `COLLECTOR`) invokes any review mutation
- **THEN** the request is rejected as forbidden

#### Scenario: Unauthenticated is rejected

- **WHEN** an unauthenticated caller invokes any review mutation
- **THEN** the request is rejected as unauthorized

#### Scenario: Reviewer outside their assignment is forbidden

- **WHEN** a REVIEWER invokes `sendToDecision` on an application assigned to someone else
- **THEN** the request is rejected as forbidden

## REMOVED Requirements

### Requirement: Reviewer claims an application for review

**Reason**: Replaced by "Applications are assigned to a reviewer", which also covers admin assignment and reassignment.
**Migration**: `claimApplication` becomes `assignApplication`; `reviewedById` on IN_REVIEW rows migrates to `assignedReviewerId`.

### Requirement: Reviewer approves an application

**Reason**: Approval moves to an admin decision on `PENDING_DECISION` with approved terms.
**Migration**: Reviewers send to decision; admins approve via "Admin decides a pending application".

### Requirement: Reviewer rejects an application with a reason

**Reason**: Replaced by "Rejection carries a reason from a fixed list" (structured reason, role-specific source statuses).
**Migration**: Existing free-text reasons migrate to `rejectionReason = OTHER` with the text in `decisionNote`.

### Requirement: Reviewer reopens a decided application

**Reason**: Decisions are final; corrections before a decision use "return to reviewer", and a backed-out approval uses withdraw.
**Migration**: None; no reopen procedure remains.
