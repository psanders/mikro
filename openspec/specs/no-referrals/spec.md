# no-referrals Specification

## Purpose

Mikro dropped referrals as a business concept in 2026-06 (`remove-referrals`): no referrer role, no `Customer.referredById`, no referrer-scoped reports or queries, and no "who referred you?" step in onboarding. This spec asserts that end state stays gone — a negative/absence spec, not a feature to build.

## Requirements

### Requirement: No referrer role

The `Role` enum SHALL NOT include `REFERRER`, and the authenticated context SHALL NOT accept it as a valid role.

#### Scenario: Referrer role is gone

- **WHEN** the system enumerates assignable roles
- **THEN** `REFERRER` is not among them

### Requirement: Customers have no referrer

The `Customer` model SHALL NOT have a `referredById` field, and customer create/update SHALL NOT accept a referrer.

#### Scenario: Create customer without referrer

- **WHEN** a customer is created
- **THEN** no referrer is required or recorded

#### Scenario: Conversion takes no referrer

- **WHEN** an application is converted into a customer + loan
- **THEN** the conversion input does not include a referrer

### Requirement: No referrer-scoped queries

The system SHALL NOT expose `listCustomersByReferrer`, `listLoansByReferrer`, `listPaymentsByReferrer`, or `exportCustomersByReferrer` (API procedures or CLI commands).

#### Scenario: Referrer procedures removed

- **WHEN** a client inspects the available procedures/commands
- **THEN** none of the referrer-scoped ones are present

### Requirement: Onboarding does not ask for a referrer

The WhatsApp onboarding flow SHALL NOT ask who referred the applicant nor assign a referrer when creating the customer.

#### Scenario: Onboarding skips the referrer step

- **WHEN** a prospect completes the agent onboarding
- **THEN** the conversation never asks for a referrer and the created customer has none
