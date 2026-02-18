/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Tunable constants for loan calculator behavior.
 */

/** Default rate adjustment per period (1.5%). */
export const DEFAULT_ADJUSTMENT_PER_PERIOD = 0.015;

/** Default minimum total interest rate floor (10%). */
export const DEFAULT_MIN_RATE = 0.1;

/** Default maximum total interest rate ceiling (60%). */
export const DEFAULT_MAX_RATE = 0.6;

/** Number of options generated before and after base duration. */
export const DEFAULT_OPTIONS_RANGE = 3;

/** Payment rounding increment for collection-friendly amounts (e.g., 650, 900, 1050). */
export const DEFAULT_PAYMENT_ROUNDING_INCREMENT = 50;
