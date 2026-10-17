/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Options page: the Mikro server URL and the evaluator's login. Saving asks
 * Chrome for permission to reach that server (only that origin).
 */
import { callApi, settings } from "./api.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function show(text: string, ok: boolean) {
  const s = $("status");
  s.textContent = text;
  s.className = ok ? "ok" : "err";
}

async function refresh() {
  const { apiUrl, token, name } = await settings();
  if (apiUrl) $<HTMLInputElement>("apiUrl").value = apiUrl;
  $("logout").hidden = !token;
  if (token) show(`Sesión iniciada${name ? ` como ${name}` : ""}.`, true);
}

$("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const apiUrl = $<HTMLInputElement>("apiUrl").value.trim().replace(/\/+$/, "");
  const origin = new URL(apiUrl).origin;
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) return show("Chrome necesita permiso para conectarse al servidor de Mikro.", false);
  const res = await callApi(apiUrl, undefined, {
    kind: "mutation",
    path: "login",
    input: {
      phone: $<HTMLInputElement>("phone").value,
      password: $<HTMLInputElement>("password").value
    }
  });
  if (!res.ok) return show(res.message, false);
  const { token, name } = res.data as { token: string; name: string };
  await chrome.storage.local.set({ apiUrl, token, name });
  $<HTMLInputElement>("password").value = "";
  await refresh();
});

$("logout").addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "name"]);
  show("Sesión cerrada.", true);
  await refresh();
});

void refresh();
