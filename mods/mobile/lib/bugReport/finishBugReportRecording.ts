/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pure recording-to-submission logic pulled out of BugReportContext so it's
 * testable without mocking React/native modules — file reading and the tRPC
 * mutation are injected. No screenshot: the video is the default/only visual
 * now (strictly more useful, and it's the whole reason native capture was
 * built), so nothing extracts a still frame anymore.
 */
import type { ScreenRecordingFile } from "react-native-nitro-screen-recorder";

export interface BugReportSubmissionInput {
  videoBase64: string;
  videoMimeType: string;
  pageUrl?: string;
  userAgent?: string;
}

export interface FinishBugReportRecordingDeps {
  readBase64: (path: string) => Promise<string>;
  submit: (input: BugReportSubmissionInput) => Promise<{ issueUrl: string }>;
  platform: string;
}

/**
 * Turns a completed native recording into a filed GitHub issue. Throws
 * (without calling `submit`) when there's no file to work with — a failed or
 * cancelled recording must never reach the network.
 */
export async function finishBugReportRecording(
  file: ScreenRecordingFile | undefined,
  deps: FinishBugReportRecordingDeps
): Promise<{ issueUrl: string }> {
  if (!file) {
    throw new Error("No se generó ningún archivo de grabación.");
  }

  const videoBase64 = await deps.readBase64(file.path);

  return deps.submit({
    videoBase64,
    videoMimeType: "video/mp4",
    pageUrl: "mikro://perfil",
    userAgent: `Mikro Mobile/${deps.platform}`
  });
}
