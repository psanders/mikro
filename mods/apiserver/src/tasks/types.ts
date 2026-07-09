/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The automation contract (design D1). Automations are code shipped with the
 * apiserver — a closed catalog, never user- or model-defined. A Task binds one
 * to a schedule; the worker gathers `computed` slots at fire time, the founder
 * supplies `ask` slots at confirm time, and `execute` performs the flow with
 * dependency-injected services and no LLM anywhere in the path.
 */
import type { z } from "zod/v4";
import type {
  CreateTransactionInternalInput,
  TaskGate,
  TaskSlotDescriptor,
  TaskSlotSource
} from "@mikro/common";
import type { PrismaClient } from "../generated/prisma/client.js";

/** Fire-time context handed to computed-slot resolvers and context builders. */
export interface ResolveContext {
  db: PrismaClient;
  /** The task's bound static slot values (already schema-validated). */
  staticParams: Record<string, unknown>;
  /** The period's intended due instant (may be earlier than now if fired late). */
  dueAt: Date;
  now: Date;
}

export interface SlotSpec {
  /** Spanish label shown on cards and forms. */
  label: string;
  source: TaskSlotSource;
  /** Coarse input hint for schema-driven UIs. */
  kind: TaskSlotDescriptor["kind"];
  /** Value validation — the single source of truth, re-checked at fire and confirm. */
  schema: z.ZodType;
  optional?: boolean;
  /** Deterministic resolver, required for computed slots. */
  resolve?: (ctx: ResolveContext) => Promise<unknown>;
  /**
   * For an `ask` slot: the name of a static/computed slot in this same
   * automation whose gathered value pre-fills this slot's confirm-time
   * input (still freely editable). E.g. amount's `defaultFrom:
   * "suggestedAmount"` — the founder can pin a default at creation without
   * making the slot itself non-editable per firing.
   */
  defaultFrom?: string;
}

/** Services an automation may execute through. Injected for testability. */
export interface AutomationDeps {
  db: PrismaClient;
  createTransaction: (params: CreateTransactionInternalInput) => Promise<unknown>;
  /** The confirming founder (creator attribution on written records). */
  actorId: string;
}

export interface AutomationResult {
  /** Spanish one-liner for the task.completed event summary. */
  summary: string;
  /** Denormalized onto the event row when the flow moved money. */
  amount?: number;
}

export interface Automation {
  id: string;
  /** Spanish display title. */
  title: string;
  /** Tasks may tighten the gate to confirm, never loosen below this. */
  gateFloor: TaskGate;
  params: Record<string, SlotSpec>;
  /** Optional display-only fire-time context for the feed card. */
  buildContext?: (ctx: ResolveContext) => Promise<Record<string, unknown>>;
  execute: (payload: Record<string, unknown>, deps: AutomationDeps) => Promise<AutomationResult>;
}
