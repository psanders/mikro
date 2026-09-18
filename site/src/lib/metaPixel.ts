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

// Never pass form data here. The browser sends no applicant data at all; the
// hashed identifiers Meta matches on are sent server-side instead, from the
// application intake endpoint (see createSendLeadConversion).
//
// `eventId` is the same id posted to the server with the application. Meta uses
// it to collapse this browser event and the server event into one conversion.
// Without it the same lead counts twice and cost per lead reads about half its
// real value, so the caller must always supply one.
export function trackLead(eventId: string) {
  window.fbq?.("track", "Lead", {}, { eventID: eventId });
}

/**
 * A coarser, higher-volume signal than `Lead`: fired every time an applicant
 * finishes one section of the form, whether or not they ever submit. At this
 * budget `Lead` volume is thin — Meta may learn faster optimizing toward
 * "reached section 3" as a custom conversion instead (see the rebuild plan).
 *
 * Same rule as `trackLead`: never pass applicant data, only the section depth.
 */
export function trackCustom(eventName: string, params: Record<string, string | number> = {}) {
  window.fbq?.("trackCustom", eventName, params);
}

/**
 * Reads the Meta cookies the browser owns so they can travel with the server
 * event: `_fbc` carries the ad click id (set when someone arrives with `fbclid`)
 * and `_fbp` identifies the browser. They are the difference between an event
 * Meta can attribute to an ad and one it cannot, and the server has no other way
 * to see them.
 */
export function readFbCookies(): { fbp: string | null; fbc: string | null } {
  const read = (name: string): string | null => {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  };
  return { fbp: read("_fbp"), fbc: read("_fbc") };
}

/**
 * A fresh id for one conversion, shared by the browser and server copies of the
 * event. `randomUUID` needs a secure context; the fallback keeps older or
 * insecure-origin browsers from losing their lead entirely.
 */
export function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `lead-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
