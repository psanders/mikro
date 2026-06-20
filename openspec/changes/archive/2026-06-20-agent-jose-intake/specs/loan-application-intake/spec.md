## ADDED Requirements

### Requirement: WhatsApp is a second intake completion path

The system SHALL allow a partial loan application (created via the website form) to be completed conversationally over WhatsApp by the José agent. The existing website form intake path, upsert-by-sessionId semantics, and `partial` flag behavior are unchanged.

#### Scenario: Partial application transitioned to complete via WhatsApp

- **WHEN** the José agent calls `finalizeApplication` for a prospect's partial application
- **THEN** the application's `partial` flag is set to `false`
- **AND** the application's status transitions as it would for a website form submission with `partial: false`
- **AND** the application appears in the reviewer dashboard with all collected fields visible

#### Scenario: Website form submission and WhatsApp intake do not conflict

- **WHEN** a prospect submits the complete website form (partial: false) after José has started a WhatsApp conversation
- **THEN** the upsert-by-sessionId pipeline processes the form submission normally
- **AND** the application is marked complete regardless of José's in-progress conversation

#### Scenario: Fields collected by José appear as standard intake fields

- **WHEN** the reviewer opens an application completed by José
- **THEN** all fields collected by José appear in the same locations as fields submitted via the website form
- **AND** there is no reviewer-visible distinction between the two intake paths
