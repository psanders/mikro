## ADDED Requirements

### Requirement: createApplication can send the promo on save

The `createApplication` mutation SHALL accept an optional `sendPromo` boolean (default false). When `sendPromo` is true and the created application has a phone, the mutation SHALL send the approved promo template to that phone after the application is created, and SHALL include the promo outcome in its response. When `sendPromo` is false or no phone is present, the mutation SHALL behave exactly as today and send nothing.

#### Scenario: sendPromo true with a phone

- **WHEN** `createApplication` is called with `sendPromo: true` and the normalized application has a phone
- **THEN** the application is created as usual
- **AND** the promo template is sent once to that phone
- **AND** the response includes the application and a promo result with the WhatsApp message id

#### Scenario: sendPromo true without a phone

- **WHEN** `createApplication` is called with `sendPromo: true` but the normalized phone is null
- **THEN** the application is created
- **AND** no message is sent
- **AND** the response indicates the promo was not sent

#### Scenario: sendPromo omitted is unchanged

- **WHEN** `createApplication` is called without `sendPromo`
- **THEN** the application is created exactly as before and no message is sent

#### Scenario: Promo send failure does not block creation

- **WHEN** `sendPromo: true` and the WhatsApp send errors
- **THEN** the application remains created
- **AND** the response reports the promo send error
