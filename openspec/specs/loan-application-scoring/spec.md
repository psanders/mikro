# loan-application-scoring Specification

## Purpose

TBD - created by archiving change add-application-scoring. Update Purpose after archive.

## Requirements

### Requirement: Deterministic scoring engine

The system SHALL provide a pure, deterministic `scoreApplication` function (ported from the Mikro Score model) that computes, from an application's fields, an ISC score (0–100), six weighted category scores, hard flags, a risk band, a recommendation, a confidence, and evaluator notes. Given identical inputs and CONFIG it MUST return identical output. The `OUT_OF_ZONE` determination SHALL compare the application's province to the configured coverage zone using a normalized form (uppercased, accent-stripped, spaces and separators collapsed to `_`) so that the served province is recognized regardless of how it was captured (display value, key, or with stray punctuation).

#### Scenario: Computes a weighted ISC

- **WHEN** an application with complete business fields is scored
- **THEN** the result includes an `isc` 0–100 derived from the six weighted categories (PAYMENT_CAPACITY 30, BUSINESS_TYPE_RISK 20, TRACK_RECORD_FORMALIZATION 20, ROOTEDNESS_STABILITY 15, SUPPORT_NETWORK 10, LOAN_PURPOSE 5)

#### Scenario: Served province is not flagged out-of-zone

- **WHEN** the application's province resolves to the coverage zone in any captured form (e.g. `"Puerto Plata"`, `"Puerto Plata."`, or `"PUERTO_PLATA"`)
- **THEN** the result carries NO `OUT_OF_ZONE` flag and is not rejected for coverage

#### Scenario: Out-of-zone is flagged and rejected

- **WHEN** the application's province, normalized, is not the coverage zone
- **THEN** the result carries an `OUT_OF_ZONE` flag, `risk_band` `OUT_OF_COVERAGE`, and `recommendation` `REJECT_OUT_OF_ZONE`

#### Scenario: Critical business is flagged

- **WHEN** the application's business type maps to the CRITICAL risk level
- **THEN** the result carries a `CRITICAL_BUSINESS` flag and `recommendation` `REJECT_CRITICAL_BUSINESS`

#### Scenario: Incomplete data is flagged

- **WHEN** the application is missing payment-capacity fields (sales, amount, or term)
- **THEN** the result carries an `INCOMPLETE_DATA` flag and `recommendation` `MANUAL_REVIEW`

#### Scenario: Unmapped business type scores MEDIO with a note

- **WHEN** the application's business type is not in the risk map
- **THEN** the business-type category scores at the MEDIO level and an evaluator note flags it for manual classification

### Requirement: Canonical English result shape

The engine SHALL output a machine-readable English result (`ApplicationScore`) matching the documented shape: `isc`, `risk_band`, `recommendation`, `confidence`, `flags[]`, `categories[]`, `indicators{}` (amount_requested, term_weeks, monthly_installment, monthly_sales, net_income, debt_service_ratio), and `evaluator_notes[]`, plus applicant/business context.

#### Scenario: Result uses English enums

- **WHEN** an application is scored
- **THEN** `risk_band`, `recommendation`, `confidence`, and flag codes are the documented English enum values

### Requirement: Scoring runs on every application write

Scoring SHALL run automatically on every application upsert (partial and complete) and persist its result. It is not a manual step and not a pipeline stage.

#### Scenario: Completed submission is scored

- **WHEN** a completed submission is upserted
- **THEN** its `scoreData`, `score`, `riskBand`, `recommendation`, and `scoredAt` are persisted from the engine result

#### Scenario: Partial draft is scored

- **WHEN** a partial submission is upserted
- **THEN** the row is scored and persisted (typically with an `INCOMPLETE_DATA` flag) while its status remains `DRAFT`

#### Scenario: Re-computation overwrites the prior result

- **WHEN** an application is upserted again with changed data
- **THEN** its persisted score is recomputed and overwrites the previous result
