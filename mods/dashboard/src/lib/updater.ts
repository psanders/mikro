/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Desktop auto-update. On launch — and once an hour thereafter, so long-running
 * sessions don't miss releases — the app asks the apiserver manifest endpoint
 * whether a newer signed build exists. If so it downloads and installs it
 * **silently in the background** (no blocking prompt), then surfaces a
 * dismissible banner: the update is staged and applies the next time the app is
 * opened, with a "restart now" affordance. Nothing interrupts the operator
 * mid-task and no forced relaunch yanks the window out from under them.
 *
 * On macOS `downloadAndInstall()` swaps the bundle in place; the new version
 * takes effect on next launch, so staging + an optional user-driven relaunch is
 * all that's needed. No-ops outside Tauri (the web build), so it's safe to mount
 * unconditionally. The Tauri plugins are imported dynamically so their code
 * stays out of the web bundle.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** How often to re-check while the app stays open. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Local escape hatch for testing a Tauri build against a dev apiserver: the
// updater targets a fixed production endpoint baked into the compiled app,
// independent of whichever apiserver is running locally, so a real staged
// release can legitimately swap the bundle and relaunch mid-session — which
// looks exactly like an unrelated crash while testing something else. Set
// VITE_DISABLE_AUTO_UPDATE=1 in the dashboard's .env to skip it entirely.
const isDisabledForTesting = (): boolean => import.meta.env.VITE_DISABLE_AUTO_UPDATE === "1";

export interface AppUpdaterState {
  /**
   * Version that has been downloaded + installed and is waiting to apply on the
   * next launch. `null` while none is staged.
   */
  readyVersion: string | null;
  /** Relaunch now to apply the staged update immediately. */
  restart: () => void;
}

/**
 * Run one check-and-stage pass. Returns the version that was just installed and
 * is now pending a relaunch, or `null` when there's nothing new. `staged`
 * carries the version already installed this session so the hourly timer doesn't
 * re-download it.
 */
async function stageUpdate(staged: { current: string | null }): Promise<string | null> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return null;
  if (staged.current === update.version) return null;

  // Download + install in place, silently. The new version applies on next
  // launch; we deliberately do NOT relaunch here.
  await update.downloadAndInstall();
  staged.current = update.version;
  return update.version;
}

/**
 * Mount-once hook that wires up the launch check + hourly re-check and exposes
 * the staged-update state. Render it from a component inside the app tree (see
 * {@link AppUpdater}).
 */
export function useAppUpdater(): AppUpdaterState {
  const inFlight = useRef(false);
  const staged = useRef<string | null>(null);
  const [readyVersion, setReadyVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri() || isDisabledForTesting()) return;

    let cancelled = false;
    const tick = async () => {
      // Skip if a pass is still running, or an update is already staged — once
      // installed there's nothing to gain from re-downloading it.
      if (inFlight.current || staged.current) return;
      inFlight.current = true;
      try {
        const version = await stageUpdate(staged);
        if (version && !cancelled) setReadyVersion(version);
      } catch (err) {
        // Staging is best-effort; a failed pass just retries on the next tick.
        console.error("auto-update failed", err);
      } finally {
        inFlight.current = false;
      }
    };

    void tick();
    const id = setInterval(() => void tick(), CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const restart = useCallback(() => {
    void (async () => {
      try {
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      } catch (err) {
        console.error("relaunch failed", err);
      }
    })();
  }, []);

  return { readyVersion, restart };
}
