## ADDED Requirements

### Requirement: Feature is presented as generic "Feedback"

The in-app feedback feature SHALL be presented to users as "Feedback" — a single, generic
channel for any kind of input (a bug, a confusing screen, or a feature idea) — not as a
bug-specific report. It SHALL NOT ask the user to categorize their submission.

#### Scenario: Entry point copy

- **WHEN** a user encounters the feedback entry point on any platform (desktop nav rail or
  mobile profile row)
- **THEN** it is labeled "Feedback" / "Enviar feedback" (not "Reportar un problema"), and the
  consent copy frames the recording as showing "lo que quieres compartir — un problema, algo
  confuso o una idea", with no bug-specific wording

#### Scenario: No category selection

- **WHEN** a user starts a feedback submission
- **THEN** the flow proceeds directly to consent → record → send, with no step that asks the
  user to pick a type or category

### Requirement: Feedback submission API

The client SHALL submit feedback through a `submitFeedback` operation (replacing the former
`submitBugReport`), and the server SHALL file the submission as a generic feedback item.

#### Scenario: Submitting feedback

- **WHEN** a client finishes a feedback recording and sends it
- **THEN** it calls `submitFeedback` with the same payload shape used previously
  (video/audio + page/context metadata), and the server creates a tracking item for the team

#### Scenario: Generic issue filing, not bug-labeled

- **WHEN** the server processes a `submitFeedback` submission and files it as a GitHub issue
- **THEN** the issue is framed as generic feedback (title/body) and is NOT forced to carry a
  "bug" label, so the team can triage its type afterward

### Requirement: Desktop feedback icon and nav-rail tooltips

The dashboard founder nav rail SHALL use a square message icon for the feedback entry, and
every nav-rail icon SHALL expose its label as a styled hover tooltip.

#### Scenario: Feedback icon

- **WHEN** the founder nav rail renders
- **THEN** the feedback entry uses a square message icon (`MessageSquare`), not a bug icon

#### Scenario: Hover tooltip on any rail icon

- **WHEN** a user hovers (or keyboard-focuses) any nav-rail icon
- **THEN** a styled tooltip shows that icon's label (e.g. "Enviar feedback" for the feedback
  icon), replacing the browser's native `title` tooltip, while the accessible label remains
  available to assistive tech regardless of pointer type
