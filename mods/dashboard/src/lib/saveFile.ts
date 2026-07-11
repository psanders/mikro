/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Decode a base64 string (as returned by base64-carrying tRPC mutations) into raw bytes for saveFile. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encode raw bytes to base64, for handing off to the Rust `write_saved_file` command. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/**
 * Toast duration for a saved-file confirmation. Longer than the default so the
 * user has time to read the destination path (the desktop build's fallback
 * path writes silently to Downloads with no OS "download complete" chrome of
 * its own).
 */
export const SAVED_TOAST_MS = 12000;

/**
 * Result of `saveFile`. Three shapes:
 *  - `"saved"` — the file landed somewhere the caller should confirm with a
 *    toast: `location` names the exact desktop path when the native dialog
 *    was unavailable and this fell back to writing straight to Downloads, or
 *    is `null` on the web (the browser owns the download location).
 *  - `"picked"` — desktop only: the user chose the destination themselves via
 *    the native save dialog, so no confirmation toast is needed (they already
 *    know where it went).
 *  - `"cancelled"` — desktop only: the user backed out of the save dialog.
 *    Not an error — callers should do nothing (no toast, no error message).
 */
export type SaveResult =
  | { status: "saved"; location: string | null }
  | { status: "picked" }
  | { status: "cancelled" };

interface PickSavePathPicked {
  status: "picked";
  path: string;
}
interface PickSavePathCancelled {
  status: "cancelled";
}
interface PickSavePathUnavailable {
  status: "unavailable";
}
type PickSavePathResult = PickSavePathPicked | PickSavePathCancelled | PickSavePathUnavailable;

/**
 * Download/save the given bytes.
 *
 * On the web this triggers a browser download straight to the Downloads
 * folder with no prompt — the browser owns that choice.
 *
 * Inside Tauri, this asks the user where to save via a native "Save As"
 * dialog: a custom, nil-safe Rust command (`pick_save_path` /
 * `write_saved_file`, see `src-tauri/src/save_dialog.rs`) rather than
 * `@tauri-apps/plugin-dialog`'s `save()`. That plugin call panics the whole
 * app on some macOS 26 Tahoe setups — `NSSavePanel.savePanel()` can return
 * NULL there, and the Rust binding underneath the plugin `unwrap()`s it
 * (tauri-apps/tauri#13047, no upstream fix yet). The custom command asks for
 * the panel nil-safely instead, and falls back to writing straight to
 * Downloads (today's previous workaround) only when the panel truly isn't
 * available.
 */
export async function saveFile(
  bytes: Uint8Array,
  filename: string,
  mimeType: string
): Promise<SaveResult> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const pick = await invoke<PickSavePathResult>("pick_save_path", { filename });

    if (pick.status === "picked") {
      // Written by the Rust command itself (bytes travel as base64) rather
      // than via `@tauri-apps/plugin-fs`'s `writeFile` here, so the write
      // isn't limited by this app's `fs:scope` capability (rooted at
      // `$HOME/**` — see capabilities/default.json), which wouldn't cover
      // every location the native panel lets the user navigate to (an
      // external volume, /tmp, etc). The panel itself is already the
      // permission gate for a user-picked destination.
      await invoke("write_saved_file", { path: pick.path, base64: bytesToBase64(bytes) });
      return { status: "picked" };
    }

    if (pick.status === "cancelled") {
      return { status: "cancelled" };
    }

    // "unavailable": the native panel couldn't be shown at all — fall back
    // to today's behavior of writing silently to Downloads so the toast can
    // still tell the user where the file landed.
    const { downloadDir, homeDir, join } = await import("@tauri-apps/api/path");
    const path = await join(await downloadDir(), filename);
    await writeFile(path, bytes);
    let location = path;
    try {
      const home = await homeDir();
      if (path.startsWith(home)) location = `~${path.slice(home.length)}`;
    } catch {
      // Keep the full absolute path if the home dir can't be resolved.
    }
    return { status: "saved", location };
  }

  // Copy into a fresh ArrayBuffer-backed view so the Blob part type is concrete
  // (Uint8Array<ArrayBuffer>) rather than the variance-unsafe ArrayBufferLike.
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { status: "saved", location: null };
}

/**
 * Build a Spanish "saved" confirmation for a toast. Only valid for the
 * `"saved"` result shape — `"picked"` needs no toast (the user chose the
 * location themselves) and `"cancelled"` needs no toast either; callers
 * should check `result.status` before calling this.
 */
export function savedMessage(
  subject: string,
  result: Extract<SaveResult, { status: "saved" }>,
  filename: string
): string {
  return result.location
    ? `${subject} guardado en ${result.location}`
    : `${subject} descargado: ${filename}`;
}
