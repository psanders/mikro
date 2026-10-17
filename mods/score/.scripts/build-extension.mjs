/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Builds the unpacked "Mikro · Decisión" Chrome extension in chrome-extension/:
 *   main.js        page script (MAIN world): captures the portal's data
 *   content.js     the panel (isolated world)
 *   background.js  service worker: the only context that calls the Mikro API
 *   options.js     login page (options.html)
 * Each is an esbuild IIFE bundle (MAIN-world scripts can't be ES modules).
 * Pass --zip to also write the release archive.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const out = join(pkgDir, "chrome-extension");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: ["main", "content", "background", "options"].map((e) =>
    join(pkgDir, "src/browser", `${e}.ts`)
  ),
  outdir: out,
  bundle: true,
  format: "iife",
  target: "chrome120",
  minify: true,
  legalComments: "none",
  banner: { js: `/* Mikro · Decisión v${version} */` },
  define: { __MIKRO_VERSION__: JSON.stringify(version) },
  logLevel: "warning"
});

cpSync(join(pkgDir, "extension/icons"), join(out, "icons"), { recursive: true });
cpSync(join(pkgDir, "extension/options.html"), join(out, "options.html"));
const manifest = JSON.parse(readFileSync(join(pkgDir, "extension/manifest.json"), "utf8"));
writeFileSync(join(out, "manifest.json"), JSON.stringify({ ...manifest, version }, null, 2) + "\n");
console.log(`built chrome-extension (v${version})`);

if (process.argv.includes("--zip")) {
  const zip = join(pkgDir, `mikro-score-v${version}.zip`);
  rmSync(zip, { force: true });
  execFileSync("zip", ["-qr", zip, "."], { cwd: out });
  console.log(`wrote ${zip}`);
}
