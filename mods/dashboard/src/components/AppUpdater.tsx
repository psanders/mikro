/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Drives the desktop auto-updater and renders the "update ready" banner once a
 * newer build has been staged. Renders nothing on the web build (the hook
 * no-ops off Tauri) or until an update is staged. Postpone (issue #162) is
 * persisted for 24h via `updateSnooze`, so it survives a restart — a newer
 * staged version always breaks through an earlier postpone.
 */
import { useEffect, useState } from "react";
import { useAppUpdater } from "../lib/updater";
import { isUpdateSnoozed, snoozeUpdate } from "../lib/updateSnooze";
import { UpdateBanner } from "./UpdateBanner";

export function AppUpdater() {
  const { readyVersion, restart } = useAppUpdater();
  const [snoozed, setSnoozed] = useState(false);

  useEffect(() => {
    setSnoozed(readyVersion ? isUpdateSnoozed(readyVersion) : false);
  }, [readyVersion]);

  if (!readyVersion || snoozed) return null;

  return (
    <UpdateBanner
      version={readyVersion}
      onRestart={restart}
      onPostpone={() => {
        snoozeUpdate(readyVersion);
        setSnoozed(true);
      }}
    />
  );
}
