#!/bin/bash
# Prisma 7 generates extensionless relative imports in client.js.
# Node ESM requires .js extensions. This adds them.
#
# Use a temp file rather than `sed -i`: GNU sed (Linux/CI) and BSD sed
# (macOS) have incompatible -i syntax (`sed -i` vs `sed -i ''`), and the
# BSD form silently breaks on GNU, treating the script as a filename.
set -eu

file="dist/generated/prisma/client.js"
tmp="$(mktemp)"
sed -E "s/from ['\"](\\.\\.\\/[^'\"]+|\\.\\/[^'\"]+)['\"]/from '\\1.js'/g" "$file" >"$tmp"
mv "$tmp" "$file"
