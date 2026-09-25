/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Deterministic in-memory data for Maestro e2e builds, served by `e2eMockLink`
 * in place of a live apiserver. The mobile app is the collector app (the
 * evaluator moved to the Ops desktop app), so only the collector flows'
 * procedures are stubbed here.
 */

export const E2E_USERS = [{ id: "e2e-collector-1", name: "Pedro Test" }];

/** Send-promo stub (mikro/#68) — always succeeds so the mobile "Enviar promoción" flow round-trips. */
export function e2eSendPromo(): { sent: true; messageId: string } {
  return { sent: true, messageId: "e2e-promo-msg-1" };
}
