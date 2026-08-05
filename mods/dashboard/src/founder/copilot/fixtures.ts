/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Dominican-Spanish presentational fixtures for the copilot dock stories,
 * mirroring the Pencil export copy (copilot.html / card-catalog.html).
 */
import type { CopilotPendingAction, CopilotProvenance } from "./types";

export const analyzeProvenance: CopilotProvenance = {
  tools: ["analizar_mora"],
  elapsedMs: 1200
};

export const collectionProvenance: CopilotProvenance = {
  tools: ["cobranza_de_hoy"],
  elapsedMs: 800
};

export const paymentPendingAction: CopilotPendingAction = {
  id: "0f9c6d2a-6c1e-4b6f-9d2a-1a2b3c4d5e6f",
  toolName: "createPayment",
  summary: "registrar pago RD$2,000 — Franklin N.",
  status: "PENDING",
  createdAt: new Date("2026-07-01T10:11:00"),
  args: {
    cliente: "Franklin Núñez",
    monto: 2000,
    prestamo: "#201",
    metodo: "efectivo",
    origen: "chat"
  }
};
