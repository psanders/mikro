/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Two lockfile integrity checks that npm itself does not perform:
 *
 * 1. Platform narrowing: a package that publishes per-platform binaries
 *    (sharp, esbuild, rolldown, ...) lists many platform variants in its
 *    optionalDependencies, but the lockfile only contains entries for the
 *    platform it was last regenerated on (typically darwin-arm64 on a dev
 *    laptop). npm ci on any other platform then silently skips the binary
 *    and the consumer breaks at build or run time (npm/cli#4828).
 *
 * 2. Unresolvable dependency edges: a lock entry's `dependencies` name a
 *    package that has no lock entry anywhere on the resolution path. npm
 *    install exits 0 on such a lock but produces a node_modules missing
 *    hard dependencies (this shipped once: vite's `rolldown` dep had no
 *    entry and the site build failed on CI with ERR_MODULE_NOT_FOUND).
 *
 * Repair for both: `rm -rf node_modules package-lock.json && npm install` —
 * a fresh resolution records every platform's binaries and every edge.
 * Do NOT hand-delete lock entries and re-resolve with --package-lock-only:
 * npm trusts the remaining state and silently drops whole subtrees.
 */
import { readFileSync } from "node:fs";

const PLATFORM_TOKENS = ["linux", "darwin", "win32", "x64", "arm64", "android", "freebsd", "musl"];

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const packages = lock.packages ?? {};
const present = new Set(Object.keys(packages));

const problems = [];

// --- Check 1: platform narrowing -------------------------------------------
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
    problems.push(
      `${key}: only ${platformVariants.length - missing.length}/${platformVariants.length} platform binaries in lockfile`
    );
  }
}

// --- Check 2: unresolvable dependency edges ---------------------------------
// A dependency of `node_modules/a/node_modules/b` may resolve at any parent
// level: .../b/node_modules/<dep>, .../a/node_modules/<dep>, node_modules/<dep>.
const resolves = (fromKey, depName) => {
  let base = fromKey;
  for (;;) {
    if (present.has(`${base}/node_modules/${depName}`)) return true;
    const idx = base.lastIndexOf("/node_modules/");
    if (idx === -1) break;
    base = base.slice(0, idx);
  }
  return present.has(`node_modules/${depName}`);
};

for (const [key, entry] of Object.entries(packages)) {
  if (!key.includes("node_modules/")) continue; // workspace roots use package.json
  if (entry.link) continue;
  for (const dep of Object.keys(entry.dependencies ?? {})) {
    // Optional deps of the same entry may legitimately be absent.
    if (entry.optionalDependencies && dep in entry.optionalDependencies) continue;
    if (!resolves(key, dep)) {
      problems.push(`${key}: dependency "${dep}" has no lockfile entry`);
    }
  }
}

if (problems.length > 0) {
  console.error("package-lock.json integrity problems:");
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "\nRepair: rm -rf node_modules package-lock.json && npm install" +
      "\nSee the header of .scripts/check-lockfile-platforms.mjs for details."
  );
  process.exit(1);
}

console.log("package-lock.json platform coverage and dependency edges OK");
