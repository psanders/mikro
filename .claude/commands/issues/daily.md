---
name: "Daily Issues"
description: Pull open GitHub issues for the mikro repo grouped by priority, ready to pick work from
category: Workflow
tags: [github, issues, planning]
---

Fetch and display open issues for `psanders/mikro` so the user can pick what to work on today.

**Input**: Optional filter arg — one of: `bug`, `feature`, `chore`, `P0`, `P1`, `mine`. Default: show all open.

---

**Steps**

1. **Fetch issues**

   Run:

   ```bash
   gh issue list --repo psanders/mikro --state open --limit 50 --json number,title,labels,assignees,createdAt,url
   ```

2. **Parse and group**

   Group issues by type label (`bug`, `enhancement`/feature, `documentation`/chore, unlabeled).

   Within each group, sort by priority: P0 first, then P1, P2, P3, unlabeled last.

   Extract priority from labels if present; otherwise infer from title prefix `[P0]` etc.; otherwise mark as `–`.

3. **Apply filter** (if arg given)
   - `bug` → show only bug group
   - `feature` → show only feature/enhancement group
   - `chore` → show only chore group
   - `P0` / `P1` → show only that priority across all types
   - `mine` → filter to issues assigned to `@me`

4. **Display**

   Format as a clean table per group:

   ```
   BUGS (N)
   #123  P1  [Bug] Short title                  <url>
   #117  P2  [Bug] Another bug                  <url>

   FEATURES (N)
   #130  P1  [Feature] Add export               <url>

   CHORES (N)
   #98   P3  [Chore] Update deps                <url>
   ```

   If no issues in a group, omit that group.
   If total is 0, print: "No open issues. You're clear."

5. **Offer to act**

   After displaying, ask with **AskUserQuestion**:
   - "What do you want to do?" with options:
     - Work on an issue (enter number)
     - Report a new issue
     - Nothing, just browsing

   If "Work on an issue": ask for the issue number, then run:

   ```bash
   gh issue view <number> --repo psanders/mikro
   ```

   Show full details, then suggest:

   > "Want to explore this before implementing? Run `/opsx:explore` — it's a good way to think through the approach before writing code."

   Then ask how they want to proceed with **AskUserQuestion**:
   - "How do you want to start?" with options:
     - Explore with /opsx:explore (Recommended)
     - Jump straight to implementation
     - Investigate / research only
     - Close or comment on issue

   If "Explore with /opsx:explore": invoke the `/opsx:explore` skill, passing the issue title and summary as context.
   If "Jump straight to implementation": invoke `/opsx:propose` with the issue as input.
   If "Investigate / research only": proceed with investigation in the current conversation.
   If "Close or comment": ask for the comment text or confirmation to close, then run the appropriate `gh` command.

   If "Report a new issue": invoke the `/report-issue` command flow.

   If "Nothing": done.

**Guardrails**

- Max 50 issues per fetch; note if list may be truncated
- If `gh` fails, show error and suggest `gh auth status`
