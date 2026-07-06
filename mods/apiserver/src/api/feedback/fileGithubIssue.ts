/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared GitHub issue-filing helper (design Decision 4 of
 * add-copilot-tool-awareness-feedback). Extracted from createSubmitFeedback.ts
 * so the copilot's `githubFeedback` tool and the human-facing feedback flow
 * file issues through the same path instead of two GitHub clients. No labels
 * — GitHub rejects issue creation for a label that doesn't already exist in
 * the target repo, and every filed issue here (human or copilot) is generic
 * by convention; the team triages and labels afterward.
 */
import type { Octokit } from "@octokit/rest";
import { TRPCError } from "@trpc/server";

export interface FileGithubIssueDeps {
  octokit: Octokit;
  /** "owner/repo" the issue is filed against. */
  repo: string;
}

export interface FileGithubIssueInput {
  title: string;
  body: string;
}

export interface FileGithubIssueResult {
  issueUrl: string;
}

export function parseRepo(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: 'githubFeedback.repo must be configured as "owner/repo".'
    });
  }
  return { owner, name };
}

/** Files a single, unlabeled GitHub issue. Throws on failure — callers decide how to degrade. */
export async function fileGithubIssue(
  deps: FileGithubIssueDeps,
  input: FileGithubIssueInput
): Promise<FileGithubIssueResult> {
  if (!deps.repo) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Feedback is not configured (githubFeedback.repo is empty)."
    });
  }
  const { owner, name: repoName } = parseRepo(deps.repo);

  const issue = await deps.octokit.issues.create({
    owner,
    repo: repoName,
    title: input.title,
    body: input.body
  });

  return { issueUrl: issue.data.html_url };
}
