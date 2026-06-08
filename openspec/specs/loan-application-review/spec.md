# loan-application-review Specification

## Purpose

TBD - created by archiving change add-application-review. Update Purpose after archive.

## Requirements

### Requirement: A REVIEWER role exists

The `Role` enum SHALL include a `REVIEWER` value, grantable to a user alongside any other roles. Review actions are permitted for callers whose roles include `ADMIN` or `REVIEWER`.

#### Scenario: Reviewer role is accepted

- **WHEN** a user holding the `REVIEWER` role authenticates
- **THEN** the role is recognized and the user may perform review actions

### Requirement: Reviewer claims an application for review

A reviewer (ADMIN or REVIEWER) SHALL be able to claim a `RECEIVED` application, moving it to `IN_REVIEW` and recording the reviewer.

#### Scenario: Claim moves RECEIVED to IN_REVIEW

- **WHEN** a reviewer claims a `RECEIVED` application
- **THEN** its status becomes `IN_REVIEW` and `reviewedById`/`reviewedAt` are set to the caller and current time

#### Scenario: Claiming a non-RECEIVED application is rejected

- **WHEN** a reviewer claims an application that is not `RECEIVED`
- **THEN** the request fails with an error naming the current and attempted status

### Requirement: Reviewer approves an application

A reviewer SHALL be able to approve an application from `RECEIVED` or `IN_REVIEW`, moving it to `APPROVED`, with an optional note.

#### Scenario: Approve from RECEIVED

- **WHEN** a reviewer approves a `RECEIVED` application
- **THEN** its status becomes `APPROVED` and `reviewedById`/`reviewedAt` (and `reviewNote` if provided) are recorded

#### Scenario: Approve from IN_REVIEW

- **WHEN** a reviewer approves an `IN_REVIEW` application
- **THEN** its status becomes `APPROVED`

#### Scenario: Approving despite an advisory reject flag

- **WHEN** a reviewer approves an application whose score carries `OUT_OF_ZONE` or `CRITICAL_BUSINESS`
- **THEN** the approval succeeds (the score never hard-blocks the human decision)

#### Scenario: Approving a non-reviewable status is rejected

- **WHEN** a reviewer approves an application that is `DRAFT`, `SIGNED`, `CONVERTED`, or `ABANDONED`
- **THEN** the request fails with an error naming the current and attempted status

### Requirement: Reviewer rejects an application with a reason

A reviewer SHALL be able to reject an application from `RECEIVED` or `IN_REVIEW`, moving it to `REJECTED`, with a required non-empty reason.

#### Scenario: Reject records the reason

- **WHEN** a reviewer rejects an application with a reason
- **THEN** its status becomes `REJECTED` and the reason is stored in `reviewNote` with `reviewedById`/`reviewedAt`

#### Scenario: Reject without a reason is rejected

- **WHEN** a reviewer attempts to reject without a non-empty reason
- **THEN** the request fails validation

### Requirement: Reviewer reopens a decided application

A reviewer SHALL be able to reopen an `APPROVED` or `REJECTED` application back to `IN_REVIEW` to undo a decision.

#### Scenario: Reopen an approved application

- **WHEN** a reviewer reopens an `APPROVED` application
- **THEN** its status becomes `IN_REVIEW`

#### Scenario: Reopen a rejected application

- **WHEN** a reviewer reopens a `REJECTED` application
- **THEN** its status becomes `IN_REVIEW`

#### Scenario: Reopening a non-decided application is rejected

- **WHEN** a reviewer reopens an application that is not `APPROVED` or `REJECTED`
- **THEN** the request fails with an error naming the current and attempted status

### Requirement: Review actions are restricted to reviewers

The review mutations SHALL be restricted to callers whose roles include `ADMIN` or `REVIEWER`.

#### Scenario: Non-reviewer is forbidden

- **WHEN** an authenticated user without `ADMIN` or `REVIEWER` (e.g. only `COLLECTOR`) invokes any review mutation
- **THEN** the request is rejected as forbidden

#### Scenario: Unauthenticated is rejected

- **WHEN** an unauthenticated caller invokes any review mutation
- **THEN** the request is rejected as unauthorized
