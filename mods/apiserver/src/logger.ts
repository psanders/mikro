/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { fileURLToPath } from "url";
import { getLogger } from "@fonoster/logger";

/**
 * Logger instance for the apiserver module.
 * Uses lowercase strings following fonoster style.
 */
export const logger = getLogger({ service: "apiserver", filePath: fileURLToPath(import.meta.url) });
