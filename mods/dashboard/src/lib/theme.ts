/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Light/dark theme (add-dark-mode). The setting — Sistema (follow the OS),
 * Claro or Oscuro — is remembered per device; <html class="dark"> switches the
 * design tokens in index.css. Sistema follows OS changes live.
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

export function applyTheme(setting: ThemeSetting = getThemeSetting()): void {
  document.documentElement.classList.toggle("dark", isDark(setting));
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
