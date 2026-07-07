/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Regenerate docs/collections-spec.md from the check registry.
 * Run: npm run spec:collections
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { generateSpecMarkdown } from "../src/eval/spec.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../docs/collections-spec.md");
writeFileSync(out, generateSpecMarkdown());
console.log(`wrote ${out}`);
