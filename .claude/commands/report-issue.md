---
name: "Report Issue"
description: Create a structured GitHub issue (bug, feature, or chore) for the mikro repo
category: Workflow
tags: [github, issues, workflow]
---

Create a GitHub issue for `psanders/mikro` with a structured format.

**Input**: The argument (if any) is a free-form description of the issue. If none given, ask.

---

**Steps**

1. **Gather information**

   If no input provided, use **AskUserQuestion** with these questions (all in one call):
   - "What do you want to report?" (open text)
   - "Type?" with options: Bug, Feature, Chore

   If input was provided as args, infer the type from context (words like "broken", "error", "crash" → Bug; "add", "support", "allow" → Feature; "cleanup", "refactor", "update" → Chore). If ambiguous, ask.

2. **Ask for priority** (skip if user already gave it)

   Use **AskUserQuestion**:
   - "Priority?" with options: P0 – Blocking, P1 – High, P2 – Normal (Recommended), P3 – Low

3. **Draft the issue body**

   Use the appropriate template structure:

   **Bug:**

   ```
   ## Summary
   <one sentence>

   ## Steps to Reproduce
   <numbered steps or "TBD">

   ## Expected Behavior
   <what should happen>

   ## Actual Behavior
   <what actually happens>

   ## Priority
   <P0/P1/P2/P3>
   ```

   **Feature:**

   ```
   ## Summary
   <one sentence>

   ## Problem / Motivation
   <pain point>

   ## Proposed Solution
   <what to build>

   ## Acceptance Criteria
   - [ ] <criterion>

   ## Priority
   <P0/P1/P2/P3>
   ```

   **Chore:**

   ```
   ## Summary
   <one sentence>

   ## Why Now
   <what it unblocks>

   ## Done When
   - [ ] <criterion>

   ## Priority
   <P0/P1/P2/P3>
   ```

4. **Show preview and confirm**

   Print the title and body to the user. Ask with **AskUserQuestion**:
   - "Create this issue?" with options: Yes, create it / Edit first / Cancel

   If "Edit first": ask what to change, update the draft, show again, confirm.
   If "Cancel": stop.

5. **Create the issue**

   Map type to label: Bug → `bug`, Feature → `enhancement`, Chore → `documentation`

   Map priority to label: P0 → none (just note in body), P1/P2/P3 → use priority label if it exists, otherwise skip.

   Run:

   ```bash
   gh issue create \
     --repo psanders/mikro \
     --title "<title>" \
     --body "<body>" \
     --label "<label>"
   ```

   Print the issue URL on success.

**Guardrails**

- Title must start with `[Bug]`, `[Feature]`, or `[Chore]`
- Never create the issue without user confirmation
- If `gh` fails, show the error and suggest running `gh auth status`
