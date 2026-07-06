## ADDED Requirements

### Requirement: Tool-call outcomes are logged as coarse signal

Every copilot READ or DIRECT tool execution SHALL append a `ToolCallLog` row recording the tool name, an optional coarse `signal` (the tool result's `reason` code for lookup tools, or the `category` for `githubFeedback`), the acting user, and a timestamp. The log SHALL NOT record tool call arguments or result data.

#### Scenario: Failed lookup is logged

- **WHEN** a READ tool (e.g. `getCustomer`, `getApplicationById`) executes and returns `reason: "NOT_FOUND"`
- **THEN** a `ToolCallLog` row is written with that tool name and `signal: "NOT_FOUND"`, without the lookup arguments or any customer data

#### Scenario: Feedback filing is logged

- **WHEN** the `githubFeedback` tool executes with a given `category`
- **THEN** a `ToolCallLog` row is written with `toolName: "githubFeedback"` and `signal` set to that category

### Requirement: Periodic deterministic pattern detection

An interval worker SHALL evaluate accumulated `ToolCallLog` rows on a periodic (default weekly) cadence, grouping by `(toolName, signal)` within the trailing window and identifying groups whose count meets or exceeds a configurable threshold (default 3). The evaluation SHALL be deterministic (no LLM call) and SHALL only run detection logic — filing is a separate step gated on at least one qualifying group.

#### Scenario: No patterns cross the threshold

- **WHEN** the evaluator runs and no `(toolName, signal)` group in the window meets the threshold
- **THEN** no digest issue is filed and no error is raised

#### Scenario: A recurring gap crosses the threshold

- **WHEN** the same `(toolName, signal)` pair (e.g. `getApplicationById` / `NOT_FOUND`) appears at least `threshold` times within the window
- **THEN** that pattern is included in the next digest

### Requirement: Digest is filed as a single GitHub issue

When at least one pattern crosses the threshold, the evaluator SHALL compile all qualifying patterns from that run into a single GitHub issue (via the existing issue-filing infrastructure), listing each pattern's tool name, signal, occurrence count, and first/last-seen timestamps. Multiple qualifying patterns in the same run SHALL be combined into one issue, not filed individually. Filed issues SHALL NOT require a pre-existing GitHub label — they are distinguished from other filed feedback by title and content only.

#### Scenario: Multiple patterns combine into one issue

- **WHEN** an evaluator run finds three distinct `(toolName, signal)` groups crossing the threshold
- **THEN** exactly one GitHub issue is filed listing all three patterns

### Requirement: Dormant bound tools are surfaced monthly

At most once per calendar month, the evaluator SHALL compare the set of currently bound copilot tool names against the set of distinct tool names appearing in `ToolCallLog` over a longer trailing window (default 90 days). Any bound tool absent from that set SHALL be included as a "possibly dormant" entry in the next digest that's due, in the same issue as any qualifying failure patterns from that run. This check SHALL NOT run more often than monthly regardless of how often the weekly pattern check runs.

#### Scenario: A bound tool with no calls in the window is flagged

- **WHEN** the monthly dormancy check is due and a tool bound via `getBoundToolNames()` has zero `ToolCallLog` rows in the trailing 90 days
- **THEN** that tool is listed in the digest's dormancy section

#### Scenario: Dormancy check does not repeat every week

- **WHEN** the weekly pattern-detection tick runs but the monthly dormancy check is not yet due
- **THEN** the digest (if filed at all that week) contains no dormancy section

### Requirement: Log retention is bounded

`ToolCallLog` rows older than a configurable retention window (default 120 days) SHALL be pruned before each evaluator run, so accumulated telemetry does not grow without bound and stale rows cannot distort the dormancy check.

#### Scenario: Old rows are pruned before evaluation

- **WHEN** the evaluator runs
- **THEN** `ToolCallLog` rows older than the retention window are deleted before pattern detection and dormancy detection execute
