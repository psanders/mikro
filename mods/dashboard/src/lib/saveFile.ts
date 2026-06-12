/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const extFor = (mimeType: string): string => {
  switch (mimeType) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
};

/**
 * Download/save the given bytes. On the web this triggers a browser download;
 * inside Tauri it opens a native save dialog and writes the file.
 */
export async function saveFile(
  bytes: Uint8Array,
  filename: string,
  mimeType: string
): Promise<void> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const ext = extFor(mimeType);
    const path = await save({
      defaultPath: filename,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    });
    if (!path) return; // user cancelled
    await writeFile(path, bytes);
    return;
  }

  // Copy into a fresh ArrayBuffer-backed view so the Blob part type is concrete
  // (Uint8Array<ArrayBuffer>) rather than the variance-unsafe ArrayBufferLike.
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
