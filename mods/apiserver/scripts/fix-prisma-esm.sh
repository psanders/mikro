#!/bin/bash
# Prisma 7's `prisma-client` generator emits extensionless relative imports in
# the generated TypeScript (e.g. `from "./internal/class"`). Node ESM requires
# explicit .js extensions at runtime.
#
# We patch the SOURCE (client.ts) *before* tsc compiles it, not the emitted
# dist/client.js. A dist-only patch gets clobbered whenever another project's
# `tsc -b` re-emits apiserver's referenced output (e.g. ctl references
# apiserver) — that re-emit recompiles client.ts and strips the extensions.
# Patching the source means every emit reproduces a correct client.js.
#
# Only client.ts needs this: every other generated file's relative imports are
# `import type` / `export type`, which are erased at emit and never hit runtime.
#
# Use a temp file rather than `sed -i`: GNU sed (Linux/CI) and BSD sed (macOS)
# have incompatible -i syntax (`sed -i` vs `sed -i ''`), and the BSD form
# silently breaks on GNU, treating the script as a filename.
set -eu

file="src/generated/prisma/client.ts"
tmp="$(mktemp)"
sed -E "s/from ['\"](\\.\\.\\/[^'\"]+|\\.\\/[^'\"]+)['\"]/from '\\1.js'/g" "$file" >"$tmp"
mv "$tmp" "$file"
