/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * Token-store seam for the dashboard. Backed by `localStorage` on web; the async
 * signatures mirror the mobile app's `expo-secure-store` store so a Tauri secure
 * store (also async) can replace this without touching call sites.
 */
const TOKEN_KEY = "mikro_jwt";
const NAME_KEY = "mikro_user_name";

export async function getToken(): Promise<string | null> {
  return localStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  localStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  localStorage.removeItem(TOKEN_KEY);
}

export async function getUserName(): Promise<string | null> {
  return localStorage.getItem(NAME_KEY);
}

export async function setUserName(name: string): Promise<void> {
  localStorage.setItem(NAME_KEY, name);
}

export async function clearUserName(): Promise<void> {
  localStorage.removeItem(NAME_KEY);
}
