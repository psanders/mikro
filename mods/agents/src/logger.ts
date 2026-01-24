/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { fileURLToPath } from "url";
import { getLogger } from "@fonoster/logger";

/**
 * Logger instance for the agents module.
 * Uses lowercase strings following fonoster style.
 */
export const logger = getLogger({ service: "agents", filePath: fileURLToPath(import.meta.url) });
