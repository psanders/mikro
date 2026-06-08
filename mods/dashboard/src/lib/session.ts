/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { TRPCClientError } from "@trpc/client";
import type { AppRouter } from "@mikro/apiserver";

function isTRPCClientError(err: unknown): err is TRPCClientError<AppRouter> {
  return err instanceof TRPCClientError;
}

/**
 * True when an error represents a rejected/expired session. Mirrors the mobile
 * app's check: a tRPC `UNAUTHORIZED` code or an HTTP 401.
 */
export function isUnauthorizedError(err: unknown): boolean {
  if (!isTRPCClientError(err)) return false;
  const data = err.data as { code?: string; httpStatus?: number } | null | undefined;
  return data?.code === "UNAUTHORIZED" || data?.httpStatus === 401;
}

// Lightweight pub/sub so the tRPC error link can signal a clean logout to the
// auth layer without importing React or creating a circular dependency.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySessionExpired(): void {
  for (const listener of listeners) listener();
}
