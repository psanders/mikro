/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Collector evidence helpers (openspec add-collector-evidence): the GPS reading
 * that becomes the business's map link, photos from the camera or the gallery,
 * and the small labels the evidence screens show. The decisions are pure
 * functions so they can be unit-tested without a device.
 */
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

/** A reading this accurate (meters) or better is saved without asking. */
export const GOOD_ACCURACY_M = 20;
/** How long to wait for a good reading before offering the best one. */
export const GPS_TIMEOUT_MS = 15_000;

export interface Reading {
  latitude: number;
  longitude: number;
  /** Meters; null when the platform doesn't report it. */
  accuracy: number | null;
}

/** The better of two readings: known accuracy beats unknown, lower beats higher. */
export function betterReading(a: Reading | null, b: Reading): Reading {
  if (!a) return b;
  if (b.accuracy == null) return a;
  if (a.accuracy == null) return b;
  return b.accuracy < a.accuracy ? b : a;
}

/** A reading good enough to save without the "save anyway" step. */
export function isGoodReading(r: Reading): boolean {
  return r.accuracy != null && r.accuracy <= GOOD_ACCURACY_M;
}

export type CaptureResult =
  | { kind: "denied" }
  | { kind: "unavailable" }
  | { kind: "good"; reading: Reading }
  | { kind: "weak"; reading: Reading };

/**
 * Ask for foreground location permission, then watch the position until a
 * reading is good (≤ 20 m) or 15 s pass; a weak best reading is returned for
 * the collector to save anyway. Only the resulting link is ever stored.
 */
export async function captureLocation(onProgress?: (r: Reading) => void): Promise<CaptureResult> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") return { kind: "denied" };

  let best: Reading | null = null;
  return new Promise<CaptureResult>((resolve) => {
    let sub: Location.LocationSubscription | null = null;
    let done = false;
    const finish = (result: CaptureResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sub?.remove();
      resolve(result);
    };
    const timer = setTimeout(() => {
      finish(
        best
          ? { kind: isGoodReading(best) ? "good" : "weak", reading: best }
          : { kind: "unavailable" }
      );
    }, GPS_TIMEOUT_MS);

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, timeInterval: 1000, distanceInterval: 0 },
      (pos) => {
        const reading: Reading = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null
        };
        best = betterReading(best, reading);
        onProgress?.(best);
        if (isGoodReading(best)) finish({ kind: "good", reading: best });
      }
    )
      .then((s) => {
        if (done) s.remove();
        else sub = s;
      })
      .catch(() => finish({ kind: "unavailable" }));
  });
}

export type PhotoSource = "camera" | "library";

export interface PickedImage {
  dataBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  originalName: string;
}

/** The upload MIME type for a picked asset (camera shots are JPEG). */
export function imageMimeType(uri: string, reported?: string | null): PickedImage["mimeType"] {
  const t = (reported ?? "").toLowerCase();
  if (t === "image/png" || uri.toLowerCase().endsWith(".png")) return "image/png";
  if (t === "image/webp" || uri.toLowerCase().endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/**
 * One image from the camera or the gallery, as base64 for upload; null when
 * the collector cancels or denies the permission. Quality is reduced so field
 * uploads stay small on mobile data.
 */
export async function pickImage(source: PhotoSource): Promise<PickedImage | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    base64: true,
    quality: 0.5,
    exif: false
  };
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  }
  const res =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = res.canceled ? null : res.assets[0];
  if (!asset?.base64) return null;
  const mimeType = imageMimeType(asset.uri, asset.mimeType);
  return {
    dataBase64: asset.base64,
    mimeType,
    originalName: asset.fileName ?? `evidencia.${mimeType.split("/")[1]}`
  };
}

/** "hoy", "desde ayer", "hace 3 días" — how long an application has been in review. */
export function inReviewLabel(since: Date | string, now: Date = new Date()): string {
  const start = new Date(since);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(start)) / 86_400_000);
  if (days <= 0) return "En evaluación desde hoy";
  if (days === 1) return "En evaluación desde ayer";
  return `En evaluación hace ${days} días`;
}

/** The pieces still missing, in checklist order, for the detail's "Faltan" line. */
export function missingPieces(status: {
  location: boolean;
  idFront: boolean;
  idBack: boolean;
  businessPhotos: { have: number; need: number };
}): string[] {
  const out: string[] = [];
  if (!status.location) out.push("ubicación");
  if (!status.idFront) out.push("cédula (frente)");
  if (!status.idBack) out.push("cédula (reverso)");
  const photos = status.businessPhotos.need - status.businessPhotos.have;
  if (photos > 0) out.push(`${photos} foto${photos > 1 ? "s" : ""}`);
  return out;
}
