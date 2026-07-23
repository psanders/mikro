/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared state/constants for the feed's filter bar (`FilterBar` +
 * `FilterPopup`) — the Tipo taxonomy, date-range presets, the committed
 * filter value shape, and its `localStorage` persistence (issue #131:
 * filter selections are remembered across sessions, defaulting to Hoy).
 */
import type { BusinessEventType } from "@mikro/common";
import { readJSON, writeJSON } from "../../lib/localStorageJson";
import { ALERT_EVENT_TYPES } from "./types";

export interface FeedTypeGroup {
  id: string;
  label: string;
  types: BusinessEventType[];
}

/** Same six groupings the feed's old type pills used — now multi-selectable. */
export const FEED_TYPE_GROUPS: FeedTypeGroup[] = [
  { id: "pagos", label: "Pagos", types: ["payment.collected", "payment.reversed"] },
  { id: "contratos", label: "Contratos", types: ["application.signed", "application.converted"] },
  {
    id: "decisiones",
    label: "Decisiones",
    types: ["application.approved", "application.rejected"]
  },
  { id: "alertas", label: "Alertas", types: ALERT_EVENT_TYPES },
  {
    id: "tareas",
    label: "Tareas",
    types: ["task.due", "task.needs_input", "task.completed", "task.failed"]
  },
  { id: "mensajes", label: "Mensajes", types: ["message.sent"] }
];

export type FeedDatePreset = "hoy" | "7d" | "30d" | "custom";

export const DATE_PRESET_LABELS: Record<FeedDatePreset, string> = {
  hoy: "Hoy",
  "7d": "7d",
  "30d": "30d",
  custom: "Personalizado"
};

/** The feed's committed (applied) filter state. */
export interface FeedFilterValue {
  /** Selected `FEED_TYPE_GROUPS` ids. Empty = Todo (unfiltered). */
  typeIds: string[];
  actorId?: string;
  preset: FeedDatePreset;
  /** ISO date (yyyy-mm-dd), only meaningful when `preset === "custom"`. */
  from: string;
  to: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Default state: Tipo Todo, Actor Todos, Rango de fechas Hoy (issue #131). */
export function defaultFeedFilterValue(now: Date = new Date()): FeedFilterValue {
  const today = isoDate(now);
  return { typeIds: [], actorId: undefined, preset: "hoy", from: today, to: today };
}

/**
 * Resolves a filter value's `preset`/`from`/`to` into concrete query bounds.
 * The rolling presets (`hoy`/`7d`/`30d`) deliberately return `to: undefined`
 * — a concrete "up to now" bound would freeze at whatever instant this ran
 * and then silently exclude every event recorded after it. That's what made
 * the feed need a manual re-navigation to show new events (issue #223): no
 * event can have `occurredAt` in the future, so "no upper bound" and "up to
 * now" mean the same thing, and only the former survives a poll tick without
 * changing the query key (and re-triggering the loading state). Only
 * `custom` has a real, user-chosen end date worth bounding.
 */
export function resolveDateRange(
  value: FeedFilterValue,
  now: Date = new Date()
): { from: Date; to: Date | undefined } {
  switch (value.preset) {
    case "hoy": {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from, to: undefined };
    }
    case "7d":
      return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: undefined };
    case "30d":
      return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: undefined };
    case "custom":
    default: {
      const from = new Date(`${value.from}T00:00:00`);
      const customTo = new Date(`${value.to}T23:59:59.999`);
      return { from, to: customTo };
    }
  }
}

/** Resolves selected group ids into the flat `types` array `listFeedEvents` expects. */
export function resolveTypes(value: FeedFilterValue): BusinessEventType[] | undefined {
  if (value.typeIds.length === 0) return undefined;
  const groups = FEED_TYPE_GROUPS.filter((g) => value.typeIds.includes(g.id));
  return groups.flatMap((g) => g.types);
}

const STORAGE_KEY = "founder-feed-filters";

function isStoredFeedFilters(value: unknown): value is Partial<FeedFilterValue> {
  const v = value as Partial<FeedFilterValue> | null;
  return Array.isArray(v?.typeIds) && typeof v?.preset === "string";
}

/** Reads the remembered filter preference; falls back to the default on any parse failure. */
export function loadStoredFeedFilters(): FeedFilterValue {
  const parsed = readJSON(STORAGE_KEY, isStoredFeedFilters);
  if (!parsed) return defaultFeedFilterValue();
  return {
    typeIds: parsed.typeIds!,
    actorId: parsed.actorId,
    preset: parsed.preset as FeedDatePreset,
    from: parsed.from ?? defaultFeedFilterValue().from,
    to: parsed.to ?? defaultFeedFilterValue().to
  };
}

export function storeFeedFilters(value: FeedFilterValue): void {
  writeJSON(STORAGE_KEY, value);
}

export function isFeedFilterActive(value: FeedFilterValue): boolean {
  return value.typeIds.length > 0 || Boolean(value.actorId) || value.preset !== "hoy";
}
