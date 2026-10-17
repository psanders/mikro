/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Options page: the same login as the Ops dashboard (and the panel). The
 * Mikro server is built in; "Avanzado" lets a developer point at another one.
 */
import { BUILT_IN_API_URL, formatPhone, getSession, login, logout } from "./session.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function refresh() {
  const s = await getSession();
  $("signed-out").hidden = !!s.token;
  $("signed-in").hidden = !s.token;
  $("who").textContent = s.name ? `Como ${s.name} · ${new URL(s.apiUrl).host}` : "";
  $("builtin").textContent = BUILT_IN_API_URL;
  const { apiUrl } = (await chrome.storage.local.get(["apiUrl"])) as { apiUrl?: string };
  $<HTMLInputElement>("apiUrl").value = apiUrl ?? "";
}

$<HTMLInputElement>("phone").addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement;
  el.value = formatPhone(el.value);
});

$("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submit = $<HTMLButtonElement>("submit");
  const error = $("error");
  submit.disabled = true;
  submit.textContent = "Entrando…";
  error.hidden = true;
  const r = await login($<HTMLInputElement>("phone").value, $<HTMLInputElement>("password").value);
  submit.disabled = false;
  submit.textContent = "Iniciar sesión";
  if (!r.ok) {
    error.textContent = r.message;
    error.hidden = false;
    return;
  }
  $<HTMLInputElement>("password").value = "";
  await refresh();
});

$("logout").addEventListener("click", async () => {
  await logout();
  await refresh();
});

$("saveUrl").addEventListener("click", async () => {
  const raw = $<HTMLInputElement>("apiUrl").value.trim().replace(/\/+$/, "");
  const status = $("urlStatus");
  if (!raw) {
    await chrome.storage.local.remove(["apiUrl", "token", "name"]);
    status.textContent = "Usando el servidor de Mikro. Inicia sesión de nuevo.";
    return refresh();
  }
  const origin = new URL(raw).origin;
  if (!(await chrome.permissions.request({ origins: [`${origin}/*`] }))) {
    status.textContent = "Chrome necesita permiso para conectarse a ese servidor.";
    return;
  }
  await chrome.storage.local.set({ apiUrl: raw });
  await chrome.storage.local.remove(["token", "name"]);
  status.textContent = "Servidor guardado. Inicia sesión de nuevo.";
  await refresh();
});

void refresh();
