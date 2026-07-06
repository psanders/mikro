/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Native OS notification for a newly caught alert (issue #124) — the rail's
 * red "Excepciones" badge is easy to miss if the window isn't focused. This
 * only needs to work while the app process is running; no background/closed-
 * app delivery. Permission is requested lazily on the first call rather than
 * at launch, so founders who never trigger an alert never see the OS prompt.
 * No-ops outside Tauri (the web build); the plugin is imported dynamically so
 * its code stays out of the web bundle, matching updater.ts/saveFile.ts.
 */

const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let permissionChecked = false;
let permissionGranted = false;

async function ensurePermission(): Promise<boolean> {
  const { isPermissionGranted, requestPermission } =
    await import("@tauri-apps/plugin-notification");
  if (permissionChecked) return permissionGranted;
  permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    permissionGranted = (await requestPermission()) === "granted";
  }
  permissionChecked = true;
  return permissionGranted;
}

/** Fire a native OS notification. No-op outside Tauri or without permission. */
export async function notifyOS(title: string, body: string): Promise<void> {
  if (!isTauri()) return;
  try {
    if (!(await ensurePermission())) return;
    const { sendNotification } = await import("@tauri-apps/plugin-notification");
    sendNotification({ title, body });
  } catch (err) {
    console.error("OS notification failed", err);
  }
}
