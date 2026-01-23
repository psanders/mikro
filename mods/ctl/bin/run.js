#!/usr/bin/env node
/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

import { execute } from "@oclif/core";

await execute({
  development: true,
  dir: import.meta.url
});
