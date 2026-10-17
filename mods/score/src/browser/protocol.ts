/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Messages between the three extension contexts:
 *   page script (MAIN world: captures the portal's data) → window.postMessage →
 *   content script (draws the panel) → chrome.runtime.sendMessage →
 *   background worker (calls the Mikro API with the evaluator's token).
 */
import type { CreditReportPush } from "../facts/schema.js";

export const SOURCE_TAG = "mikro-decision";

export type PageMessage =
  | {
      source: typeof SOURCE_TAG;
      type: "lookup-started";
      portal: "EQUIFAX" | "PRESTAMOSCLOUD";
      cedula: string | null;
    }
  | { source: typeof SOURCE_TAG; type: "progress"; loaded: number; total: number }
  | { source: typeof SOURCE_TAG; type: "facts"; push: CreditReportPush }
  | { source: typeof SOURCE_TAG; type: "error"; message: string };

/** A page message without its source tag (distributes over the union). */
export type PageEvent = PageMessage extends infer M
  ? M extends PageMessage
    ? Omit<M, "source">
    : never
  : never;

/** Page script → content script (same window, same origin only). */
export function postToPanel(m: PageEvent): void {
  window.postMessage({ source: SOURCE_TAG, ...m }, window.location.origin);
}

export type ApiRequest = {
  type: "api";
  kind: "query" | "mutation";
  path: string;
  input: unknown;
};

export type ApiResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; code: "NO_SESSION" | "NO_PERMISSION" | "UNAUTHORIZED" | "ERROR"; message: string };

export function isPageMessage(data: unknown): data is PageMessage {
  return !!data && typeof data === "object" && (data as { source?: string }).source === SOURCE_TAG;
}

/** SHA-256 (hex) of the raw responses the facts came from. */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

declare const __MIKRO_VERSION__: string;
export const ADAPTER_VERSION = typeof __MIKRO_VERSION__ === "string" ? __MIKRO_VERSION__ : "dev";

/* ───────── What the API returns to the panel (mirror of apiserver getCreditPanel) ───────── */

export interface PanelDecision {
  outcome: "REJECT" | "REVIEW" | "APPROVE";
  mikroScore: number | null;
  reasons: { code: string; message: string }[];
  components: {
    id: string;
    label: string;
    raw: number | null;
    mapped: number | null;
    used: boolean;
  }[];
  unchecked: { rule: string; reason: string; message: string; outcome: "REJECT" | "REVIEW" }[];
  nextSteps: { id: string; label: string; cost: number; couldChange: boolean }[];
  policyVersion: string;
}

export interface PanelData {
  cedula: string;
  application: {
    id: string;
    name: string;
    requestedAmount: number | null;
    requestedTermWeeks: number | null;
    status: string;
    assigneeName: string | null;
    isMine: boolean;
    reviewerRecommendation: string | null;
    evidence: { complete: boolean; missing: string[] };
  } | null;
  decision: PanelDecision | null;
  previousScore: number | null;
  actions: {
    take: boolean;
    reject: boolean;
    hardNoReason: string | null;
    recommend: boolean;
    sendBlockedBy: string[];
  };
  lastReports: { source: string; capturedAt: string }[];
}
