/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * A short screen+mic recording, not a document — generous relative to
 * MAX_ATTACHMENT_SIZE_BYTES (10MB, tuned for a single photo/PDF). Nothing is
 * persisted server-side: the video is transcribed in memory and discarded
 * (mikro/#69); this cap only bounds the request payload.
 */
export const MAX_BUG_REPORT_VIDEO_BYTES = 50 * 1024 * 1024;

/** Single still frame — same order of magnitude as other image uploads. */
export const MAX_BUG_REPORT_SCREENSHOT_BYTES = 10 * 1024 * 1024;

const base64SizeCheck = (max: number) => (b: string) => Math.ceil((b.length * 3) / 4) <= max;

export const submitBugReportSchema = z.object({
  /** Base64-encoded screen+mic recording (no data: prefix). Transcribed then discarded. */
  videoBase64: z
    .string()
    .min(1, "Recording is required")
    .refine(base64SizeCheck(MAX_BUG_REPORT_VIDEO_BYTES), {
      message: "Recording exceeds the maximum allowed size"
    }),
  videoMimeType: z.string().min(1).max(100),
  /** Base64-encoded still frame (no data: prefix). Committed to the target repo as the issue's inline image. */
  screenshotBase64: z
    .string()
    .min(1, "Screenshot is required")
    .refine(base64SizeCheck(MAX_BUG_REPORT_SCREENSHOT_BYTES), {
      message: "Screenshot exceeds the maximum allowed size"
    }),
  screenshotMimeType: z.string().min(1).max(100),
  /** Where the reporter was in the app when they started recording. */
  pageUrl: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional()
});

export type SubmitBugReportInput = z.infer<typeof submitBugReportSchema>;

export interface SubmitBugReportResult {
  issueUrl: string;
}
