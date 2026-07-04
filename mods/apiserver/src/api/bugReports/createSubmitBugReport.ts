/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * In-app bug report (mikro/#69): a short screen recording is transcribed
 * (best-effort — some clients, like the Tauri desktop build, send a silent
 * video with no audio track, see extend-bug-report-native-capture), the
 * transcript is structured into a bug write-up by an LLM, and a GitHub issue
 * is filed with the still-frame screenshot embedded inline and the recording
 * linked (mikro/#87). Both the screenshot and the video are committed to the
 * target repo so they have stable URLs — the REST API has no direct "attach
 * a binary to an issue" endpoint. This is temporary/lightweight storage (the
 * same tier as the screenshot, not a managed archive): the point is letting
 * the team see where the reporter was and what they did, not long-term
 * retention. The result returned to the client never surfaces the issue URL
 * to the UI — the target repos are private, so the reporter has no access to
 * view it anyway (see BugReportButton.tsx / BugReportStatusModal.tsx).
 */
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Octokit } from "@octokit/rest";
import { TRPCError } from "@trpc/server";
import type { SubmitBugReportInput, SubmitBugReportResult } from "@mikro/common";
import { logger } from "../../logger.js";

export interface BugReportReporter {
  name: string;
  userId: string;
}

export interface SubmitBugReportDeps {
  /** Transcribes a "data:<mime>;base64,..." recording. Reused from voice notes (Deepgram). */
  transcribe: (dataUrl: string) => Promise<string>;
  /** Lazy so a missing/invalid LLM config only surfaces when a report is actually filed. */
  createModel: () => BaseChatModel;
  octokit: Octokit;
  /** "owner/repo" the button files issues against. */
  repo: string;
}

interface StructuredReport {
  title: string;
  repro: string;
  expected: string;
  actual: string;
}

const STRUCTURE_SYSTEM_PROMPT = `Eres un asistente que convierte la transcripción de un usuario narrando un problema en la app Mikro en un reporte de bug estructurado.

Responde ÚNICAMENTE con un objeto JSON (sin markdown, sin texto extra) con esta forma exacta:
{"title": "...", "repro": "...", "expected": "...", "actual": "..."}

- "title": título corto y específico del problema (máx 80 caracteres), en español.
- "repro": pasos para reproducir, como lista numerada en texto (usa \\n entre pasos). Si el usuario no describió pasos claros, infiere los más probables a partir de lo que dijo.
- "expected": qué esperaba que pasara el usuario.
- "actual": qué pasó en realidad.

Si la transcripción es confusa o incompleta, haz tu mejor esfuerzo — nunca dejes un campo vacío.`;

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : ((part as { text?: string }).text ?? "")))
      .join("");
  }
  return "";
}

/** Best-effort JSON extraction — LLMs occasionally wrap output in a code fence despite instructions. */
function parseStructuredReport(raw: string): StructuredReport | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  const candidate = fenced ? fenced[1] : raw;
  try {
    const parsed = JSON.parse(candidate!.trim()) as Partial<StructuredReport>;
    if (!parsed.title) return null;
    return {
      title: parsed.title,
      repro: parsed.repro ?? "No especificado.",
      expected: parsed.expected ?? "No especificado.",
      actual: parsed.actual ?? "No especificado."
    };
  } catch {
    return null;
  }
}

function parseRepo(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: 'githubBugReport.repo must be configured as "owner/repo".'
    });
  }
  return { owner, name };
}

function extFromMimeType(mimeType: string): string {
  const sub = mimeType.split("/")[1]?.split(";")[0];
  return sub && /^[a-z0-9]+$/i.test(sub) ? sub : "png";
}

