/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Presentational types for the copilot dock. The thread renders a union of
 * message kinds; pages/wiring map the tRPC copilot response onto these so the
 * dock and its stories stay independent of the wire schema. Only the shared
 * `CopilotPendingAction` / `CopilotProvenance` / `WatchRuleMetric` types come
 * from "@mikro/common/schemas" — never the root barrel (breaks the Vite bundle).
 */
import type {
  CopilotPendingAction,
  CopilotProvenance,
  WatchRuleMetric
} from "@mikro/common/schemas";

export type { CopilotPendingAction, CopilotProvenance, WatchRuleMetric };

export type WatchRuleComparator = "gt" | "lt";

/** Lifecycle of a proposed write, mirrored by the confirm card's visual state. */
export type PendingActionState = "pending" | "confirmed" | "rejected" | "expired";

/** A watch rule as the rule card renders it (subset of the wire shape). */
export interface CopilotRule {
  id: string;
  name: string;
  metric: WatchRuleMetric;
  comparator: WatchRuleComparator;
  threshold: number;
  /** Defaults to true; the disabled variant renders muted with an "Activar" toggle. */
  enabled?: boolean;
}

export interface UserMessage {
  kind: "user";
  id: string;
  text: string;
}

export interface AssistantTextMessage {
  kind: "assistant";
  id: string;
  text: string;
  provenance?: CopilotProvenance;
}

export interface PendingActionMessage {
  kind: "pendingAction";
  id: string;
  action: CopilotPendingAction;
  state: PendingActionState;
  provenance?: CopilotProvenance;
}

export interface RuleMessage {
  kind: "rule";
  id: string;
  rule: CopilotRule;
  /** Optional evaluation note shown in the card body (e.g. "ninguna ruta la supera"). */
  note?: string;
  provenance?: CopilotProvenance;
}

export type ContractFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

/** A customer as the contract form's picker lists it (subset of the row). */
export interface ContractCustomer {
  id: string;
  name: string;
  phone: string;
  idNumber: string;
  /** Shown read-only as the "Reside en" hint; sourced from homeAddress. */
  homeAddress?: string;
}

/** The values the contract form submits to `generateCustomerContract`. */
export interface ContractFormValues {
  customerId: string;
  gender: "M" | "F";
  principal: number;
  installments: number;
  frequency: ContractFrequency;
  installmentAmount: number;
  /** ISO date (yyyy-mm-dd from the date input). */
  startDate: string;
  maritalStatus?: string;
  occupation?: string;
}

/** Lifecycle of the form card's generate action. */
export type ContractFormStatus = "idle" | "generating" | "done" | "error";

export interface ContractFormMessage {
  kind: "contractForm";
  id: string;
  /** Optional name/phone the founder named, to pre-seed the picker search. */
  customerHint?: string;
  provenance?: CopilotProvenance;
}

export type CopilotMessage =
  | UserMessage
  | AssistantTextMessage
  | PendingActionMessage
  | RuleMessage
  | ContractFormMessage;

export type CapabilityVerb = "CONSULTAR" | "ACTUAR" | "VIGILAR" | "AUDITAR";

/** A single suggestion chip: the visible label doubles as the prompt to send. */
export interface CapabilityChip {
  label: string;
  /** Prompt emitted to onPick — defaults to `label` when omitted. */
  prompt?: string;
}

export interface CapabilityGroup {
  verb: CapabilityVerb;
  chips: CapabilityChip[];
}
