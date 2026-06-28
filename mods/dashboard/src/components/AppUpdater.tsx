/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Headless component that drives the desktop auto-updater. Renders nothing; it
 * exists so the hook can live inside the React tree. No-ops on the web build.
 */
import { useAppUpdater } from "../lib/updater";

export function AppUpdater(): null {
  useAppUpdater();
  return null;
}
