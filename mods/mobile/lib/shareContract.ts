/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Writes a base64 PDF (generated or stored contract) to the cache directory
 * and opens the native share/view sheet, mirroring the desktop's `saveFile`
 * download for the "Generar contrato" / "Ver contrato" flows.
 */
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export async function shareContractPdf(base64: string, filename: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  file.write(base64, { encoding: "base64" });
  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Contrato"
    });
  }
}
