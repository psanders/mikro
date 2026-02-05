/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Tunable constants for member report rating, trend, and row highlighting.
 * Tweak these to change behavior without touching helper logic.
 */

/** Number of weeks to count "times late" for rating and payment history. */
export const LOOKBACK_WEEKS_FOR_LATENESS = 12;

/** Weeks ago to compare against for trend (improving / stable / deteriorating). */
export const TREND_LOOKBACK_WEEKS = 3;

/** A cycle's payment is "late" if paid more than this many days after the cycle due date. */
export const LATE_DAYS_THRESHOLD = 7;

/** Show yellow row when missed payments count is at least this. */
export const HIGHLIGHT_YELLOW_MIN_MISSED = 2;

/** Show yellow row when times late in lookback is at least this (chronically late). */
export const HIGHLIGHT_YELLOW_TIMES_LATE_IN_LOOKBACK = 2;

/** Show red row when missed payments count is at least this. */
export const HIGHLIGHT_RED_MIN_MISSED = 3;

/** Show red when trend is deteriorating and missed count is at least this. */
export const HIGHLIGHT_RED_DETERIORATING_MIN_MISSED = 2;
