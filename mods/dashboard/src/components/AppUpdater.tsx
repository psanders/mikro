/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Drives the desktop auto-updater and renders the "update ready" banner once a
 * newer build has been staged. Renders nothing on the web build (the hook
 * no-ops off Tauri) or until an update is staged. Postpone (issue #162) is
 * persisted for 24h via `updateSnooze`, so it survives a restart — a newer
 * staged version always breaks through an earlier postpone. A single timer is
 * scheduled at the stored snooze's exact expiry moment (not polled) so the
 * banner reappears the instant the 24h window lapses, even in a session that
 * runs that long without a newer version showing up to trigger a recompute.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppUpdater } from "../lib/updater";
import { isUpdateSnoozed, snoozeExpiry, snoozeUpdate } from "../lib/updateSnooze";
import { UpdateBanner } from "./UpdateBanner";

export function AppUpdater() {
  const { readyVersion, restart } = useAppUpdater();
  const [snoozed, setSnoozed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScheduled = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Recomputes snoozed state now, and — if still snoozed — schedules one
  // precise timeout for the exact moment the postpone lapses.
  const scheduleCheck = useCallback(
    (version: string) => {
      clearScheduled();
      setSnoozed(isUpdateSnoozed(version));
      const until = snoozeExpiry(version);
      if (until !== null) {
        timeoutRef.current = setTimeout(
          () => {
            timeoutRef.current = null;
            setSnoozed(false);
          },
          Math.max(0, until - Date.now())
        );
      }
    },
    [clearScheduled]
  );

  useEffect(() => {
    if (!readyVersion) {
      clearScheduled();
      setSnoozed(false);
      return;
    }
    scheduleCheck(readyVersion);
    return clearScheduled;
  }, [readyVersion, scheduleCheck, clearScheduled]);

  if (!readyVersion || snoozed) return null;

  return (
    <UpdateBanner
      version={readyVersion}
      onRestart={restart}
      onPostpone={() => {
        snoozeUpdate(readyVersion);
        scheduleCheck(readyVersion);
      }}
    />
  );
}
