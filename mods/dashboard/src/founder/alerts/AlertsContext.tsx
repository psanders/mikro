/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shell-level alert state (issue #109): "Alertas" used to be just a filter
 * pill on the feed — nothing caught a triggered alert or surfaced it unless
 * someone happened to open that filter. This polls `listFeedEvents` for the
 * newest event of an alert type (`ALERT_EVENT_TYPES`) independent of whatever
 * screen is open, so the rail's "Excepciones" badge lights up as events come
 * in. `lastSeenId` persists in localStorage so the dot survives a reload and
 * clears only once the alert has actually been viewed.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { trpc } from "../../lib/trpc";
import { ALERT_EVENT_TYPES } from "../components/types";

const LAST_SEEN_STORAGE_KEY = "founder.alerts.lastSeenId";
const POLL_INTERVAL_MS = 20_000;

export interface AlertsContextValue {
  /** True once a caught alert is newer than the last one the user viewed. */
  hasUnread: boolean;
  /** Acknowledge the newest caught alert, clearing the badge. */
  markSeen: () => void;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

function readLastSeenId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_SEEN_STORAGE_KEY);
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [lastSeenId, setLastSeenId] = useState<string | null>(readLastSeenId);

  // Smallest possible poll: newest alert-type event only, admin-only route
  // already used by the feed's "Alertas" pill.
  const latestAlert = trpc.listFeedEvents.useQuery(
    { types: ALERT_EVENT_TYPES, limit: 1 },
    { refetchInterval: POLL_INTERVAL_MS, refetchOnWindowFocus: true }
  );

  const latestAlertId = latestAlert.data?.items[0]?.id ?? null;
  const hasUnread = latestAlertId !== null && latestAlertId !== lastSeenId;

  const markSeen = useCallback(() => {
    if (!latestAlertId) return;
    setLastSeenId(latestAlertId);
    window.localStorage.setItem(LAST_SEEN_STORAGE_KEY, latestAlertId);
  }, [latestAlertId]);

  const value = useMemo<AlertsContextValue>(() => ({ hasUnread, markSeen }), [hasUnread, markSeen]);

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

/** Whether an alert has been caught and not yet viewed, plus a way to clear it. */
export function useAlerts(): AlertsContextValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used within an AlertsProvider");
  return ctx;
}
