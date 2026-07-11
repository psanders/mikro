## MODIFIED Requirements

### Requirement: Statement is available from the founder copilot and the CLI with equivalent output

The loan-statement SHALL be exposed as an on-demand founder-copilot direct tool (admin/founder only) and as a CLI command, both invoking the same report definition so that, for the same loan and format, the CLI and the copilot tool produce equivalent output. It SHALL NOT be modeled as a schedulable task automation — statement generation is always an immediate, one-off request, never a recurring one.

#### Scenario: Copilot tool generates a statement

- **WHEN** a founder asks the copilot for a loan's statement and the copilot calls the `generateLoanStatement` tool for that loan id
- **THEN** the statement PDF/JSON is generated and delivered in the same chat turn, with no scheduling step

#### Scenario: CLI produces the same statement

- **WHEN** the CLI loan-statement command runs for the same loan id and format
- **THEN** it produces output equivalent to the copilot tool for that loan and format

#### Scenario: Non-admin invocation is rejected

- **WHEN** an authenticated user without the ADMIN/founder role attempts to generate a loan statement through the copilot
- **THEN** the request is rejected with an authorization error

## REMOVED Requirements

### Requirement: Statement is available from the founder feed and the CLI with equivalent output

**Reason**: Loan statements are always requested on-demand for a single loan — never scheduled or recurring — so modeling delivery as a founder-feed task-automation-catalog action (which exists for scheduling) was a mismatch. The copilot chat loop only exposes the automation catalog through `createTask`, which requires a schedule, so an immediate "give me the statement now" request had no matching tool and the model fell back to unrelated status-summary read tools instead of producing the document.

**Migration**: Replaced by "Statement is available from the founder copilot and the CLI with equivalent output" above. The `loan-statement` entry is removed from the task-automation catalog (`mods/apiserver/src/tasks/catalog.ts`) and its automation module deleted; the underlying `createGenerateLoanStatement` report definition is unchanged and now called directly by a new copilot direct tool instead of by the automation's `execute` function.
