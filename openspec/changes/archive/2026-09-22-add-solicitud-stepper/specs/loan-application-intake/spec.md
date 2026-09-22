## ADDED Requirements

### Requirement: Final website submissions outside the covered area are auto-rejected

The apiserver SHALL read a required `applications.coveredProvinces` list (province enum values) from `mikro.json` and refuse to boot without it. When `POST /v1/applications` receives a final submission (`partial: false`) whose `province` is set and not in that list, the system SHALL persist the application with status `REJECTED` and `reviewNote` `OUT_OF_COVERAGE_AREA`, SHALL NOT schedule follow-up jobs, SHALL NOT send the Meta Conversions API `Lead` event, and SHALL respond `{ "result": "ok", "outcome": "out_of_area" }`.

#### Scenario: Out-of-area final submission is rejected

- **WHEN** a payload with `partial: false` and `province: "SANTIAGO"` is posted and `coveredProvinces` is `["PUERTO_PLATA"]`
- **THEN** the `LoanApplication` for that `sessionId` has status `REJECTED` and `reviewNote` `OUT_OF_COVERAGE_AREA`
- **AND** no follow-up job is scheduled
- **AND** no Meta CAPI Lead is sent
- **AND** the response body is `{ "result": "ok", "outcome": "out_of_area" }`

#### Scenario: In-area final submission is unchanged

- **WHEN** a payload with `partial: false` and `province: "PUERTO_PLATA"` is posted
- **THEN** the application is stored as `RECEIVED`, a follow-up job is scheduled, a CAPI Lead is sent
- **AND** the response body is `{ "result": "ok" }`

#### Scenario: Partial autosaves never reject

- **WHEN** a payload with `partial: true` and an out-of-area province is posted
- **THEN** the application is stored as `DRAFT`

#### Scenario: Missing config fails boot

- **WHEN** `mikro.json` has no `applications.coveredProvinces`
- **THEN** config validation fails and the apiserver does not start

#### Scenario: WhatsApp intake is unaffected

- **WHEN** an application arrives through the WhatsApp agent or WhatsApp Flow
- **THEN** coverage is not enforced by this requirement
