/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import { IS_E2E } from "../e2e";

const HEALTH_URL = `${process.env.EXPO_PUBLIC_API_URL}/health`;
const POLL_INTERVAL = 10_000;
const PING_TIMEOUT = 5_000;

async function ping(): Promise<boolean> {
  // E2E builds have no backend (tRPC is served by e2eMockLink), so there is
  // nothing to ping; they count as online so online-only screens render.
  if (IS_E2E) return true;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT);
    const res = await fetch(HEALTH_URL, { method: "GET", signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    setIsOnline(await ping());
  }, []);

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, POLL_INTERVAL);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [check]);

  return { isOnline };
}
