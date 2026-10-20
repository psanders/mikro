## ADDED Requirements

### Requirement: Customer profile panel

Admins and reviewers SHALL be able to open a customer profile in the right-hand side panel from search ("Ver perfil") and from anywhere a customer is linked. The profile SHALL show the customer's data, documents, loans and past applications, and a "Renovar" action on each ACTIVE loan (or "Continuar renovación" when that loan has an open renewal).

#### Scenario: Open from search

- **WHEN** a reviewer clicks "Ver perfil" on a customer search result
- **THEN** the side panel opens on that customer and the copilot does not open

#### Scenario: Continue an open renewal

- **WHEN** an ACTIVE loan already has an open renewal
- **THEN** the loan row offers "Continuar renovación" and opening it shows that renewal

### Requirement: Edit customer data

Admins and reviewers SHALL be able to edit a customer's name, nickname, phone, cédula, home address, collection point, job position, income, business-owner flag, notes, preferred payment day, active flag and assigned collector from the profile. Phone and cédula SHALL be validated and normalized as on creation.

#### Scenario: Edit succeeds

- **WHEN** a reviewer changes the home address and saves
- **THEN** the customer is updated and the profile shows the new address

#### Scenario: Invalid cédula

- **WHEN** a malformed cédula is saved
- **THEN** the save is rejected with a validation message

### Requirement: Customer documents

The profile SHALL list the customer's documents with thumbnails or file icons, open them, and let admins and reviewers upload new ones (image or PDF, with a type). Only admins SHALL delete documents.

#### Scenario: Upload a document

- **WHEN** a reviewer uploads a cédula image in the profile
- **THEN** it appears in the document list and is stored as a customer document

#### Scenario: Reviewer cannot delete

- **WHEN** a reviewer opens the document list
- **THEN** no delete action is offered, and the delete procedure rejects them