export function createSubmitBugReport(deps: SubmitBugReportDeps) {
  return async (
    input: SubmitBugReportInput,
    reporter: BugReportReporter
  ): Promise<SubmitBugReportResult> => {
    if (!deps.repo) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Bug reporting is not configured (githubBugReport.repo is empty)."
      });
    }
    const { owner, name: repoName } = parseRepo(deps.repo);

    // Transcribe. Best-effort: a Deepgram outage shouldn't block filing the
    // issue — the reporter's screen recording plus screenshot still tell most
    // of the story. Some clients (Tauri desktop) send a silent video, so an
    // empty/near-empty transcript here is expected, not an error.
    let transcript = "";
    try {
      const videoDataUrl = `data:${input.videoMimeType};base64,${input.videoBase64}`;
      transcript = await deps.transcribe(videoDataUrl);
    } catch (err) {
      logger.error("bug report transcription failed", { error: (err as Error).message });
    }

    // Structure via LLM. Best-effort for the same reason — fall back to a
    // generic write-up (still useful: screenshot + raw transcript) rather
    // than failing the whole report over a transcript-formatting model.
    let structured: StructuredReport | null = null;
    if (transcript.trim()) {
      try {
        const model = deps.createModel();
        const response = await model.invoke([
          new SystemMessage(STRUCTURE_SYSTEM_PROMPT),
          new HumanMessage(transcript)
        ]);
        structured = parseStructuredReport(contentToText(response.content));
      } catch (err) {
        logger.error("bug report structuring failed", { error: (err as Error).message });
      }
    }

    // Commit the video (the default, primary visual artifact — see
    // bugReport.ts) and, only if a client actually sent one, the legacy
    // screenshot. Both are best-effort uploads: a GitHub hiccup on either one
    // shouldn't lose the whole report, since the structured write-up (or at
    // least the transcript fallback) is still useful on its own.
    const videoPath = `bug-reports/${Date.now()}-${reporter.userId.slice(0, 8)}.${extFromMimeType(input.videoMimeType)}`;
    let videoUrl: string | null = null;
    try {
      const upload = await deps.octokit.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: videoPath,
        message: `Bug report recording: ${videoPath}`,
        content: input.videoBase64
      });
      videoUrl = (upload.data.content?.download_url as string | undefined) ?? null;
    } catch (err) {
      logger.error("bug report video upload failed", { error: (err as Error).message });
    }

    let screenshotUrl: string | null = null;
    if (input.screenshotBase64) {
      const screenshotPath = `bug-reports/${Date.now()}-${reporter.userId.slice(0, 8)}.${extFromMimeType(input.screenshotMimeType ?? "image/png")}`;
      try {
        const upload = await deps.octokit.repos.createOrUpdateFileContents({
          owner,
          repo: repoName,
          path: screenshotPath,
          message: `Bug report screenshot: ${screenshotPath}`,
          content: input.screenshotBase64
        });
        screenshotUrl = (upload.data.content?.download_url as string | undefined) ?? null;
      } catch (err) {
        logger.error("bug report screenshot upload failed", { error: (err as Error).message });
      }
    }

    const title = structured?.title?.slice(0, 120) || "Reporte de bug (sin transcripción)";
    const bodySections = [
      structured
        ? `## Pasos para reproducir\n${structured.repro}\n\n## Comportamiento esperado\n${structured.expected}\n\n## Comportamiento actual\n${structured.actual}`
        : "## Descripción\nNo se pudo generar un resumen automático. Ver la transcripción y la grabación a continuación.",
      videoUrl ? `## Grabación\n[Ver grabación de pantalla](${videoUrl})` : null,
      screenshotUrl ? `## Captura de pantalla\n![captura](${screenshotUrl})` : null,
      transcript.trim()
        ? `<details><summary>Transcripción completa</summary>\n\n${transcript.trim()}\n\n</details>`
        : null,
      [
        "---",
        `Reportado por: ${reporter.name}`,
        input.pageUrl ? `Página: ${input.pageUrl}` : null,
        input.userAgent ? `Navegador: ${input.userAgent}` : null
      ]
        .filter(Boolean)
        .join("  \n")
    ]
      .filter(Boolean)
      .join("\n\n");

    // No `labels` here: GitHub rejects issue creation if a named label
    // doesn't already exist in the target repo, and we can't assume the
    // configured repo has a "bug-report" label pre-created. Label manually.
    const issue = await deps.octokit.issues.create({
      owner,
      repo: repoName,
      title,
      body: bodySections
    });

    logger.info("bug report filed", { issueUrl: issue.data.html_url, reporter: reporter.userId });

    return { issueUrl: issue.data.html_url };
  };
}
