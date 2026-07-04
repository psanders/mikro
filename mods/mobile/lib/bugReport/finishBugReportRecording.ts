/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pure recording-to-submission logic pulled out of BugReportContext so it's
 * testable without mocking React/native modules — file reading, screenshot
 * extraction, and the tRPC mutation are all injected.
 */
import type { ScreenRecordingFile } from "react-native-nitro-screen-recorder";

export interface BugReportSubmissionInput {
  videoBase64: string;
  videoMimeType: string;
  screenshotBase64: string;
  screenshotMimeType: string;
  pageUrl?: string;
  userAgent?: string;
}

export interface FinishBugReportRecordingDeps {
  readBase64: (path: string) => Promise<string>;
  extractScreenshot: (path: string) => Promise<{ base64: string; mimeType: string }>;
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

  const [videoBase64, screenshot] = await Promise.all([
    deps.readBase64(file.path),
    deps.extractScreenshot(file.path)
  ]);

  return deps.submit({
    videoBase64,
    videoMimeType: "video/mp4",
    screenshotBase64: screenshot.base64,
    screenshotMimeType: screenshot.mimeType,
    pageUrl: "mikro://perfil",
    userAgent: `Mikro Mobile/${deps.platform}`
  });
}
