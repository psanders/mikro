/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Background worker: the only context that talks to the Mikro API, with the
 * evaluator's token. An expired token is cleared, so the panel shows the login
 * again (like the dashboard does on a 401).
 */
import type { ApiRequest } from "./protocol.js";
import { callApi } from "./api.js";
import { getSession, login, logout } from "./session.js";

type Message =
  | ApiRequest
  | { type: "open-options" }
  | { type: "login"; phone: string; password: string }
  | { type: "logout" }
  | { type: "whoami" };

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  if (msg.type === "open-options") {
    void chrome.runtime.openOptionsPage();
    return false;
  }
  void (async () => {
    if (msg.type === "login") return sendResponse(await login(msg.phone, msg.password));
    if (msg.type === "logout") return sendResponse(await logout());
    const session = await getSession();
    if (msg.type === "whoami") return sendResponse({ name: session.token ? session.name : null });
    if (!session.token) {
      return sendResponse({ ok: false, code: "NO_SESSION", message: "Inicia sesión en Mikro" });
    }
    const res = await callApi(session.apiUrl, session.token, msg);
    if (!res.ok && res.code === "UNAUTHORIZED") await logout();
    sendResponse(res);
  })();
  return true; // async response
});
