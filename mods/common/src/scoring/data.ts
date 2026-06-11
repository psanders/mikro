/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Business-risk lookup for the Mikro Score engine, aligned 1:1 with the public
 * form's `tipoNegocio` codes and classified per NIVELES DE RIESGO DE NEGOCIOS
 * EN RD.pdf (the credit-policy source of truth). The PDF's "Riesgo Crítico"
 * categories (negocios ilegales, casinos informales, pirámides, prestamistas
 * informales, etc.) are not offered as form options, so no code maps to
 * CRITICO today; the level remains for evaluator overrides and future codes.
 * An unmapped or OTRO `tipoNegocio` is scored MEDIO and flagged for manual
 * classification.
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
  // Riesgo Bajo
  COLMADO: "BAJO",
  FARMACIA: "BAJO",
  FERRETERIA: "BAJO",
  SUPERMERCADO_PEQUENO: "BAJO",
  DISTRIBUIDORA_ALIMENTOS: "BAJO",
  PANADERIA: "BAJO",
  CLINICA_PEQUENA: "BAJO",
  LABORATORIO: "BAJO",
  AGUA_PURIFICADA: "BAJO",
  VETERINARIA: "BAJO",
  PAPELERIA: "BAJO",
  VENTA_REPUESTOS: "BAJO",
  LAVANDERIA: "BAJO",
  SERVICIOS_FUNERARIOS: "BAJO",
  // Riesgo Medio
  SALON_BELLEZA_BARBERIA: "MEDIO",
  RESTAURANTE: "MEDIO",
  FOOD_TRUCK: "MEDIO",
  BOUTIQUE_ROPA: "MEDIO",
  GIMNASIO: "MEDIO",
  CENTRO_UNAS: "MEDIO",
  TALLER_MECANICO: "MEDIO",
  DEALER_VEHICULOS: "MEDIO",
  EBANISTERIA: "MEDIO",
  IMPRENTA: "MEDIO",
  ESTUDIO_FOTOGRAFICO: "MEDIO",
  EMPRESA_EVENTOS: "MEDIO",
  HELADERIA: "MEDIO",
  TIENDA_MUEBLES: "MEDIO",
  // Riesgo Alto
  BANCA_APUESTAS: "ALTO",
  DISCOTECA: "ALTO",
  BAR_LIQUOR_STORE: "ALTO",
  VENTA_AMBULANTE: "ALTO",
  NEGOCIO_DIGITAL: "ALTO",
  AGRICULTURA: "ALTO",
  PESCA_ARTESANAL: "ALTO",
  CONSTRUCCION_PEQUENA: "ALTO",
  REVENTA_REDES: "ALTO",
  OTRO: null
};
