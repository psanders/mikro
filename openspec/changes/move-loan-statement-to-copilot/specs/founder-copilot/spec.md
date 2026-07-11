## ADDED Requirements

### Requirement: On-demand loan-statement generation

The copilot tool policy SHALL bind a `generateLoanStatement` direct tool that the model calls when the founder asks for a loan's statement/estado de cuenta as a document (e.g. "dame el estado de cuenta del préstamo 10036", "descárgame el PDF del préstamo de Danny"). The tool SHALL take a loan id and a format (`pdf` | `json`, defaulting to `pdf`), execute inline in the chat loop with no confirmation gate (it is read-only and never mutates the ledger), and call the same `createGenerateLoanStatement` report definition used by the CLI `reports loan-statement` command and the `generateLoanStatement` tRPC mutation, so all three surfaces stay equivalent for the same loan and format. The dock SHALL render the result as a downloadable statement (filename, mime type, and file bytes) delivered in the same chat turn as the assistant's reply — no scheduling step and no pending-action confirm card.

#### Scenario: Asking for a statement generates and delivers it in the same turn

- **WHEN** an admin asks the copilot for the loan statement of an existing loan
- **THEN** the copilot calls `generateLoanStatement` with that loan's id, the reply includes a downloadable statement, and no confirmation step is required before it is available

#### Scenario: Format follows what the founder asked for

- **WHEN** the founder's request names a format (e.g. "en JSON") or names none
- **THEN** the tool is called with that format, defaulting to `pdf` when none is stated

#### Scenario: Unknown loan is rejected without a document

- **WHEN** `generateLoanStatement` is called with a loan id that does not exist
- **THEN** the tool result reports the failure and the copilot tells the founder no such loan was found, producing no document

#### Scenario: Non-admin invocation is rejected

- **WHEN** an authenticated user without the ADMIN/founder role attempts to use the copilot to generate a loan statement
- **THEN** the request is rejected with an authorization error, consistent with the copilot's existing admin-only access control

### Requirement: Statement tool takes priority over status-summary tools

The copilot's system prompt SHALL include a tool-disambiguation note steering the model to call `generateLoanStatement` — not `getLoanHealth` or `getLoanByLoanId` — when the founder is asking for the statement or document itself, reserving those read tools for questions about why a balance, mora, or pending-payment figure looks a certain way.

#### Scenario: Document request is not answered with prose

- **WHEN** the founder's phrasing names the statement/estado de cuenta/PDF as the thing they want
- **THEN** the copilot calls `generateLoanStatement` rather than answering with a text summary derived from `getLoanHealth`/`getLoanByLoanId`

#### Scenario: Status question still uses the read tools

- **WHEN** the founder asks why a loan's balance or mora looks a certain way, without asking for the statement itself
- **THEN** the copilot continues to answer via `getLoanHealth`/`getLoanByLoanId` as before, unaffected by the new tool
