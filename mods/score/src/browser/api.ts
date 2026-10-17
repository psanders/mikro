/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Mikro API client used by the background worker and the options page.
 * Plain tRPC over HTTP (no transformer): GET /trpc/<path>?input=… for
 * queries, POST for mutations, Bearer token from the options page.
 */
import type { ApiRequest, ApiResponse } from "./protocol.js";

export async function settings(): Promise<{ apiUrl?: string; token?: string; name?: string }> {
  return (await chrome.storage.local.get(["apiUrl", "token", "name"])) as {
    apiUrl?: string;
    token?: string;
    name?: string;
  };
}

export async function callApi(
  apiUrl: string,
  token: string | undefined,
  req: Omit<ApiRequest, "type">
): Promise<ApiResponse> {
  const base = `${apiUrl.replace(/\/+$/, "")}/trpc/${req.path}`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res =
      req.kind === "query"
        ? await fetch(`${base}?input=${encodeURIComponent(JSON.stringify(req.input ?? null))}`, {
            headers
          })
        : await fetch(base, { method: "POST", headers, body: JSON.stringify(req.input ?? null) });
  } catch (e) {
    return {
      ok: false,
      code: "ERROR",
      message: `Sin conexión con Mikro (${(e as Error).message})`
    };
  }
  const body = (await res.json().catch(() => null)) as {
    result?: { data?: unknown };
    error?: { message?: string; data?: { code?: string } };
  } | null;
  if (res.ok && body?.result) return { ok: true, data: body.result.data };
  const code = body?.error?.data?.code;
  if (code === "UNAUTHORIZED")
    return { ok: false, code: "UNAUTHORIZED", message: "Sesión vencida" };
  return { ok: false, code: "ERROR", message: body?.error?.message ?? `Error ${res.status}` };
}
