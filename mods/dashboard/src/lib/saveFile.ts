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

/**
 * Toast duration for a saved-file confirmation. Longer than the default so the
 * user has time to read the destination path (the desktop build writes
 * silently to Downloads with no OS "download complete" chrome of its own).
 */
export const SAVED_TOAST_MS = 12000;

export interface SaveResult {
  /**
   * Where the file landed, for a user-facing confirmation. On desktop this is
   * the absolute path with the home dir abbreviated to `~` (e.g.
   * `~/Downloads/clientes-2026-07-11.pdf`). On web it's `null` — the browser
   * owns the download location and doesn't expose it — so callers should fall
   * back to a filename-only message there.
   */
  location: string | null;
}

/**
 * Download/save the given bytes. On the web this triggers a browser download
 * straight to the Downloads folder with no prompt; inside Tauri it writes
 * directly to the OS Downloads folder the same way, with no native save
 * dialog. Returns where the file landed so callers can tell the user (the
 * desktop build gives no OS "download complete" chrome of its own).
 *
 * (The native save dialog previously used here — `@tauri-apps/plugin-dialog`'s
 * `save()` — panics on some macOS setups: `NSSavePanel.savePanel()` can return
 * NULL, which the Rust binding `unwrap()`s, killing the whole app. Writing
 * straight to Downloads sidesteps that native call entirely and also matches
 * the web build's no-picker behavior.)
 */
export async function saveFile(
  bytes: Uint8Array,
  filename: string,
  mimeType: string
): Promise<SaveResult> {
  if (isTauri()) {
    const { downloadDir, homeDir, join } = await import("@tauri-apps/api/path");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await join(await downloadDir(), filename);
    await writeFile(path, bytes);
    let location = path;
    try {
      const home = await homeDir();
      if (path.startsWith(home)) location = `~${path.slice(home.length)}`;
    } catch {
      // Keep the full absolute path if the home dir can't be resolved.
    }
    return { location };
  }

  // Copy into a fresh ArrayBuffer-backed view so the Blob part type is concrete
  // (Uint8Array<ArrayBuffer>) rather than the variance-unsafe ArrayBufferLike.
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { location: null };
}

/**
 * Build a Spanish "saved" confirmation for a toast. On desktop it names the
 * exact path (`~/Downloads/…`); on web, where the browser owns the location,
 * it names just the file.
 */
export function savedMessage(subject: string, result: SaveResult, filename: string): string {
  return result.location
    ? `${subject} guardado en ${result.location}`
    : `${subject} descargado: ${filename}`;
}
