/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Drives the desktop auto-updater and renders the "update ready" banner once a
 * newer build has been staged. Renders nothing on the web build (the hook
 * no-ops off Tauri) or until an update is staged. Postpone (issue #162) is
 * persisted for 24h via `updateSnooze`, so it survives a restart — a newer
 * staged version always breaks through an earlier postpone. Snooze status is
 * re-polled every minute (not just when `readyVersion` changes) so the banner
 * comes back once the 24h window lapses, even in a session that runs that long
 * without a newer version showing up to trigger a recompute on its own.
 */
import { useEffect, useState } from "react";
import { useAppUpdater } from "../lib/updater";
import { isUpdateSnoozed, snoozeUpdate } from "../lib/updateSnooze";
import { UpdateBanner } from "./UpdateBanner";

/** How often to re-check whether the 24h postpone window has lapsed. */
const SNOOZE_POLL_MS = 60 * 1000;

export function AppUpdater() {
  const { readyVersion, restart } = useAppUpdater();
  const [snoozed, setSnoozed] = useState(false);

  useEffect(() => {
    if (!readyVersion) {
      setSnoozed(false);
      return;
    }
    const recompute = () => setSnoozed(isUpdateSnoozed(readyVersion));
    recompute();
    const id = setInterval(recompute, SNOOZE_POLL_MS);
    return () => clearInterval(id);
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
