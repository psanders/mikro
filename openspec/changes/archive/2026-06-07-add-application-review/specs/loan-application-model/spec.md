## ADDED Requirements

### Requirement: LoanApplication records the latest review decision

The `LoanApplication` model SHALL persist review audit columns: `reviewedById` (String, the deciding admin's user id), `reviewedAt` (DateTime), and `reviewNote` (String, the rejection reason or approval/reopen note). These reflect the most recent review action.

#### Scenario: Decision columns set on a review action

- **WHEN** an admin claims, approves, rejects, or reopens an application
- **THEN** `reviewedById` and `reviewedAt` reflect the caller and the time of the action

#### Scenario: Rejection reason persisted

- **WHEN** an application is rejected with a reason
- **THEN** `reviewNote` holds that reason

#### Scenario: Internal read procedures expose the review fields

- **WHEN** an authenticated caller lists or gets applications
- **THEN** the returned rows include `reviewedById`, `reviewedAt`, and `reviewNote`
