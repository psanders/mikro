/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared client-side helpers for the in-app feedback submit path (mikro/#97).
 *
 * Two concerns that used to be duplicated (and subtly wrong) across all three
 * clients — dashboard (Tauri/web) and the mobile iOS/Android context:
 *
 *   1. Turning a submit failure into user-facing copy. The old code did
 *      `err instanceof Error ? err.message : "<Spanish fallback>"`, which meant
 *      the Spanish fallback almost never fired — nearly every real failure IS an
 *      `instanceof Error`, so a raw English string ("Failed to fetch", a tRPC
 *      error message, etc.) leaked straight to a Spanish-only UI. The client now
 *      owns all display copy and maps by error *shape*, never echoing a raw
 *      message. See `toSpanishFeedbackError`.
 *
 *   2. Retrying a transient failure automatically instead of forcing the user to
 *      re-record. `submitFeedbackWithRetry` retries the *same* already-captured
 *      recording on network blips / 5xx / rate limits, with exponential backoff.
 *
 * Provider-agnostic on purpose: this lives in @mikro/common (used server-side
 * too) so it must not import `@trpc/client` or any browser/native API. tRPC
 * errors are inspected structurally (`err.data.code` / `err.data.httpStatus`),
 * exactly the shape `session.ts` already relies on, and network failures are
 * recognised by the `TypeError` / message patterns fetch throws on web and RN.
 */

/** tRPC procedure-error codes we treat as worth an automatic retry. */
const RETRYABLE_TRPC_CODES = new Set(["TOO_MANY_REQUESTS", "INTERNAL_SERVER_ERROR", "TIMEOUT"]);

/** Substrings (case-insensitive) that identify a raw network/fetch failure. */
const NETWORK_ERROR_PATTERN =
  /failed to fetch|network request failed|load failed|networkerror|fetch failed|timeout|timed out|connection|offline|econn|enotfound/i;

function getTrpcCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === "object" && "code" in data) {
      const code = (data as { code?: unknown }).code;
      if (typeof code === "string") return code;
    }
  }
  return undefined;
}

function getHttpStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === "object" && "httpStatus" in data) {
      const status = (data as { httpStatus?: unknown }).httpStatus;
      if (typeof status === "number") return status;
    }
  }
  return undefined;
}

/**
 * True for a raw transport failure — a `fetch` that never reached a tRPC
 * handler (no server-assigned code/status), recognised by the shape and message
 * `fetch` throws on web (`TypeError: Failed to fetch`) and React Native
 * (`TypeError: Network request failed`).
 */
export function isNetworkError(err: unknown): boolean {
  if (getTrpcCode(err) !== undefined || getHttpStatus(err) !== undefined) return false;
  if (err instanceof TypeError) return true;
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return NETWORK_ERROR_PATTERN.test(message);
}

/** True when hitting the per-user 1-per-minute submit cooldown. */
function isRateLimited(err: unknown): boolean {
  return getTrpcCode(err) === "TOO_MANY_REQUESTS" || getHttpStatus(err) === 429;
}

/**
 * Whether a failed submit is worth retrying with the same recording. Transient
 * transport/server conditions (network blip, 5xx, rate limit) are retryable;
 * deterministic failures (bad input, precondition/config, auth) are not — a
 * retry would just fail the same way.
 */
export function isRetryableFeedbackError(err: unknown): boolean {
  const code = getTrpcCode(err);
  if (code && RETRYABLE_TRPC_CODES.has(code)) return true;
  const status = getHttpStatus(err);
  if (typeof status === "number" && (status === 429 || status >= 500)) return true;
  // A server-answered error we didn't flag above is deterministic — don't retry.
  if (code !== undefined || typeof status === "number") return false;
  return isNetworkError(err);
}

/**
 * Maps any submit failure to Spanish user-facing copy. Never returns a raw
 * error message, so English strings from the platform or a tRPC error can never
 * leak into the Spanish-only UI.
 */
export function toSpanishFeedbackError(err: unknown): string {
  if (isRateLimited(err)) {
    return "Enviaste feedback hace poco. Espera un momento e intenta de nuevo.";
  }
  if (isNetworkError(err)) {
    return "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.";
  }
  return "No se pudo enviar el feedback. Intenta de nuevo más tarde.";
}

export interface SubmitFeedbackRetryOptions {
  /** Total attempts including the first (default 4: one try + three retries). */
  maxAttempts?: number;
  /** First backoff delay; doubles each retry up to `maxDelayMs` (default 2000ms). */
  baseDelayMs?: number;
  /** Cap on any single backoff delay (default 8000ms). */
  maxDelayMs?: number;
  /** Injectable sleep — override in tests so retries don't wait on real timers. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable retry predicate (defaults to `isRetryableFeedbackError`). */
  isRetryable?: (err: unknown) => boolean;
  /** Observability hook fired before each backoff wait. */
  onRetry?: (info: { attempt: number; nextDelayMs: number; error: unknown }) => void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `submit` and, on a *transient* failure, retries the exact same call with
 * exponential backoff. The caller passes a thunk that re-issues the mutation
 * with the already-captured recording, so a retry never re-records or re-reads
 * anything. Non-retryable failures and the final attempt rethrow the original
 * error unchanged (so the caller can still map it via `toSpanishFeedbackError`).
 *
 * Note on the rate limit: the server cooldown is 60s, longer than the backoff
 * window, so a genuinely rate-limited submit will exhaust its retries and
 * surface the Spanish "espera un momento" copy rather than blocking the UI for
 * a full minute. That is intentional — the manual retry button re-submits the
 * same recording, so nothing is lost.
 */
export async function submitFeedbackWithRetry<T>(
  submit: () => Promise<T>,
  options: SubmitFeedbackRetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 4,
    baseDelayMs = 2000,
    maxDelayMs = 8000,
    sleep = defaultSleep,
    isRetryable = isRetryableFeedbackError,
    onRetry
  } = options;

  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      return await submit();
    } catch (err) {
      if (attempt >= maxAttempts || !isRetryable(err)) throw err;
      const nextDelayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      onRetry?.({ attempt, nextDelayMs, error: err });
      await sleep(nextDelayMs);
    }
  }
}
