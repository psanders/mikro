/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Single definition of the solicitud form's sections and required fields,
 * mirroring the `required` attributes on site/src/solicitud/SectionFields.tsx.
 * Kept in @mikro/common so the site (progress tracking, the completion
 * beacon) and the apiserver (the ad-quality report's form-completeness
 * numbers) read the same shape instead of two copies drifting apart —
 * exactly the gap issue #280's report cannot see on its own, since Meta's own
 * attribution reports zero.
 *
 * "Completeness" only means something for a DRAFT: a submitted application
 * already has every required field (the browser refuses to submit the form
 * otherwise), so completeness there is always 1. The real signal is how far
 * someone got before they left — which is why this module also exports the
 * autosave payload builder the site's toggle handler and its leave-page
 * beacon both call, so the two paths can never send different shapes.
 *
 * Pure module: no DOM, no Zod, no server dependency. Safe to import from the
 * browser bundle (site, dashboard) as well as the apiserver.
 */

/**
 * Dominican provinces as the form's dropdown offers them: enum value (what the
 * form posts and what `applications.coveredProvinces` in mikro.json lists) +
 * display label. The single source for the site dropdown, `PROVINCE_LABELS`,
 * and the config enum.
 */
export const PROVINCES = [
  { value: "AZUA", label: "Azua" },
  { value: "BAHORUCO", label: "Bahoruco" },
  { value: "BARAHONA", label: "Barahona" },
  { value: "DAJABON", label: "Dajabón" },
  { value: "DISTRITO_NACIONAL", label: "Distrito Nacional" },
  { value: "DUARTE", label: "Duarte" },
  { value: "ELIAS_PINA", label: "Elías Piña" },
  { value: "EL_SEIBO", label: "El Seibo" },
  { value: "ESPAILLAT", label: "Espaillat" },
  { value: "HATO_MAYOR", label: "Hato Mayor" },
  { value: "HERMANAS_MIRABAL", label: "Hermanas Mirabal" },
  { value: "INDEPENDENCIA", label: "Independencia" },
  { value: "LA_ALTAGRACIA", label: "La Altagracia" },
  { value: "LA_ROMANA", label: "La Romana" },
  { value: "LA_VEGA", label: "La Vega" },
  { value: "MARIA_TRINIDAD_SANCHEZ", label: "María Trinidad Sánchez" },
  { value: "MONSENOR_NOUEL", label: "Monseñor Nouel" },
  { value: "MONTE_CRISTI", label: "Monte Cristi" },
  { value: "MONTE_PLATA", label: "Monte Plata" },
  { value: "PEDERNALES", label: "Pedernales" },
  { value: "PERAVIA", label: "Peravia" },
  { value: "PUERTO_PLATA", label: "Puerto Plata" },
  { value: "SAMANA", label: "Samaná" },
  { value: "SAN_CRISTOBAL", label: "San Cristóbal" },
  { value: "SAN_JOSE_DE_OCOA", label: "San José de Ocoa" },
  { value: "SAN_JUAN", label: "San Juan" },
  { value: "SAN_PEDRO_DE_MACORIS", label: "San Pedro de Macorís" },
  { value: "SANCHEZ_RAMIREZ", label: "Sánchez Ramírez" },
  { value: "SANTIAGO", label: "Santiago" },
  { value: "SANTIAGO_RODRIGUEZ", label: "Santiago Rodríguez" },
  { value: "SANTO_DOMINGO", label: "Santo Domingo" },
  { value: "VALVERDE", label: "Valverde" }
] as const;

export type Province = (typeof PROVINCES)[number]["value"];

/** Province enum values, as a non-empty tuple (usable directly with `z.enum`). */
export const PROVINCE_VALUES = PROVINCES.map((p) => p.value) as [Province, ...Province[]];

/**
 * Normalize a province to a comparable key: uppercase, strip diacritics, and
 * collapse any run of non-alphanumerics to a single `_`. "Puerto Plata",
 * "PUERTO_PLATA" and "puerto plata." all become "PUERTO_PLATA" — the same rule
 * the scoring engine's zone check uses.
 */
