/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  evaluateRenewalTransition,
  type LoanRenewalStatus,
  type RenewalAction,
  type RenewalTransitionContext,
  type RenewalTransitionInput
} from "@mikro/common/schemas";
import type { Viewer } from "../applications/useViewer";
import type { RouterOutputs } from "../../lib/trpc";

export type RenewalData = RouterOutputs["getLoanRenewal"];
export type RenewalQuoteData = RouterOutputs["getLoanRenewalQuote"];

export type RenewalTab = "terminos" | "contrato" | "documentos" | "finalizar";

/** Which tab a renewal opens on: where the next step is. */
export function defaultTab(status: string): RenewalTab {
  switch (status) {
    case "CONTRACT_READY":
      return "contrato";
    case "SIGNED":
    case "COMPLETED":
      return "finalizar";
    default:
      return "terminos";
  }
}

export interface Can {
  ok: boolean;
  /** Spanish reason when blocked (see RENEWAL_BLOCK_LABELS_ES). */
  reason?: string;
}

/**
 * Whether the viewer may do `action` right now — the SAME function the server
 * enforces, with caller-input blocks ignored so a button is clickable before the
 * net is confirmed (the panel enforces that on submit).
 */
export function canDo(
  renewal: RenewalData,
  viewer: Viewer | null,
  action: RenewalAction,
  input: RenewalTransitionInput = {},
  ctx: RenewalTransitionContext = {}
): Can {
  if (!viewer) return { ok: false };
  const r = evaluateRenewalTransition(
    { status: renewal.status as LoanRenewalStatus, contractFilename: renewal.contractFilename },
    action,
    viewer,
    input,
    { oldLoanActive: renewal.loan.status === "ACTIVE", ...ctx },
    { ignoreInput: true }
  );
  return r.ok ? { ok: true } : { ok: false, reason: r.reason };
}

export const isOpen = (status: string) =>
  status === "DRAFT" || status === "CONTRACT_READY" || status === "SIGNED";
