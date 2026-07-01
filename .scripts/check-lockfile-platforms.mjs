/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Fails when package-lock.json has been "platform-narrowed": a package that
 * publishes per-platform binaries (sharp, esbuild, rolldown, ...) lists many
 * platform variants in its optionalDependencies, but the lockfile only
 * contains entries for the platform the lockfile was last regenerated on
 * (typically darwin-arm64 on a dev laptop). npm ci on any other platform then
 * silently skips the binary and the consumer breaks at build or run time
 * (known npm behavior, see npm/cli#4828).
 *
 * Repair: delete the narrowed package's entries (parent + platform children)
 * from package-lock.json and run `npm install --package-lock-only
 * --ignore-scripts` so npm re-resolves the subtree with all platforms.
 */
import { readFileSync } from "node:fs";

const PLATFORM_TOKENS = ["linux", "darwin", "win32", "x64", "arm64", "android", "freebsd", "musl"];

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const packages = lock.packages ?? {};
const present = new Set(Object.keys(packages));

const narrowed = [];
for (const [key, entry] of Object.entries(packages)) {
  const optional = Object.keys(entry.optionalDependencies ?? {});
  const platformVariants = optional.filter((name) =>
    PLATFORM_TOKENS.some((token) => name.includes(token))
  );
  if (platformVariants.length < 3) continue;

  const missing = platformVariants.filter(
    (name) => !present.has(`node_modules/${name}`) && !present.has(`${key}/node_modules/${name}`)
  );
  if (missing.length > 0) {
    narrowed.push({
      key,
      have: platformVariants.length - missing.length,
      total: platformVariants.length
    });
  }
}

if (narrowed.length > 0) {
  console.error("package-lock.json is platform-narrowed. Affected packages:");
  for (const { key, have, total } of narrowed) {
    console.error(`  ${key} (${have}/${total} platform binaries in lockfile)`);
  }
  console.error(
    "\nRepair: remove the affected entries from package-lock.json and run" +
      "\n  npm install --package-lock-only --ignore-scripts" +
      "\nSee the header of .scripts/check-lockfile-platforms.mjs for details."
  );
  process.exit(1);
}

console.log("package-lock.json platform coverage OK");
