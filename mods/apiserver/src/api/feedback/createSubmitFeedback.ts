/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * In-app feedback (mikro/#69): a short screen recording is transcribed
 * (best-effort — some clients, like the Tauri desktop build, send a silent
 * video with no audio track, see extend-bug-report-native-capture), the
 * transcript is structured into a feedback write-up by an LLM, and a GitHub
 * issue is filed with the still-frame screenshot embedded inline and the
 * recording linked (mikro/#87). Feedback is generic on purpose — it can be a
 * bug, something confusing, or a feature idea — so nothing here assumes a
 * defect, and the issue is filed unlabeled for the team to triage. Both the
 * screenshot and the video are committed to the target repo so they have
 * stable URLs — the REST API has no direct "attach a binary to an issue"
 * endpoint. This is temporary/lightweight storage (the same tier as the
 * screenshot, not a managed archive): the point is letting the team see where
 * the user was and what they did, not long-term retention. The result returned
 * to the client never surfaces the issue URL to the UI — the target repos are
 * private, so the user has no access to view it anyway (see FeedbackButton.tsx
 * / FeedbackStatusModal.tsx).
 */
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Octokit } from "@octokit/rest";
import { TRPCError } from "@trpc/server";
import type { SubmitFeedbackInput, SubmitFeedbackResult } from "@mikro/common";
import { logger } from "../../logger.js";
import { fileGithubIssue, parseRepo } from "./fileGithubIssue.js";

export interface FeedbackReporter {
  name: string;
  userId: string;
}

export interface SubmitFeedbackDeps {
  /** Transcribes a "data:<mime>;base64,..." recording. Reused from voice notes (Deepgram). */
  transcribe: (dataUrl: string) => Promise<string>;
  /** Lazy so a missing/invalid LLM config only surfaces when feedback is actually filed. */
  createModel: () => BaseChatModel;
  octokit: Octokit;
  /** "owner/repo" the button files issues against. */
  repo: string;
}

interface StructuredFeedback {
  title: string;
  summary: string;
  details: string;
}

const STRUCTURE_SYSTEM_PROMPT = `Eres un asistente que convierte la transcripción de un usuario dando feedback sobre la app Mikro en un elemento de feedback estructurado. El feedback puede ser un problema (bug), algo confuso, o una idea o sugerencia — no asumas que siempre es un error.

Responde ÚNICAMENTE con un objeto JSON (sin markdown, sin texto extra) con esta forma exacta:
{"title": "...", "summary": "...", "details": "..."}

- "title": título corto y específico del feedback (máx 80 caracteres), en español.
- "summary": resumen de una o dos frases de lo que el usuario quiere comunicar.
- "details": descripción más completa — el contexto, los pasos si aplica, y qué esperaba frente a qué pasó cuando se trata de un problema. Usa \\n para separar líneas.

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
function parseStructuredFeedback(raw: string): StructuredFeedback | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  const candidate = fenced ? fenced[1] : raw;
  try {
    const parsed = JSON.parse(candidate!.trim()) as Partial<StructuredFeedback>;
    if (!parsed.title) return null;
    return {
      title: parsed.title,
      summary: parsed.summary ?? "No especificado.",
      details: parsed.details ?? "No especificado."
    };
  } catch {
    return null;
  }
}

function extFromMimeType(mimeType: string): string {
  const sub = mimeType.split("/")[1]?.split(";")[0];
  return sub && /^[a-z0-9]+$/i.test(sub) ? sub : "png";
}

export function createSubmitFeedback(deps: SubmitFeedbackDeps) {
  return async (
    input: SubmitFeedbackInput,
    reporter: FeedbackReporter
  ): Promise<SubmitFeedbackResult> => {
    if (!deps.repo) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Feedback is not configured (githubFeedback.repo is empty)."
      });
    }
    const { owner, name: repoName } = parseRepo(deps.repo);

    // Transcribe. Best-effort: a Deepgram outage shouldn't block filing the
    // issue — the user's screen recording plus screenshot still tell most of
    // the story. Some clients (Tauri desktop) send a silent video, so an
    // empty/near-empty transcript here is expected, not an error.
    let transcript = "";
    try {
      const videoDataUrl = `data:${input.videoMimeType};base64,${input.videoBase64}`;
      transcript = await deps.transcribe(videoDataUrl);
    } catch (err) {
      logger.error("feedback transcription failed", { error: (err as Error).message });
    }

    // Structure via LLM. Best-effort for the same reason — fall back to a
    // generic write-up (still useful: screenshot + raw transcript) rather
    // than failing the whole submission over a transcript-formatting model.
    let structured: StructuredFeedback | null = null;
    if (transcript.trim()) {
      try {
        const model = deps.createModel();
        const response = await model.invoke([
          new SystemMessage(STRUCTURE_SYSTEM_PROMPT),
          new HumanMessage(transcript)
        ]);
        structured = parseStructuredFeedback(contentToText(response.content));
      } catch (err) {
        logger.error("feedback structuring failed", { error: (err as Error).message });
      }
    }

    // Commit the video (the default, primary visual artifact — see
    // feedback.ts) and, only if a client actually sent one, the legacy
    // screenshot. Both are best-effort uploads: a GitHub hiccup on either one
    // shouldn't lose the whole submission, since the structured write-up (or
    // at least the transcript fallback) is still useful on its own.
    const videoPath = `feedback/${Date.now()}-${reporter.userId.slice(0, 8)}.${extFromMimeType(input.videoMimeType)}`;
    let videoUrl: string | null = null;
    try {
      const upload = await deps.octokit.repos.createOrUpdateFileContents({
        owner,
        repo: repoName,
        path: videoPath,
        message: `Feedback recording: ${videoPath}`,
        content: input.videoBase64
      });
      videoUrl = (upload.data.content?.download_url as string | undefined) ?? null;
    } catch (err) {
      logger.error("feedback video upload failed", { error: (err as Error).message });
    }

    let screenshotUrl: string | null = null;
    if (input.screenshotBase64) {
      const screenshotPath = `feedback/${Date.now()}-${reporter.userId.slice(0, 8)}.${extFromMimeType(input.screenshotMimeType ?? "image/png")}`;
      try {
        const upload = await deps.octokit.repos.createOrUpdateFileContents({
          owner,
          repo: repoName,
          path: screenshotPath,
          message: `Feedback screenshot: ${screenshotPath}`,
          content: input.screenshotBase64
        });
        screenshotUrl = (upload.data.content?.download_url as string | undefined) ?? null;
      } catch (err) {
        logger.error("feedback screenshot upload failed", { error: (err as Error).message });
      }
    }

    const title = structured?.title?.slice(0, 120) || "Feedback (sin transcripción)";
    const bodySections = [
      structured
        ? `## Resumen\n${structured.summary}\n\n## Detalles\n${structured.details}`
        : "## Descripción\nNo se pudo generar un resumen automático. Ver la transcripción y la grabación a continuación.",
      videoUrl ? `## Grabación\n[Ver grabación de pantalla](${videoUrl})` : null,
      screenshotUrl ? `## Captura de pantalla\n![captura](${screenshotUrl})` : null,
      transcript.trim()
        ? `<details><summary>Transcripción completa</summary>\n\n${transcript.trim()}\n\n</details>`
        : null,
      [
        "---",
        `Enviado por: ${reporter.name}`,
        input.pageUrl ? `Página: ${input.pageUrl}` : null,
        input.userAgent ? `Navegador: ${input.userAgent}` : null
      ]
        .filter(Boolean)
        .join("  \n")
    ]
      .filter(Boolean)
      .join("\n\n");

    // No `labels` here: GitHub rejects issue creation if a named label
    // doesn't already exist in the target repo, and feedback is generic
    // anyway (a bug, an idea, or confusion) — the team triages and labels
    // afterward. fileGithubIssue is the same path the copilot's githubFeedback
    // tool uses (add-copilot-tool-awareness-feedback) — one GitHub client, not two.
    const { issueUrl } = await fileGithubIssue(
      { octokit: deps.octokit, repo: deps.repo },
      { title, body: bodySections }
    );

    logger.info("feedback filed", { issueUrl, reporter: reporter.userId });

    return { issueUrl };
  };
}
