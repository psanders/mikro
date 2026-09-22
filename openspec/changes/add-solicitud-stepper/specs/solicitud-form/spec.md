## ADDED Requirements

### Requirement: Stepper application form at /solicitud

The website SHALL serve the loan application at `/solicitud` as a stepper that shows exactly one of the five sections (Datos personales, Información del negocio, Crédito solicitado, Información familiar, Vivienda) at a time, with the same questions, grouping and section icons as the accordion form, and a visible progress indicator (current step number out of 5, a progress bar, and the step icons).

#### Scenario: One section at a time

- **WHEN** an applicant opens `/solicitud`
- **THEN** only the "Datos personales" fields are shown and the progress reads step 1 of 5

#### Scenario: Required fields gate advancing

- **WHEN** the applicant presses "Siguiente" with a required field of the current step empty
- **THEN** the step does not advance and the missing fields are flagged

#### Scenario: Changing step autosaves

- **WHEN** the applicant advances or goes back a step
- **THEN** a partial autosave is posted with `lastSection` set to the step being left

#### Scenario: Submit on the last step

- **WHEN** the applicant reaches step 5
- **THEN** the buró consent checkbox and "Enviar solicitud" button are shown in place of "Siguiente"

### Requirement: Requested amount is chosen from a fixed list

On both form routes, "Monto solicitado" SHALL be a select limited to RD$5,000, RD$10,000, RD$15,000, RD$20,000, RD$25,000 and RD$30,000, so applicants cannot request more than Mikro lends. The submitted value keeps the thousands-separated form ("15,000") the apiserver already parses.

#### Scenario: Only the lending amounts are offered

- **WHEN** the applicant opens the "Monto solicitado" field
- **THEN** the only choices are RD$5,000 through RD$30,000 in RD$5,000 steps, and free-form entry is not possible

### Requirement: Legacy accordion form at /solicitud-v0

The website SHALL keep the previous accordion form available at `/solicitud-v0`, sharing field definitions, autosave, submission and result screens with the stepper.

#### Scenario: Legacy route renders the accordion

- **WHEN** a visitor opens `/solicitud-v0`
- **THEN** the accordion form with all five sections is shown

### Requirement: Out-of-area result screen

Both form routes SHALL, on a submission response with `outcome: "out_of_area"`, show a screen telling the applicant Mikro is not available in their city yet and to check back in a few months, instead of the success screen, and SHALL NOT fire the browser Meta `Lead` event.

#### Scenario: Out-of-area applicant sees the warning

- **WHEN** the submission response is `{ "result": "ok", "outcome": "out_of_area" }`
- **THEN** the out-of-area screen is shown and no `Lead` pixel event fires

#### Scenario: In-area applicant sees success

- **WHEN** the submission response is `{ "result": "ok" }`
- **THEN** the "Solicitud enviada" screen is shown and the `Lead` pixel event fires with the submission's event id
