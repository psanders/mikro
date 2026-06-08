/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Business-risk lookup for the Mikro Score engine, ported verbatim from the
 * mikro-score skill's data/riesgo_negocios.json. Source:
 * NIVELES_DE_RIESGO_DE_NEGOCIOS_EN_RD.pdf (reconstructed; recalibrate against
 * real default history). An unmapped `tipoNegocio` code is scored MEDIO and
 * flagged for manual classification.
 */

export type RiskLevel = "BAJO" | "MEDIO" | "ALTO" | "CRITICO";

export const PUNTAJE_POR_NIVEL: Record<RiskLevel, number> = {
  BAJO: 90,
  MEDIO: 65,
  ALTO: 40,
  CRITICO: 10
};

// Maps the form's `tipoNegocio` code to its risk level. `null` => unrecognized.
export const MAPA_CODIGOS: Record<string, RiskLevel | null> = {
  COLMADO: "BAJO",
  SALON_BELLEZA_BARBERIA: "BAJO",
  FARMACIA: "BAJO",
  FERRETERIA: "BAJO",
  PULPERIA: "BAJO",
  VENTA_VIVERES: "BAJO",
  RESTAURANTE: "MEDIO",
  COMEDOR: "MEDIO",
  VENTA_ROPA: "MEDIO",
  VENTA_CALZADO: "MEDIO",
  TALLER: "MEDIO",
  AGROPECUARIA: "MEDIO",
  TRANSPORTE: "MEDIO",
  CONSTRUCCION: "ALTO",
  ARTESANIA: "ALTO",
  BAR_LIQUOR_STORE: "ALTO",
  DISCOTECA: "ALTO",
  PRESTAMISTA: "ALTO",
  JUEGOS_AZAR: "CRITICO",
  BANCA_LOTERIA: "CRITICO",
  OTRO: null
};
