/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Page script (MAIN world, document_start): captures the portal's data before
 * its own scripts run. It only observes; the panel (content script) and the
 * Mikro API calls (background worker) live elsewhere.
 */
import { installEquifax } from "./equifax.js";
import { installPrestamosCloud } from "./pcloud.js";

if (location.hostname === "interactivereports.equifax.com") installEquifax();
else if (location.hostname === "portal.prestamoscloud.com") installPrestamosCloud();
