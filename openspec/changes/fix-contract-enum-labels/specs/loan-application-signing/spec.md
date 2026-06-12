## ADDED Requirements

### Requirement: Generated contract renders human-readable labels

When the loan-contract PDF is generated for an application, enumerated applicant fields SHALL be rendered as their human-readable Spanish labels, not as raw enum codes. Specifically, the debtor's city/province SHALL be resolved through `PROVINCE_LABELS` and the debtor's occupation (sourced from the applicant's business type) SHALL be resolved through `BUSINESS_TYPE_LABELS`. If a stored value has no matching label, the raw value SHALL be used as a fallback rather than dropped.

#### Scenario: Province renders as a label

- **WHEN** a contract is generated for an application whose `province` is `PUERTO_PLATA`
- **THEN** the contract text shows `Puerto Plata`, not `PUERTO_PLATA`

#### Scenario: Business type renders as the occupation label

- **WHEN** a contract is generated for an application whose `businessType` is `CENTRO_UNAS` and no occupation override is supplied
- **THEN** the contract occupation text shows `Centro de uñas`, not `CENTRO_UNAS`

#### Scenario: Reviewer override takes precedence

- **WHEN** the reviewer supplies an `occupation` override at generation time
- **THEN** the contract uses the override verbatim and does not consult `BUSINESS_TYPE_LABELS`

#### Scenario: Unmapped code falls back to the raw value

- **WHEN** a stored `province` or `businessType` value is not present in its label map
- **THEN** the contract prints the raw stored value rather than an empty or placeholder field
