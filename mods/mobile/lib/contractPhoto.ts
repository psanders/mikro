/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Camera capture for the reviewer flow (`expo-image-picker`, confirmed
 * decision — see design.md), shared by two uploads:
 *
 *  - "Firmada" (task 7.2): the reviewer photographs the physical signed
 *    contract. `uploadSignedContract` only accepts `application/pdf`
 *    (`mods/common/src/schemas/application.ts`), so the captured JPEG is
 *    wrapped into a single-page PDF locally via `expo-print` before upload.
 *  - Cédula images (`uploadIdImage`): the reviewer photographs the applicant's
 *    ID; that mutation accepts `image/jpeg`, so the raw JPEG is uploaded as-is.
 *
 * Neither path needs a backend change.
 */
/**
 * Native modules are imported lazily (inside the capture functions) rather than
 * at module top-level: screens like `datos.tsx` import these helpers just to
 * wire button handlers, and an eager `expo-image-picker` import would evaluate
 * — and, if the native module is missing from the build, throw — the moment
 * such a screen is imported, white-screening it. Deferring the import scopes
 * any native failure to an actual capture attempt (caught by the callers).
 *
 * In e2e builds the camera can't be driven, so capture returns a fixed 1×1
 * base64 (no native access) — enough for the upload mutation + refetch to flip
 * a document row to its "uploaded" state.
 */
import { IS_E2E } from "./e2e";

// 1×1 transparent PNG, base64 (no data: prefix) — a stand-in payload for e2e.
const E2E_STUB_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

/**
 * Launches the camera and returns the captured photo's base64 JPEG. Returns
 * `null` if the user cancels. Throws if camera permission is denied.
 */
async function captureJpegBase64(): Promise<string | null> {
  if (IS_E2E) return E2E_STUB_BASE64;
  const ImagePicker = await import("expo-image-picker");
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Se necesita acceso a la cámara para tomar la foto.");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: "images",
    base64: true,
    quality: 0.6
  });
  if (result.canceled) return null;

  return result.assets?.[0]?.base64 ?? null;
}

/**
 * Photographs one side of the applicant's cédula and returns the base64 JPEG
 * for `uploadIdImage`. Returns `null` if the user cancels.
 */
export async function captureIdImageBase64(): Promise<string | null> {
  return captureJpegBase64();
}

/**
 * Photographs the signed contract and converts it into a base64 PDF for
 * `uploadSignedContract`. Returns `null` if the user cancels. Throws if the
 * PDF can't be generated.
 */
export async function captureSignedContractPdfBase64(): Promise<string | null> {
  if (IS_E2E) return E2E_STUB_BASE64;
  const base64 = await captureJpegBase64();
  if (!base64) return null;

  const Print = await import("expo-print");
  const html = `<html><body style="margin:0;padding:0;"><img src="data:image/jpeg;base64,${base64}" style="width:100%;height:auto;display:block;" /></body></html>`;
  const file = await Print.printToFileAsync({ html, base64: true });
  if (!file.base64) {
    throw new Error("No se pudo generar el PDF del contrato firmado.");
  }
  return file.base64;
}
