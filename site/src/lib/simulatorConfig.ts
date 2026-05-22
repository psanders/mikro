/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { PaymentFrequency } from "@mikro/calculate-loan";

/** Marketing simulator defaults — aligned with pencil design (10–18 week choices). */
export const SIMULATOR_MIN_AMOUNT = 5000;
export const SIMULATOR_MAX_AMOUNT = 30000;
export const SIMULATOR_STEP_AMOUNT = 1000;
export const SIMULATOR_INITIAL_AMOUNT = 20000;

/**
 * 30% total interest anchored at 10 weeks.
 * With adjustmentPerPeriod=0.015 and baseDuration=14,
 * rate at 10w = 0.36 + (10-14)*0.015 = 0.30.
 */
export const SIMULATOR_INTEREST_RATE = 0.36;

export const SIMULATOR_PAYMENT_FREQUENCY: PaymentFrequency = "WEEKLY";

/** Center of option range so optionsRange 4 yields 10–18 weeks. */
export const SIMULATOR_BASE_DURATION = 14;

export const SIMULATOR_OPTIONS_RANGE = 4;

export const SIMULATOR_INITIAL_DURATION = 12;

/** Duration chips shown in the UI (subset of calculated options). */
export const SIMULATOR_DISPLAY_DURATIONS = [10, 12, 15, 18] as const;
