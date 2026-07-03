/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import * as SecureStore from "expo-secure-store";
import type { Role } from "@mikro/common/schemas";

const TOKEN_KEY = "mikro_jwt";
const PIN_KEY = "mikro_pin";
const NAME_KEY = "mikro_user_name";
const ROLES_KEY = "mikro_user_roles";

/** Shape of the JWT payload issued by `createLogin` (mods/apiserver). */
interface JwtPayload {
  sub?: string;
  phone?: string;
  roles?: Role[];
  iat?: number;
  exp?: number;
}

/**
 * Decodes the payload segment of a JWT without verifying its signature.
 * Client-side role checks are UX routing only — `reviewerProcedure` on the
 * server remains the real authorization boundary. Returns `null` when the
 * token is malformed or the payload can't be parsed as JSON.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = base64Decode(padded);
    const payload = JSON.parse(json) as unknown;

    if (typeof payload !== "object" || payload === null) return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

/** Extracts the `roles` claim from a JWT. Returns an empty array if absent or malformed. */
export function decodeRolesFromToken(token: string): Role[] {
  const payload = decodeJwtPayload(token);
  if (!payload || !Array.isArray(payload.roles)) return [];
  return payload.roles;
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Manual base64 -> UTF-8 string decode, since `atob`/`Buffer` aren't reliably available in Hermes. */
function base64Decode(input: string): string {
  const clean = input.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return utf8BytesToString(bytes);
}

/** Decodes a UTF-8 byte sequence into a JS string (handles multi-byte characters). */
function utf8BytesToString(bytes: number[]): string {
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i++];
    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1);
    } else if (byte1 >> 5 === 0x06) {
      const byte2 = bytes[i++];
      result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
    } else if (byte1 >> 4 === 0x0e) {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      result += String.fromCharCode(
        ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f)
      );
    } else {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      const byte4 = bytes[i++];
      const codepoint =
        ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
      result += String.fromCodePoint(codepoint);
    }
  }
  return result;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/** Persists the token and decodes+caches its `roles` claim alongside it. */
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  const roles = decodeRolesFromToken(token);
  await SecureStore.setItemAsync(ROLES_KEY, JSON.stringify(roles));
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(ROLES_KEY);
}

/**
 * Returns the roles decoded at login/token-set time. Cached in secure storage
 * alongside the token so navigation can read it on PIN unlock / app resume
 * without re-decoding on every render.
 */
export async function getRoles(): Promise<Role[]> {
  const raw = await SecureStore.getItemAsync(ROLES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Role[]) : [];
  } catch {
    return [];
  }
}

/** True when roles include REVIEWER or ADMIN — the evaluator surface. */
export function hasEvaluatorRole(roles: Role[]): boolean {
  return roles.includes("REVIEWER") || roles.includes("ADMIN");
}

/**
 * True when a user may see payment data (balances, collection history) or
 * trigger a collection (the "Cobrar" flow). REVIEWER-only accounts must not:
 * client-side check for UI purposes, mirrored server-side by
 * `collectorProcedure` on the payment endpoints and by `collectorSync`
 * stripping payment history from the offline snapshot (mikro/#73).
 */
export function canManagePayments(roles: Role[]): boolean {
  return roles.includes("COLLECTOR") || roles.includes("ADMIN");
}

/**
 * True when a user should see the Collector/Reviewer mode switch: either
 * they hold both COLLECTOR and an evaluator role, or they're ADMIN (who has
 * server-side access to both surfaces — `getCollectorDashboard` uses
 * `protectedProcedure`, not a role guard — even without an explicit
 * COLLECTOR row). See mikro/#70.
 */
export function isDualRole(roles: Role[]): boolean {
  return (roles.includes("COLLECTOR") || roles.includes("ADMIN")) && hasEvaluatorRole(roles);
}

/**
 * Human label for the role currently active on screen. For dual-role users
 * this tracks `navMode` so the label matches whichever screens are actually
 * rendered (see mikro/#70); ADMIN outranks REVIEWER when both are present.
 */
export function activeRoleLabel(roles: Role[], navMode: NavMode, dual: boolean): string {
  if (dual && navMode === "collector") return "Cobrador";
  if (roles.includes("ADMIN")) return "Administrador";
  if (roles.includes("REVIEWER")) return "Evaluador";
  return "Cobrador";
}

export async function getPin(): Promise<string | null> {
  return SecureStore.getItemAsync(PIN_KEY);
}

export async function setPin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
}

export async function getUserName(): Promise<string | null> {
  return SecureStore.getItemAsync(NAME_KEY);
}

export async function setUserName(name: string): Promise<void> {
  await SecureStore.setItemAsync(NAME_KEY, name);
}

export async function clearUserName(): Promise<void> {
  await SecureStore.deleteItemAsync(NAME_KEY);
}

export type NavMode = "evaluator" | "collector";

const NAV_MODE_KEY = "mikro_nav_mode";

/**
 * Manual collector/evaluator navigation preference for dual-role users
 * (COLLECTOR + REVIEWER/ADMIN). Only meaningful for dual-role accounts —
 * single-role users are routed purely by `hasEvaluatorRole`/role checks and
 * never read this. Defaults to "evaluator" per design.md when unset.
 */
export async function getNavMode(): Promise<NavMode> {
  const raw = await SecureStore.getItemAsync(NAV_MODE_KEY);
  return raw === "collector" ? "collector" : "evaluator";
}

export async function setNavMode(mode: NavMode): Promise<void> {
  await SecureStore.setItemAsync(NAV_MODE_KEY, mode);
}

export async function clearNavMode(): Promise<void> {
  await SecureStore.deleteItemAsync(NAV_MODE_KEY);
}
