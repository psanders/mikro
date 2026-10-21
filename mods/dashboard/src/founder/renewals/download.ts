/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Save a base64 file the API returned (the generated contract) and tell the
 * user where it went — same OS-level save + toast as the loan card.
 */
import { base64ToBytes, saveFile, savedMessage, SAVED_TOAST_MS } from "../../lib/saveFile";

export async function saveBase64File(
  file: { dataBase64: string; filename: string; mimeType: string },
  toast: { success: (m: string, o?: { durationMs?: number }) => void; error: (m: string) => void }
): Promise<void> {
  try {
    const saved = await saveFile(base64ToBytes(file.dataBase64), file.filename, file.mimeType);
    if (saved.status === "saved") {
      toast.success(savedMessage("Contrato", saved, file.filename), { durationMs: SAVED_TOAST_MS });
    }
  } catch {
    toast.error(
      "El contrato quedó guardado en la renovación, pero no se pudo descargar el archivo."
    );
  }
}
