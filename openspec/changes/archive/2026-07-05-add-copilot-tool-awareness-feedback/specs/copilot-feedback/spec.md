## ADDED Requirements

### Requirement: `githubFeedback` tool files structured feedback mid-conversation

The copilot tool policy SHALL bind a `githubFeedback` direct tool the model can call during a conversation to file a GitHub issue for a bug, a missing capability, or a UI/UX suggestion it notices, without requiring founder confirmation. The tool SHALL require a `category` (`bug` | `missing_capability` | `ui_suggestion` | `other`), a `title`, a `summary`, and a `reasoning` field explaining why the gap or idea matters — not merely that something happened. When called in the same turn as a failed or limited tool call, the loop SHALL attach that call's tool name, arguments, and failure reason to the filed issue automatically.

#### Scenario: Copilot files feedback for a detected gap

- **WHEN** the model recognizes, in the course of answering a question, that no bound tool can satisfy the request (a capability gap) and calls `githubFeedback` with `category: "missing_capability"` and a `reasoning` explaining the gap
- **THEN** a GitHub issue is filed carrying the title, summary, reasoning, and the triggering tool's name/arguments/failure reason

#### Scenario: Copilot files a UI/UX suggestion

- **WHEN** the model calls `githubFeedback` with `category: "ui_suggestion"` describing a dashboard card that would help, or an existing one that's confusing or unused
- **THEN** a GitHub issue is filed with that suggestion, without requiring a dashboard-card subsystem to exist

#### Scenario: Missing reasoning is rejected

- **WHEN** the model calls `githubFeedback` without a `reasoning` value
- **THEN** the tool call is rejected/invalid and no issue is filed

### Requirement: Feedback filing executes inline and discloses itself

`githubFeedback` SHALL execute inline within the copilot tool loop (no pending-action confirmation step), reusing the same GitHub issue-filing infrastructure as the existing human-submitted feedback flow. Whenever the tool is invoked, the copilot's reply to the founder SHALL disclose that it filed feedback.

#### Scenario: No silent issue filing

- **WHEN** `githubFeedback` is called and successfully files an issue
- **THEN** the copilot's reply in the same turn states that it registered the feedback/suggestion, so the founder is never unaware a GitHub issue was created on their behalf

#### Scenario: Filing failure doesn't block the conversation

- **WHEN** the underlying GitHub issue creation fails (e.g. misconfigured repo/token)
- **THEN** the copilot's reply continues normally and reports that filing the feedback did not succeed, rather than the whole turn failing
