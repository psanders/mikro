/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * A short screen recording, not a document — generous relative to
 * MAX_ATTACHMENT_SIZE_BYTES (10MB, tuned for a single photo/PDF). Transcribed
 * for its audio track (when present — some clients send a silent video, see
 * extend-bug-report-native-capture) and then committed to the target repo so
 * the team can review what the reporter actually did (mikro/#69, mikro/#87)
 * — this cap bounds both the request payload and the committed file size.
 * This is the primary (and, per client, only) visual artifact — the
 * screenshot field below is a legacy fallback no client sends anymore, since
 * the video carries strictly more information.
 */
export const MAX_FEEDBACK_VIDEO_BYTES = 50 * 1024 * 1024;

/** Single still frame — same order of magnitude as other image uploads. */
export const MAX_FEEDBACK_SCREENSHOT_BYTES = 10 * 1024 * 1024;

/**
 * Mic-only narration audio (mikro/#156) — sent separately from the video on
 * clients whose video has no audio track (Tauri desktop's ScreenCaptureKit
 * recording, see extend-bug-report-native-capture). Opus/webm audio is far
 * smaller per second than the video, so this cap is generous relative to its
 * likely size even at the same recording duration.
 */
export const MAX_FEEDBACK_AUDIO_BYTES = 15 * 1024 * 1024;

const base64SizeCheck = (max: number) => (b: string) => Math.ceil((b.length * 3) / 4) <= max;

export const submitFeedbackSchema = z.object({
  /** Base64-encoded screen recording (no data: prefix), with or without audio. Transcribed (best-effort) then committed to the target repo. */
  videoBase64: z
    .string()
    .min(1, "Recording is required")
    .refine(base64SizeCheck(MAX_FEEDBACK_VIDEO_BYTES), {
      message: "Recording exceeds the maximum allowed size"
    }),
  videoMimeType: z.string().min(1).max(100),
  /**
   * Optional legacy still frame (no data: prefix) — no client sends this
   * anymore (the video is strictly more useful and is now the default/only
   * visual), kept optional rather than removed in case anything still relies
   * on it.
   */
  screenshotBase64: z
    .string()
    .min(1)
    .refine(base64SizeCheck(MAX_FEEDBACK_SCREENSHOT_BYTES), {
      message: "Screenshot exceeds the maximum allowed size"
    })
    .optional(),
  screenshotMimeType: z.string().min(1).max(100).optional(),
  /**
   * Optional mic-only narration audio (no data: prefix), captured in parallel
   * with the video on clients that can't mux a mic track into the video
   * itself (mikro/#156). When present, this — not the video — is what gets
   * transcribed, since it's the actual narration.
   */
  audioBase64: z
    .string()
    .min(1)
    .refine(base64SizeCheck(MAX_FEEDBACK_AUDIO_BYTES), {
      message: "Audio exceeds the maximum allowed size"
    })
    .optional(),
  audioMimeType: z.string().min(1).max(100).optional(),
  /** Where the reporter was in the app when they started recording. */
  pageUrl: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional()
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

export interface SubmitFeedbackResult {
  issueUrl: string;
}
