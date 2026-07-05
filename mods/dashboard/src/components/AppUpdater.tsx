/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Drives the desktop auto-updater and renders the "update ready" banner once a
 * newer build has been staged. Renders nothing on the web build (the hook
 * no-ops off Tauri) or until an update is staged. Dismissal is per-session: if
 * the operator closes the banner it stays hidden for that version until a newer
 * build is staged.
 */
import { useState } from "react";
import { useAppUpdater } from "../lib/updater";
import { UpdateBanner } from "./UpdateBanner";

export function AppUpdater() {
  const { readyVersion, restart } = useAppUpdater();
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!readyVersion || dismissed === readyVersion) return null;

  return (
    <UpdateBanner
      version={readyVersion}
      onRestart={restart}
      onDismiss={() => setDismissed(readyVersion)}
    />
  );
}
