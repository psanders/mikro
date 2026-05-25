/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

export const getCollectorDashboardSchema = z.object({}).optional();

export type GetCollectorDashboardInput = z.infer<typeof getCollectorDashboardSchema>;
