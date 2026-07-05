/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Single source of the running app version for the UI. On the desktop build the
 * authoritative value comes from Tauri at runtime (`getVersion`, stamped from
 * the release tag in CI), so it always reflects the *installed* build — useful
 * for confirming an auto-update actually landed. On the web build there is no
 * such source, so it falls back to `__APP_VERSION__` baked in by Vite.
 */
import { useEffect, useState } from "react";

const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Module-level cache so multiple callers (window title + profile menu) share a
// single async fetch. `undefined` = not resolved yet.
let cached: string | undefined;

function webVersion(): string {
  return typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";
}

/** Running app version (e.g. "1.22.0"), or `""` until resolved. */
export function useAppVersion(): string {
  const [version, setVersion] = useState<string>(cached ?? "");

  useEffect(() => {
    if (cached !== undefined) {
      setVersion(cached);
      return;
    }
    if (!isTauri()) {
      cached = webVersion();
      setVersion(cached);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        cached = await getVersion();
      } catch {
        // Fall back to the build-time version if the Tauri API is unavailable.
        cached = webVersion();
      }
      if (active) setVersion(cached);
    })();
    return () => {
      active = false;
    };
  }, []);

  return version;
}
