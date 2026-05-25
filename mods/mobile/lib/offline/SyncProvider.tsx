/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode
} from "react";
import { Alert, AppState } from "react-native";
import { useNetworkStatus } from "./useNetworkStatus";
import { useSyncState } from "./useSyncState";
import { pullSync, type PullSyncResult } from "./syncPull";
import { pushSync, type PushSyncResult } from "./syncPush";
import { createApiClient } from "../trpc";

const AUTO_PULL_STALE_MS = 5 * 60 * 1000;

interface SyncContextValue {
  isOnline: boolean;
  lastPullAt: string | null;
  pendingCount: number;
  pendingBreakdown: { payments: number; notes: number };
  customerCount: number;
  loanCount: number;
  isPulling: boolean;
  isPushing: boolean;
  pull: () => Promise<PullSyncResult | null>;
  push: () => Promise<PushSyncResult | null>;
  refreshState: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { isOnline } = useNetworkStatus();
  const syncState = useSyncState();
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const pullingRef = useRef(false);
  const pushingRef = useRef(false);

  const doPull = useCallback(
    async (silent: boolean): Promise<PullSyncResult | null> => {
      if (pullingRef.current) return null;
      pullingRef.current = true;
      setIsPulling(true);
      try {
        const api = createApiClient();
        const result = await pullSync(api);
        syncState.refresh();
        return result;
      } catch (err: unknown) {
        if (!silent) {
          const message = err instanceof Error ? err.message : "Error desconocido";
          Alert.alert("Error de sincronización", `No se pudo recibir datos: ${message}`);
        }
        return null;
      } finally {
        pullingRef.current = false;
        setIsPulling(false);
      }
    },
    [syncState]
  );

  const doPush = useCallback(
    async (silent: boolean): Promise<PushSyncResult | null> => {
      if (pushingRef.current) return null;
      pushingRef.current = true;
      setIsPushing(true);
      try {
        const api = createApiClient();
        const result = await pushSync(api);
        syncState.refresh();
        if (!silent && result.failed > 0) {
          Alert.alert(
            "Sincronización parcial",
            `${result.succeeded} enviados, ${result.failed} fallaron. Revisa la pantalla de sincronización.`
          );
        }
        return result;
      } catch (err: unknown) {
        if (!silent) {
          const message = err instanceof Error ? err.message : "Error desconocido";
          Alert.alert("Error de sincronización", `No se pudo enviar cambios: ${message}`);
        }
        return null;
      } finally {
        pushingRef.current = false;
        setIsPushing(false);
      }
    },
    [syncState]
  );

  const pull = useCallback(() => doPull(false), [doPull]);
  const push = useCallback(() => doPush(false), [doPush]);

  const lastPullRef = useRef(syncState.lastPullAt);
  lastPullRef.current = syncState.lastPullAt;
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const doPullRef = useRef(doPull);
  doPullRef.current = doPull;
  const doPushRef = useRef(doPush);
  doPushRef.current = doPush;

  // Auto-pull on mount and on reconnect (offline → online)
  const wasOnlineRef = useRef(false);
  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (!isOnline) return;
    if (!wasOnline) {
      doPullRef.current(true);
    }
  }, [isOnline]);

  // Auto-pull when app returns to foreground if data is stale
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !isOnlineRef.current) return;
      const last = lastPullRef.current;
      const stale = !last || Date.now() - new Date(last).getTime() > AUTO_PULL_STALE_MS;
      if (stale) {
        doPullRef.current(true);
      }
    });
    return () => sub.remove();
  }, []);

  // Auto-push when online and there are pending mutations
  const autoPushScheduled = useRef(false);
  useEffect(() => {
    if (isOnline && syncState.pendingCount > 0 && !autoPushScheduled.current) {
      autoPushScheduled.current = true;
      doPushRef.current(true).finally(() => {
        autoPushScheduled.current = false;
      });
    }
  }, [isOnline, syncState.pendingCount]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        lastPullAt: syncState.lastPullAt,
        pendingCount: syncState.pendingCount,
        pendingBreakdown: syncState.pendingBreakdown,
        customerCount: syncState.customerCount,
        loanCount: syncState.loanCount,
        isPulling,
        isPushing,
        pull,
        push,
        refreshState: syncState.refresh
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error("useSyncContext must be used within SyncProvider");
  }
  return ctx;
}
