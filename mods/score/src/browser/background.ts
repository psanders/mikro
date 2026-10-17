/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Background worker: the only context that talks to the Mikro API, with the
 * evaluator's token (host permission for that server only, granted on login).
 */
import type { ApiRequest } from "./protocol.js";
import { callApi, settings } from "./api.js";

chrome.runtime.onMessage.addListener(
  (msg: ApiRequest | { type: "open-options" }, _sender, sendResponse) => {
    if (msg.type === "open-options") {
      void chrome.runtime.openOptionsPage();
      return false;
    }
    if (msg.type !== "api") return false;
    void (async () => {
      const { apiUrl, token } = await settings();
      if (!apiUrl || !token) {
        sendResponse({ ok: false, code: "NO_SESSION", message: "Inicia sesión en Mikro" });
        return;
      }
      sendResponse(await callApi(apiUrl, token, msg));
    })();
    return true; // async response
  }
);
