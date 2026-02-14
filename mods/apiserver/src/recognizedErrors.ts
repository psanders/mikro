/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Recognized uncaught errors that the process handler may treat as non-fatal.
 * We identify them by code where possible; for third-party errors (e.g. Fonoster SDK)
 * we use a known message until the upstream adds a stable code.
 */

export enum RecognizedUncaughtCode {
  /** Fonoster SDK call-tracking stream error; the outbound call was already placed. */
  FONOSTER_CALL_TRACKING = "FONOSTER_CALL_TRACKING"
}

/** Message thrown by @fonoster/sdk when its trackCall stream fails (we cannot set a code ourselves). */
const FONOSTER_CALL_TRACKING_MESSAGE = "An error occurred while tracking the call";

export function isRecognizedUncaughtError(err: unknown, code: RecognizedUncaughtCode): boolean {
  if (!(err instanceof Error)) return false;
  switch (code) {
    case RecognizedUncaughtCode.FONOSTER_CALL_TRACKING:
      return err.message === FONOSTER_CALL_TRACKING_MESSAGE;
    default:
      return false;
  }
}
