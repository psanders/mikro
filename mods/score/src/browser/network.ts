/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Observes the page's own fetch/XHR responses (MAIN world, installed at
 * document_start before the portal's scripts run). Read-only: the extension
 * never sends requests to the portals.
 */
type Listener = { match: (url: string) => boolean; onText: (url: string, text: string) => void };

const listeners: Listener[] = [];
let installed = false;

function notify(url: string, text: string) {
  for (const l of listeners) {
    if (!l.match(url)) continue;
    try {
      l.onText(url, text);
    } catch (e) {
      console.warn("[mikro-decision] listener failed", e);
    }
  }
}

function install() {
  if (installed) return;
  installed = true;
  const matches = (url: string) => listeners.some((l) => l.match(url));

  const origFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const res = await origFetch.apply(this, args);
    const input = args[0];
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (res.ok && matches(url))
      res
        .clone()
        .text()
        .then(
          (t) => notify(url, t),
          () => {}
        );
    return res;
  };

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;
  type Tagged = XMLHttpRequest & { __mikroUrl?: string };
  XMLHttpRequest.prototype.open = function (this: Tagged, ...args: unknown[]) {
    this.__mikroUrl = String(args[1]);
    return (xhrOpen as (...a: unknown[]) => void).apply(this, args);
  };
  XMLHttpRequest.prototype.send = function (
    this: Tagged,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const url = this.__mikroUrl ?? "";
    if (matches(url)) {
      this.addEventListener("load", () => {
        if (this.status < 200 || this.status >= 300) return;
        notify(
          url,
          this.responseType === "json" ? JSON.stringify(this.response) : this.responseText
        );
      });
    }
    return xhrSend.call(this, body);
  };
}

export function watchResponses(
  match: (url: string) => boolean,
  onText: (url: string, text: string) => void
): void {
  listeners.push({ match, onText });
  install();
}
