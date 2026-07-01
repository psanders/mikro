/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { TagSource } from "../schemas/customerTag.js";

/**
 * A tag on a customer. `source` is `AUTO` (owned by the tag engine, recomputed
 * every trigger) or `MANUAL` (set/cleared by a human via API/CLI; the engine
 * never reads or writes these for derivation).
 */
export interface CustomerTag {
  id: string;
  tag: string;
  source: TagSource;
  customerId: string;
  setAt: Date;
}
