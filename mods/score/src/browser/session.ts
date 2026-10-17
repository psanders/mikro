/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Login, the same way the Ops dashboard does it (LoginPage.tsx): a local phone
 * typed as 809-555-0100, sent as E.164; the token is kept until it expires
 * (mikro.json `jwtExpiresIn`) or the evaluator logs out. The Mikro server is
 * built in (MIKRO_API_URL at build time, like the dashboard's VITE_API_URL);
 * a dev override can be saved from the options page.
 */
import { callApi } from "./api.js";

declare const __MIKRO_API_URL__: string;
export const BUILT_IN_API_URL =
  typeof __MIKRO_API_URL__ === "string" ? __MIKRO_API_URL__ : "http://localhost:4000";

/** 8095550100 → 809-555-0100 (as the dashboard formats it while typing). */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** 809-555-0100 → +18095550100. */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
}

export interface Session {
  apiUrl: string;
  token?: string;
  name?: string;
}

export async function getSession(): Promise<Session> {
  const s = (await chrome.storage.local.get(["apiUrl", "token", "name"])) as Partial<Session>;
  return { ...s, apiUrl: s.apiUrl || BUILT_IN_API_URL };
}

export type LoginResult = { ok: true; name: string } | { ok: false; message: string };

export async function login(phone: string, password: string): Promise<LoginResult> {
  const { apiUrl } = await getSession();
  const res = await callApi(apiUrl, undefined, {
    kind: "mutation",
    path: "login",
    input: { phone: toE164(phone), password }
  });
  if (!res.ok) {
    return {
      ok: false,
      message:
        res.code === "ERROR" && /conexión/i.test(res.message)
          ? res.message
          : "Teléfono o contraseña inválidos."
    };
  }
  const { token, name } = res.data as { token: string; name: string };
  await chrome.storage.local.set({ token, name });
  return { ok: true, name };
}

export async function logout(): Promise<void> {
  await chrome.storage.local.remove(["token", "name"]);
}
