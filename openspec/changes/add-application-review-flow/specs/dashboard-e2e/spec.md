## ADDED Requirements

### Requirement: The founder app has a Playwright end-to-end suite against a real backend

`mods/dashboard` SHALL include a Playwright suite that runs the founder app's web build against a real apiserver on a temporary SQLite database, seeded deterministically (an admin, a reviewer, a second reviewer, a collector, disbursement accounts, and applications in every status). The root script `npm run test:e2e:dashboard` SHALL build, seed, start both servers, run the suite, and tear down.

#### Scenario: One command runs the suite

- **WHEN** a developer runs `npm run test:e2e:dashboard` on a clean checkout (after `npm ci`)
- **THEN** the suite runs headless and exits non-zero on any failure

### Requirement: The suite covers the application journeys

The suite SHALL cover at least:

- the reviewer journey: take from the queue, upload both ID sides and 3 photos, write a recommendation, send to decision
- the admin journey: approve with adjusted terms, and return with a note
- the reviewer completing conversion: upload the contract, disburse from a chosen account, card moves to "Cerradas"
- role scoping: a second reviewer does not see the first reviewer's application
- the Tareas form opening in the side panel

#### Scenario: Full lifecycle through the UI

- **WHEN** the lifecycle spec runs
- **THEN** the application ends `CONVERTED` in the database and appears under "Cerradas" in the reviewer's feed

### Requirement: CI runs the end-to-end suite on relevant pull requests

A GitHub Actions workflow SHALL run the suite on pull requests that touch `mods/dashboard`, `mods/apiserver` or `mods/common`, uploading the Playwright report on failure.

#### Scenario: Regression blocks the PR

- **WHEN** a pull request breaks the reviewer journey
- **THEN** the e2e workflow fails with the Playwright report attached
