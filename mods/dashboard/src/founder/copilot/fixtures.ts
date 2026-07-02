/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Dominican-Spanish presentational fixtures for the copilot dock stories,
 * mirroring the Pencil export copy (copilot.html / card-catalog.html).
 */
import type { CopilotPendingAction, CopilotProvenance, CopilotRule } from "./types";

export const analyzeProvenance: CopilotProvenance = {
  tools: ["analizar_mora"],
  elapsedMs: 1200
};

export const collectionProvenance: CopilotProvenance = {
  tools: ["cobranza_de_hoy"],
  elapsedMs: 800
};

export const ruleProvenance: CopilotProvenance = {
  tools: ["crear_regla"],
  elapsedMs: 900
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

export const activeRule: CopilotRule = {
  id: "a1b2c3d4-1111-2222-3333-444455556666",
  name: "Mora por ruta",
  metric: "mora_pct_collector",
  comparator: "gt",
  threshold: 9,
  enabled: true
};

export const disabledRule: CopilotRule = {
  id: "b2c3d4e5-2222-3333-4444-555566667777",
  name: "Cobranza diaria mínima",
  metric: "cobranza_diaria",
  comparator: "lt",
  threshold: 20000,
  enabled: false
};

export const activeRuleNote =
  "Probé con los datos de hoy: ninguna ruta la supera. La más cercana es Villa Consuelo con 8.7%.";
