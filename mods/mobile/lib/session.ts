/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { isTRPCClientError } from "@trpc/client";

/**
 * Global hook fired when the API rejects the current session (expired or
 * otherwise invalid JWT). The root layout registers a handler that performs a
 * clean logout — clearing only the auth token, never the local SQLite data or
 * pending mutations — and sends the collector to the login screen to
 * re-authenticate. Unsynced payments survive and push once a fresh token is
 * obtained.
 */
type SessionExpiredHandler = () => void;

let handler: SessionExpiredHandler | null = null;
let firing = false;

export function setSessionExpiredHandler(fn: SessionExpiredHandler | null): void {
  handler = fn;
}

/**
 * Notifies the app that the session is no longer valid. Debounced so a batch of
 * simultaneously-failing requests only triggers a single logout/redirect.
 */
export function notifySessionExpired(): void {
  if (firing || !handler) return;
  firing = true;
  try {
    handler();
  } finally {
    setTimeout(() => {
      firing = false;
    }, 3000);
  }
}

/**
 * Returns true when an error coming back from a tRPC call means the caller's
 * token was rejected (expired / invalid), as opposed to a wrong-credentials
 * response on the login route or any other failure.
 */
export function isUnauthorizedError(err: unknown): boolean {
  if (!isTRPCClientError(err)) return false;
  const data = err.data as { code?: string; httpStatus?: number } | null | undefined;
  return data?.code === "UNAUTHORIZED" || data?.httpStatus === 401;
}