export function normalizeProvinceKey(province: string): string {
  return province
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Whether an applicant's province is outside the covered area. Only a positive
 * signal counts: an empty or missing province is never "out of area", so an
 * application is only auto-rejected when it actually names a province we don't
 * serve.
 */
export function isOutOfCoverageArea(
  province: string | null | undefined,
  coveredProvinces: readonly string[]
): boolean {
  const key = normalizeProvinceKey(province ?? "");
  if (!key) return false;
  return !coveredProvinces.some((covered) => normalizeProvinceKey(covered) === key);
}

/** One section of the form, in display order, with its required content keys. */
export interface ApplicationSectionDef {
  id: string;
  requiredFields: readonly string[];
}

// Order and required fields mirror SECTION_DEFS + the `required` props in
// site/src/solicitud/SectionFields.tsx. spouseName/spousePhone (familiar) and
// addressReference (vivienda) are optional there, so they are left out here.
export const APPLICATION_SECTIONS: readonly ApplicationSectionDef[] = [
  {
    id: "personal",
    requiredFields: ["firstName", "lastName", "phone", "idNumber", "dateOfBirth", "maritalStatus"]
  },
  {
    id: "negocio",
    requiredFields: [
      "businessType",
      "businessName",
      "businessAge",
      "monthlySales",
      "locationType",
      "formalization",
      "employeeCount",
      "businessPhone"
    ]
  },
  {
    id: "credito",
    requiredFields: ["requestedAmount", "purpose", "requestedTermWeeks"]
  },
  {
    id: "familiar",
    requiredFields: ["referenceName", "referencePhone"]
  },
  {
    id: "vivienda",
    requiredFields: ["housingType", "residenceTime", "homeAddress", "province"]
  }
] as const;

/** Ordered section ids, for callers that only need the order (e.g. the ctl histogram). */
export const APPLICATION_SECTION_IDS: readonly string[] = APPLICATION_SECTIONS.map((s) => s.id);

const TOTAL_REQUIRED_FIELDS = APPLICATION_SECTIONS.reduce(
  (sum, section) => sum + section.requiredFields.length,
  0
);

/** A field counts as answered when it is a non-empty string after trimming. */
function isFilled(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export interface FormProgress {
  /** How many sections the applicant reached, 0-5. 0 means `lastSection` was empty or unrecognized. */
  sectionsReached: number;
  /** Required fields filled, across every section. */
  requiredFilled: number;
  /** The form's fixed total of required fields (currently 23). */
  requiredTotal: number;
  /** requiredFilled / requiredTotal, 0-1. */
  completeness: number;
}

/**
 * How far one applicant got. Pure and lenient — it takes an object and
 * returns an object, validates nothing, and never throws: missing `rawData`
 * reads as no fields filled, and an unrecognized `lastSection` (renamed
 * section, stale client) reads as `sectionsReached: 0` rather than a crash.
 *
 * @param rawData - The stored `rawData` off a `LoanApplication`, or the form's
 *   own in-progress state (same field-key shape).
 * @param lastSection - The section id the applicant most recently had open.
 */
export function computeFormProgress(
  rawData: Record<string, unknown> | null | undefined,
  lastSection: string | null | undefined
): FormProgress {
  const fields = rawData ?? {};
  const sectionIndex = lastSection
    ? APPLICATION_SECTIONS.findIndex((section) => section.id === lastSection)
    : -1;
  const sectionsReached = sectionIndex === -1 ? 0 : sectionIndex + 1;

  let requiredFilled = 0;
  for (const section of APPLICATION_SECTIONS) {
    for (const key of section.requiredFields) {
      if (isFilled(fields[key])) requiredFilled += 1;
    }
  }

  return {
    sectionsReached,
    requiredFilled,
    requiredTotal: TOTAL_REQUIRED_FIELDS,
    completeness: TOTAL_REQUIRED_FIELDS === 0 ? 0 : requiredFilled / TOTAL_REQUIRED_FIELDS
  };
}

/**
 * Whether every required field of one section is filled. Used by the site to
 * decide when to fire the `SolicitudProgress` Meta custom event — a coarser,
 * higher-volume signal than the final `Lead` (see metaPixel.ts).
 */
export function isSectionComplete(
  sectionId: string,
  fields: Record<string, unknown> | null | undefined
): boolean {
  const section = APPLICATION_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return false;
  const values = fields ?? {};
  return section.requiredFields.every((key) => isFilled(values[key]));
}

/**
 * Builds the wire payload for a partial-save POST to the public intake
 * endpoint (`/v1/applications`): the form's current field values plus
 * whichever ad attribution the session captured, tagged as a partial
 * autosave under one `sessionId`.
 *
 * Shared by the site's section-toggle autosave and its pagehide/
 * visibilitychange-hidden beacon, so the two paths always send the same
 * shape — one of them missing a field the other sends would silently break
 * either the draft record or its attribution.
 */
export function buildAutosavePayload(
  form: Record<string, string>,
  attribution: Record<string, string | undefined>,
  sessionId: string,
  lastSection: string
): Record<string, unknown> {
  return {
    ...form,
    ...attribution,
    sessionId,
    partial: true,
    lastSection
  };
}

// ---- option lists (shared by the website form and the founder app's edit panel) ----

export type SelectOption = string | { value: string; label: string };

export const ESTADO_CIVIL_OPTIONS = [
  "Soltero(a)",
  "Casado(a)",
  "Unión libre",
  "Divorciado(a)",
  "Viudo(a)"
];

// Business type — enum value + display label. Risk is scored downstream, not here.
export const TIPO_NEGOCIO_OPTIONS: SelectOption[] = [
  { value: "COLMADO", label: "Colmado" },
  { value: "SUPERMERCADO_PEQUENO", label: "Supermercado pequeño" },
  { value: "FARMACIA", label: "Farmacia" },
  { value: "FERRETERIA", label: "Ferretería" },
  { value: "DISTRIBUIDORA_ALIMENTOS", label: "Distribuidora de alimentos" },
  { value: "PANADERIA", label: "Panadería" },
  { value: "CLINICA_PEQUENA", label: "Clínica pequeña" },
  { value: "LABORATORIO", label: "Laboratorio" },
  { value: "AGUA_PURIFICADA", label: "Agua purificada" },
  { value: "VETERINARIA", label: "Veterinaria" },
  { value: "PAPELERIA", label: "Papelería" },
  { value: "VENTA_REPUESTOS", label: "Venta de repuestos" },
  { value: "LAVANDERIA", label: "Lavandería" },
  { value: "SERVICIOS_FUNERARIOS", label: "Servicios funerarios" },
  { value: "SALON_BELLEZA_BARBERIA", label: "Salón de belleza / barbería" },
  { value: "CENTRO_UNAS", label: "Centro de uñas" },
  { value: "RESTAURANTE", label: "Restaurante" },
  { value: "FOOD_TRUCK", label: "Food truck" },
  { value: "BOUTIQUE_ROPA", label: "Boutique / tienda de ropa" },
  { value: "GIMNASIO", label: "Gimnasio" },
  { value: "TALLER_MECANICO", label: "Taller mecánico" },
  { value: "DEALER_VEHICULOS", label: "Dealer de vehículos" },
  { value: "EBANISTERIA", label: "Ebanistería" },
  { value: "IMPRENTA", label: "Imprenta" },
  { value: "ESTUDIO_FOTOGRAFICO", label: "Estudio fotográfico" },
  { value: "EMPRESA_EVENTOS", label: "Empresa de eventos" },
  { value: "HELADERIA", label: "Heladería" },
  { value: "TIENDA_MUEBLES", label: "Tienda de muebles" },
  { value: "BANCA_APUESTAS", label: "Banca de apuestas" },
  { value: "DISCOTECA", label: "Discoteca" },
  { value: "BAR_LIQUOR_STORE", label: "Bar / liquor store" },
  { value: "VENTA_AMBULANTE", label: "Venta ambulante" },
  { value: "NEGOCIO_DIGITAL", label: "Negocio totalmente digital" },
  { value: "REVENTA_REDES", label: "Reventa por redes sociales" },
  { value: "AGRICULTURA", label: "Agricultura" },
  { value: "PESCA_ARTESANAL", label: "Pesca artesanal" },
  { value: "CONSTRUCCION_PEQUENA", label: "Construcción independiente pequeña" },
  { value: "OTRO", label: "Otro" }
];
export const TIEMPO_OPERANDO_OPTIONS = [
  "Menos de 6 meses",
  "6 meses a 1 año",
  "1 a 3 años",
  "3 a 5 años",
  "Más de 5 años"
];
export const VENTAS_MENSUALES_OPTIONS = [
  "Menos de RD$25,000",
  "RD$25,000 – RD$50,000",
  "RD$50,000 – RD$100,000",
  "RD$100,000 – RD$250,000",
  "RD$250,000 – RD$500,000",
  "Más de RD$500,000"
];
export const TIPO_LOCAL_OPTIONS = ["Propio", "Alquilado", "En mi vivienda"];
export const FORMALIZACION_OPTIONS = ["Tiene RNC (formalizado)", "Informal (sin RNC)"];
export const NUM_EMPLEADOS_OPTIONS = ["Solo yo", "1 a 3", "4 a 10", "Más de 10"];
// A fixed menu instead of a free amount, so nobody asks for more than we lend.
// Values keep the thousands-separated string the free-form field used to send
// ("15,000"), which the apiserver's normalizer already parses to 15000.
export const MONTO_OPTIONS: SelectOption[] = [5, 10, 15, 20, 25, 30].map((k) => {
  const amount = (k * 1000).toLocaleString("en-US");
  return { value: amount, label: `RD$${amount}` };
});
export const PLAZO_OPTIONS = ["10 semanas", "12 semanas", "15 semanas", "18 semanas"];
export const TIPO_VIVIENDA_OPTIONS = ["Propia", "Alquilada", "Familiar", "Otra"];
export const TIEMPO_RESIDIENDO_OPTIONS = [
  "Menos de 1 año",
  "1 a 3 años",
  "3 a 5 años",
  "5 a 10 años",
  "Más de 10 años"
];
export const PROPOSITO_OPTIONS = [
  "Capital de trabajo",
  "Compra de inventario / mercancía",
  "Compra de equipos / maquinaria",
  "Remodelación / ampliación del local",
  "Compra o reparación de vehículo de trabajo",
  "Pago a proveedores",
  "Expansión / nueva sucursal",
  "Consolidación de deudas del negocio",
  "Otro"
];
