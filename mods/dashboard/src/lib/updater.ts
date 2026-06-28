/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Desktop auto-update. On launch — and once an hour thereafter, so long-running
 * sessions don't miss releases — the app asks the apiserver manifest endpoint
 * whether a newer signed build exists. If so it prompts (native dialog); on
 * confirmation it downloads, installs, and relaunches. No-ops outside Tauri
 * (the web build), so it's safe to mount unconditionally. The Tauri plugins are
 * imported dynamically so their code stays out of the web bundle.
 */
import { useEffect, useRef } from "react";

/** How often to re-check while the app stays open. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Run one check-and-maybe-install pass. `declinedVersion` carries the version
 * the user already said "Después" to this session, so the hourly timer doesn't
 * nag them about the same build repeatedly.
 */
async function runUpdateCheck(declinedVersion: { current: string | null }): Promise<void> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return;
  if (declinedVersion.current === update.version) return;

  const { ask } = await import("@tauri-apps/plugin-dialog");
  const accepted = await ask(
    `La versión ${update.version} está disponible. ¿Deseas actualizar ahora? ` +
      `La aplicación se reiniciará para aplicar la actualización.`,
    {
      title: "Actualización disponible",
      kind: "info",
      okLabel: "Actualizar",
      cancelLabel: "Después"
    }
  );

  if (!accepted) {
    declinedVersion.current = update.version;
    return;
  }

  await update.downloadAndInstall();
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

/**
 * Mount-once hook that wires up the launch check + hourly re-check. Render it
 * from a component inside the app tree (see {@link AppUpdater}).
 */
export function useAppUpdater(): void {
  const inFlight = useRef(false);
  const declinedVersion = useRef<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    const tick = async () => {
      // Skip if a previous pass (e.g. a slow download) is still running.
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        if (!cancelled) await runUpdateCheck(declinedVersion);
      } catch (err) {
        // Never surface update failures to the operator; just log them.
        console.error("auto-update check failed", err);
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
}
