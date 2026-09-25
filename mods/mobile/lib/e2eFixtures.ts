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

const E2E_IN_REVIEW_SINCE = new Date(Date.now() - 3 * 86_400_000).toISOString();

/** Evidence list stub (add-collector-evidence): one incomplete, one complete. */
export function e2eEvidenceQueue() {
  const base = {
    phone: "(809) 555-0101",
    province: "PUERTO_PLATA",
    addressReference: "Frente al parque",
    inReviewSince: E2E_IN_REVIEW_SINCE
  };
  return [
    {
      ...base,
      id: "e2e-app-1",
      firstName: "Yendri",
      lastName: "Paredes",
      businessName: "Baberos",
      homeAddress: "C/ Duarte #45, Los Reyes",
      progress: { have: 1, need: 6 },
      complete: false
    },
    {
      ...base,
      id: "e2e-app-2",
      firstName: "José",
      lastName: "Padilla",
      businessName: "Padilla Rentals",
      homeAddress: "C/ 12 de Julio #8",
      progress: { have: 6, need: 6 },
      complete: true
    }
  ];
}

/** Evidence detail stub for the incomplete application. */
export function e2eEvidenceTask() {
  const item = e2eEvidenceQueue()[0]!;
  return {
    ...item,
    mapUrl: null,
    idFront: true,
    idBack: false,
    documents: [],
    status: {
      location: false,
      idFront: true,
      idBack: false,
      businessPhotos: { have: 0, need: 3 },
      complete: false
    }
  };
}
