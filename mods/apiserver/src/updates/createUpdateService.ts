/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Desktop auto-update file service. The Tauri dashboard points its updater at
 * the apiserver, which serves a folder populated at deploy time: the release CI
 * signs the installers, rewrites the manifest's download URLs to this server,
 * and rsyncs both into the updates folder. At runtime the apiserver only reads
 * those static files — no GitHub access — so updates keep working unchanged once
 * the repo goes private.
 *
 * The asset resolver is the security-sensitive bit: the requested filename comes
 * from the URL, so it is reduced to a basename and confirmed to resolve inside
 * the updates folder before any file is touched.
 */
import { existsSync } from "fs";
import path from "path";

export interface UpdateServiceConfig {
  /** Absolute path to the folder holding the manifest + installers. */
  updatesDir: string;
  /** Manifest filename within the folder (e.g. "latest.json"). */
  manifestFilename: string;
}

/** Build a resolver for the manifest path. Returns null when absent. */
export function createGetManifestPath(config: UpdateServiceConfig) {
  return (): string | null => {
    const manifestPath = path.join(config.updatesDir, config.manifestFilename);
    return existsSync(manifestPath) ? manifestPath : null;
  };
}

/**
 * Build a safe resolver for an installer asset by name. Returns the absolute
 * path only when the name is a plain filename that exists inside the updates
 * folder; returns null for traversal attempts (`../`, absolute paths, nested
 * segments) or missing files.
 */
export function createResolveAssetPath(config: UpdateServiceConfig) {
  return (requestedName: string): string | null => {
    // Reject anything that isn't a bare filename before touching the disk.
    const base = path.basename(requestedName);
    if (base !== requestedName || base === "" || base === "." || base === "..") {
      return null;
    }
    const resolved = path.resolve(config.updatesDir, base);
    const dir = path.resolve(config.updatesDir);
    // Confirm the resolved path is a direct child of the updates folder.
    if (path.dirname(resolved) !== dir) return null;
    return existsSync(resolved) ? resolved : null;
  };
}
