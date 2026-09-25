## ADDED Requirements

### Requirement: Evidence completed by someone other than the assignee is recorded once

When an evidence write makes an application's evidence go from incomplete to complete, and the writer is not the assigned reviewer, the apiserver SHALL record one `application.evidence_completed` event (actor = the writer; payload: `applicationId`, `businessName`, `score`). Individual evidence writes SHALL NOT produce events. If the evidence later becomes incomplete and is completed again, a new event is recorded. The event is visible under the same role scoping as the application's other events.

#### Scenario: A collector completes the evidence

- **WHEN** a collector saves the last missing photo on an application assigned to Ana
- **THEN** one `application.evidence_completed` event with the collector as actor is recorded, and Ana's feed shows it

#### Scenario: The assignee completes it

- **WHEN** Ana herself saves the last missing piece
- **THEN** no event is recorded
