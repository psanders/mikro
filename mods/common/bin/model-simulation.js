#!/usr/bin/env node
/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { main } from "../dist/modelo/cli.js";

main(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
