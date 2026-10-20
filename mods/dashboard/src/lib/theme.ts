/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Light/dark theme (add-dark-mode). The setting — Sistema (follow the OS),
 * Claro or Oscuro — is remembered per device; <html class="dark"> switches the
 * design tokens in index.css. Sistema follows OS changes live. On desktop the
 * native window (title bar) follows the same setting.
 */
import { useSyncExternalStore } from "react";

export type ThemeSetting = "system" | "light" | "dark";

const KEY = "mikro_theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

export function getThemeSetting(): ThemeSetting {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function isDark(setting: ThemeSetting): boolean {
  return setting === "dark" || (setting === "system" && media().matches);
}

const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// The theme last pinned on the native window; null = following the OS.
let pinnedWindowTheme: "light" | "dark" | null = null;

/**
 * Keeps the desktop window's chrome in step with the page. Claro/Oscuro pin
 * the window theme; Sistema (null) hands it back to the OS. The window
 * background is the page surface: the title bar sits on it and macOS picks the
 * title text color from it, so a fixed white left black text on a dark bar.
 */
async function applyWindowTheme(setting: ThemeSetting): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    const next = setting === "system" ? null : setting;
    if (next !== pinnedWindowTheme) {
      await win.setTheme(next);
      pinnedWindowTheme = next;
    }
    const surface = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-ds-surface")
      .trim();
    if (surface) await win.setBackgroundColor(surface);
  } catch (err) {
    // Non-fatal: the page still switches; only the title bar keeps its look.
    console.error("failed to set window theme", err);
  }
}

export function applyTheme(setting: ThemeSetting = getThemeSetting()): void {
  document.documentElement.classList.toggle("dark", isDark(setting));
  void applyWindowTheme(setting);
}

export function setThemeSetting(setting: ThemeSetting): void {
  try {
    if (setting === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, setting);
  } catch {
    /* private mode: the choice lasts for this session only */
  }
  applyTheme(setting);
  listeners.forEach((l) => l());
}

/** Applies the saved setting now and keeps "Sistema" in sync with the OS. */
export function initTheme(): void {
  applyTheme();
  media().addEventListener("change", () => {
    if (getThemeSetting() === "system") applyTheme("system");
  });
}

export function useThemeSetting(): [ThemeSetting, (s: ThemeSetting) => void] {
  const setting = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getThemeSetting,
    () => "system" as ThemeSetting
  );
  return [setting, setThemeSetting];
}
