/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Assembles the unpacked Chrome extension in chrome-extension/ from the tsc output:
 *   content.js  – MAIN-world content script (manifest)
 *   console.js  – same code for pasting into DevTools (no install, no reload)
 * MAIN-world content scripts can't be ES modules, so the compiled modules are
 * concatenated into one IIFE. Pass --zip to also write the release archive.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const out = join(pkgDir, "chrome-extension");

const LIB = ["scorecard.js", "adapter.js", "browser/panel.js", "browser/hook.js"];

const strip = (src) =>
  src
    .replace(/^import .*;$/gm, "")
    .replace(/^export \{\};$/gm, "")
    .replace(/^export /gm, "")
    .replace(/^\/\/# sourceMappingURL=.*$/gm, "");

function bundle(entry) {
  const parts = [...LIB, entry].map(
    (f) => `// ---- ${f} ----\n${strip(readFileSync(join(pkgDir, "dist", f), "utf8"))}`
  );
  return `/* Mikro · Riesgo de buró v${version} */\n(() => {\n"use strict";\n${parts.join("\n")}\n})();\n`;
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(pkgDir, "extension/icons"), join(out, "icons"), { recursive: true });
const manifest = JSON.parse(readFileSync(join(pkgDir, "extension/manifest.json"), "utf8"));
writeFileSync(join(out, "manifest.json"), JSON.stringify({ ...manifest, version }, null, 2) + "\n");
writeFileSync(join(out, "content.js"), bundle("browser/extension.js"));
writeFileSync(join(out, "console.js"), bundle("browser/console.js"));
console.log(`built chrome-extension (v${version})`);

if (process.argv.includes("--zip")) {
  const zip = join(pkgDir, `mikro-creditscore-v${version}.zip`);
  rmSync(zip, { force: true });
  execFileSync("zip", ["-qr", zip, "."], { cwd: out });
  console.log(`wrote ${zip}`);
}
