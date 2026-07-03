#!/usr/bin/env node
// Prints where the newest EAS build for a platform landed — build page and
// direct artifact download — so nobody has to hunt through expo.dev after a
// build finishes. Chained after the cloud `eas build` npm scripts and used by
// CI to append the same note to $GITHUB_STEP_SUMMARY (output is markdown that
// also reads fine in a terminal).
//
// Usage: node .scripts/print-build-link.mjs <ios|android>
import { execFileSync } from "node:child_process";

const platform = process.argv[2];
if (!["ios", "android"].includes(platform)) {
  console.error("usage: print-build-link.mjs <ios|android>");
  process.exit(1);
}

let builds;
try {
  const raw = execFileSync(
    "eas",
    ["build:list", "--platform", platform, "--limit", "1", "--non-interactive", "--json"],
    { encoding: "utf8" }
  );
  builds = JSON.parse(raw);
} catch (err) {
  // The build itself already succeeded by the time this runs — a lookup
  // failure should never fail the npm script.
  console.error(`(could not fetch build link: ${err.message})`);
  process.exit(0);
}

const build = builds?.[0];
if (!build) {
  console.error(`(no ${platform} builds found)`);
  process.exit(0);
}

const account = build.project?.ownerAccount?.name;
const slug = build.project?.slug;
const page =
  account && slug
    ? `https://expo.dev/accounts/${account}/projects/${slug}/builds/${build.id}`
    : undefined;
const artifact =
  build.artifacts?.applicationArchiveUrl ?? build.artifacts?.buildUrl;

console.log(`### 📦 EAS build (${platform})`);
console.log(`- Status: ${build.status}`);
if (page) console.log(`- Build page: ${page}`);
if (artifact) console.log(`- Artifact: ${artifact}`);
