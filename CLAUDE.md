Read AGENTS.md before changing dependencies, CI workflows, or anything
build/release related. It records the practices that keep the workflows
green and the checks that enforce them.

## Branch hygiene

Once a branch's PR is confirmed merged into `main`, delete it without asking:

- Verify first: `git merge-base --is-ancestor <branch> origin/main`.
- Delete the local branch (`git branch -d`) — switch off it first if it's checked out.
- Check the remote: `git ls-remote --heads origin <branch>`. This repo has
  "delete branch on merge" enabled, so it's usually already gone; if not,
  delete it (`git push origin --delete <branch>`).

Do this proactively at the end of any task that ends in a merged PR, and
whenever you notice a stale merged branch lying around — don't wait to be
asked twice.
