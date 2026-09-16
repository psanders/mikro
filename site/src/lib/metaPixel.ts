/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
// Dataset "Mikro Website" (a web pixel). The previous hardcoded id,
// 855164374153518, was the "Mikro" app dataset: fbevents.js accepted it and
// /tr/ returned 200, but Meta dropped every event server-side, so the dataset
// never recorded a single hit. Injected at build time from the
// VITE_META_PIXEL_ID secret; unset locally so dev never reaches the dataset.
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export function initMetaPixel() {
  if (!PIXEL_ID || window.fbq) return;

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", PIXEL_ID);
}

export function trackPageView() {
  window.fbq?.("track", "PageView");
}

// Top of the credit funnel: the applicant opened the form. Lead below is the
// conversion campaigns optimize against.
export function trackViewContent() {
  window.fbq?.("track", "ViewContent", { content_name: "solicitud" });
}

// Never pass form data here: applicant PII must not reach Meta.
export function trackLead() {
  window.fbq?.("track", "Lead");
}
