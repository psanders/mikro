/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Headless component that stamps "Mikro v<version>" into the desktop window
 * title, so the installed build is visible at a glance (handy for confirming an
 * auto-update landed). Renders nothing and no-ops on the web build.
 */
import { useEffect } from "react";
import { useAppVersion } from "../lib/version";

const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function WindowTitle(): null {
  const version = useAppVersion();

  useEffect(() => {
    if (!isTauri() || !version) return;
    let active = true;
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        if (active) await getCurrentWindow().setTitle(`Mikro v${version}`);
      } catch (err) {
        // Non-fatal: keep the static "Mikro" title if setTitle is unavailable.
        console.error("failed to set window title", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [version]);

  return null;
}
