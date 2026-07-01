/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * "Firmada" (task 7.2): the reviewer photographs the physical signed
 * contract with the device camera (`expo-image-picker`, confirmed decision —
 * see design.md). `uploadSignedContract` only accepts `application/pdf`
 * (`mods/common/src/schemas/application.ts`), so the captured JPEG is wrapped
 * into a single-page PDF locally via `expo-print`'s HTML-to-PDF renderer
 * before upload — no backend changes needed.
 */
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";

/**
 * Launches the camera, then converts the captured photo into a base64 PDF.
 * Returns `null` if the user cancels the camera. Throws if camera permission
 * is denied or the PDF can't be generated.
 */
export async function captureSignedContractPdfBase64(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Se necesita acceso a la cámara para fotografiar el contrato firmado.");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: "images",
    base64: true,
    quality: 0.6
  });
  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.base64) return null;

  const html = `<html><body style="margin:0;padding:0;"><img src="data:image/jpeg;base64,${asset.base64}" style="width:100%;height:auto;display:block;" /></body></html>`;
  const file = await Print.printToFileAsync({ html, base64: true });
  if (!file.base64) {
    throw new Error("No se pudo generar el PDF del contrato firmado.");
  }
  return file.base64;
}
