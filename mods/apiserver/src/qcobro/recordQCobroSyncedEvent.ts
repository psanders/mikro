/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Records the `qcobro.synced` feed event from a sync result. Shared by the
 * cron worker and the copilot's on-demand forceQCobroSync tool (mikro/#130)
 * so every sync surface writes an identical feed entry.
 */
import { recordEvent, type EventClient } from "../api/events/recordEvent.js";
import type { SyncAllPortfoliosResult } from "./createSyncAllPortfolios.js";

export async function recordQCobroSyncedEvent(
  client: EventClient,
  result: SyncAllPortfoliosResult,
  actorName = "Sistema"
): Promise<void> {
  await recordEvent(client, {
    type: "qcobro.synced",
    actorName,
    summary: `Sincronización QCobro completada: ${result.customers} clientes procesados, ${result.portfoliosPushed} portafolios enviados, ${result.portfoliosSkipped} omitidos (${result.durationMs} ms).`,
    payload: {
      customers: result.customers,
      portfoliosPushed: result.portfoliosPushed,
      portfoliosSkipped: result.portfoliosSkipped,
      durationMs: result.durationMs
    }
  });
}
