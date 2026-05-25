#!/bin/bash
# Prisma 7 generates extensionless relative imports in client.js.
# Node ESM requires .js extensions. This adds them.
sed -i '' -E "s/from ['\"](\\.\\.\\/[^'\"]+|\\.\\/[^'\"]+)['\"]/from '\\1.js'/g" dist/generated/prisma/client.js
