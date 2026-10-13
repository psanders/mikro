/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Console entry: paste into DevTools on an open portal tab. No install, no reload.
 * Starts listening for the next report and offers scoring a saved JSON file.
 */
import { handleReportText, installHook } from "./hook.js";
import { renderLauncher } from "./panel.js";

installHook();
renderLauncher(handleReportText);
