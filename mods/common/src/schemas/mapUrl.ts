/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The business location is evidence stored only as a map link (no coordinates,
 * accuracy or author). Collectors build it from GPS; reviewers paste one from
 * Google Maps. Only https Google Maps links are accepted, so a pasted value
 * always opens a map.
 */

export const MAX_MAP_URL_LENGTH = 500;

/** Host → path prefix that must follow it ("" = any path). */
const MAP_HOSTS: ReadonlyArray<readonly [string, string]> = [
  ["maps.google.com", ""],
  ["www.google.com", "/maps"],
  ["google.com", "/maps"],
  ["maps.app.goo.gl", ""],
  ["goo.gl", "/maps"]
];

/** True for an https Google Maps link of at most MAX_MAP_URL_LENGTH characters. */
export function isMapUrl(value: string): boolean {
  if (value.length > MAX_MAP_URL_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return MAP_HOSTS.some(([h, path]) => host === h && url.pathname.startsWith(path));
}

/** The link saved from a GPS reading: `https://maps.google.com/?q=<lat>,<lng>`. */
export function buildMapUrl(latitude: number, longitude: number): string {
  return `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}
