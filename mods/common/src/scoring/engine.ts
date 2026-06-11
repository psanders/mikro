/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Mikro Score — deterministic credit-scoring engine and the reference spec for
 * the model. Pure and side-effect-free: given identical input + CONFIG it
 * returns an identical ApplicationScore. Matches on the form's Spanish display
 * values (e.g. "Propia", "Informal (sin RNC)", "Más de 5 años"), which is what
 * LoanApplication.rawData stores. Empty answers score 0; fallback midpoints
 * apply only to non-empty unrecognized values.
 */
import type { NormalizedApplication } from "../schemas/application.js";
import { MAPA_CODIGOS, PUNTAJE_POR_NIVEL, type RiskLevel } from "./data.js";
import type {
  ApplicationScore,
  Confidence,
  EvaluatorNote,
  FlagCode,
  Recommendation,
  RiskBand,
  ScoreCategory,
  ScoreFlag
} from "./types.js";

export const CONFIG = {
  pesos: {
    capacidad_pago: 30,
    riesgo_negocio: 20,
    trayectoria_formalizacion: 20,
    arraigo_estabilidad: 15,
    red_soporte: 10,
    proposito: 5
  },
  tasa_flat: 0.3,
  margen_neto: 0.3,
  semanas_por_mes: 4.345,
  zona_cobertura: "PUERTO_PLATA",
  // [threshold, internal band]; first whose threshold the score meets wins.
  bandas: [
    [80, "BAJO"],
    [65, "MODERADO"],
    [50, "MEDIO_ALTO"],
    [35, "ALTO"],
    [0, "MUY_ALTO"]
  ] as const
};

type InternalBand = "BAJO" | "MODERADO" | "MEDIO_ALTO" | "ALTO" | "MUY_ALTO";

const BAND_TO_ENGLISH: Record<InternalBand, RiskBand> = {
  BAJO: "LOW_RISK",
  MODERADO: "MODERATE_RISK",
  MEDIO_ALTO: "MEDIUM_HIGH_RISK",
  ALTO: "HIGH_RISK",
  MUY_ALTO: "VERY_HIGH_RISK"
};

/** Internal scorer input — the fields the engine reads (display values). */
export interface ScoreInput {
  name: string;
  age: number | null;
  idNumber: string;
  phone: string;
  businessType: string;
  businessName: string;
  province: string;
  monthlySales: string | null;
  requestedAmount: number | null;
  requestedTermWeeks: number | null;
  businessAge: string | null;
  formalization: string | null;
  locationType: string | null;
  employeeCount: string | null;
  housingType: string | null;
  residenceTime: string | null;
  homeAddress: string | null;
  addressReference: string | null;
  referenceName: string | null;
  referencePhone: string | null;
  spouseName: string | null;
  spousePhone: string | null;
  businessPhone: string | null;
  purpose: string | null;
  maritalStatus: string | null;
  partial: boolean;
}

// ---- helpers (faithful to scoring_engine.py) ----

function has(v: unknown): boolean {
  return Boolean(v && String(v).trim());
}

function lc(v: string | null | undefined): string {
  return (v ?? "").toLowerCase();
}

/** Average of the numbers in a money-range string ("RD$50,000 – RD$100,000" -> 75000). */
function parseMoneyRange(s: string | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\./g, "");
  const matches = cleaned.match(/\d[\d,]*/g);
  if (!matches) return null;
  const vals = matches
    .map((n) => parseInt(n.replace(/,/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** First substring key that appears in `text`, else `fallback`. Order-sensitive. */
function firstMatch(text: string, map: Array<[string, number]>, fallback: number): number {
  const t = text.toLowerCase();
  for (const [k, v] of map) {
    if (t.includes(k)) return v;
  }
  return fallback;
}

function bandFor(score: number): InternalBand {
  for (const [low, name] of CONFIG.bandas) {
    if (score >= low) return name as InternalBand;
  }
  return "MUY_ALTO";
}

// ---- category scorers ----

interface CapacityInfo {
  ventas: number | null;
  monto: number | null;
  semanas: number | null;
  dsr: number | null;
  cuota: number | null;
  ingreso_neto: number | null;
}

function scoreCapacity(
  input: ScoreInput,
  flags: ScoreFlag[]
): { score: number; info: CapacityInfo } {
  const ventas = parseMoneyRange(input.monthlySales);
  const monto = input.requestedAmount;
  const semanas = input.requestedTermWeeks;
  const info: CapacityInfo = {
    ventas,
    monto,
    semanas,
    dsr: null,
    cuota: null,
    ingreso_neto: null
  };
  if (!ventas || !monto || !semanas) {
    flags.push({
      code: "INCOMPLETE_DATA",
      message: "Faltan datos de capacidad de pago (ventas / monto / plazo)."
    });
    return { score: 0, info };
  }
  const meses = semanas / CONFIG.semanas_por_mes;
  const cuota = (monto * (1 + CONFIG.tasa_flat)) / meses;
  const ingresoNeto = ventas * CONFIG.margen_neto;
  const dsr = ingresoNeto ? cuota / ingresoNeto : 99;
  info.dsr = Math.round(dsr * 1000) / 1000;
  info.cuota = Math.round(cuota);
  info.ingreso_neto = Math.round(ingresoNeto);
  const s =
    dsr <= 0.1
      ? 100
      : dsr <= 0.2
        ? 88
        : dsr <= 0.3
          ? 72
          : dsr <= 0.45
            ? 52
            : dsr <= 0.6
              ? 32
              : dsr <= 1.0
                ? 15
                : 5;
  return { score: s, info };
}

interface BusinessRiskInfo {
  codigo: string;
  nivel: RiskLevel | null;
  reconocido: boolean;
}

function scoreBusinessRisk(
  input: ScoreInput,
  flags: ScoreFlag[]
): { score: number; info: BusinessRiskInfo } {
  const code = (input.businessType || "").trim().toUpperCase();
  const nivel = MAPA_CODIGOS[code];
  const reconocido = code in MAPA_CODIGOS && nivel != null;
  const info: BusinessRiskInfo = { codigo: code, nivel: nivel ?? null, reconocido };
  if (!code) {
    return { score: 0, info };
  }
  if (nivel === "CRITICO") {
    flags.push({ code: "CRITICAL_BUSINESS", message: `Rubro ${code} en categoria CRITICA.` });
    return { score: PUNTAJE_POR_NIVEL.CRITICO, info };
  }
  if (nivel == null) {
    info.nivel = "MEDIO";
    return { score: PUNTAJE_POR_NIVEL.MEDIO, info };
  }
  return { score: PUNTAJE_POR_NIVEL[nivel], info };
}

// Empty answers earn 0; firstMatch fallbacks apply only to non-empty
// unrecognized values, so partial applications don't collect default points.
function scoreTrackRecord(input: ScoreInput): { score: number; formalOk: boolean } {
  let s = 0;
  if (has(input.businessAge)) {
    s += firstMatch(
      lc(input.businessAge),
      [
        ["más de 5", 40],
        ["3 a 5", 34],
        ["1 a 3", 26],
        ["6 meses", 16],
        ["menos de", 6]
      ],
      16
    );
  }
  const formal = lc(input.formalization);
  const formalOk = formal.includes("rnc") && !formal.includes("sin");
  s += formalOk ? 30 : has(input.formalization) ? 8 : 0;
  if (has(input.locationType)) {
    s += firstMatch(
      lc(input.locationType),
      [
        ["propio", 18],
        ["alquilado", 12],
        ["vivienda", 8]
      ],
      8
    );
  }
  s += has(input.employeeCount) ? 12 : 0;
  return { score: Math.min(s, 100), formalOk };
}

function scoreRootedness(input: ScoreInput): { score: number; direccionVerificable: boolean } {
  let s = 0;
  if (has(input.housingType)) {
    s += firstMatch(
      lc(input.housingType),
      [
        ["propia", 45],
        ["familiar", 32],
        ["alquilada", 20]
      ],
      20
    );
  }
  if (has(input.residenceTime)) {
    s += firstMatch(
      lc(input.residenceTime),
      [
        ["más de 10", 40],
        ["5 a 10", 32],
        ["1 a 5", 22],
        ["menos de", 10]
      ],
      15
    );
  }
  const dirOk = has(input.homeAddress);
  const refOk = has(input.addressReference);
  s += dirOk && refOk ? 15 : dirOk ? 8 : 0;
  return { score: Math.min(s, 100), direccionVerificable: dirOk && refOk };
}

interface SupportInfo {
  referencia: string;
  conyuge: string;
  telefono_negocio: string;
}

function scoreSupport(input: ScoreInput): { score: number; info: SupportInfo } {
  let s = 0;
  const ref = has(input.referenceName) && has(input.referencePhone);
  s += ref ? 45 : has(input.referenceName) ? 20 : 0;
  const cony = has(input.spouseName) && has(input.spousePhone);
  s += cony ? 25 : 0;
  const tel = has(input.businessPhone);
  s += tel ? 30 : 0;
  return {
    score: Math.min(s, 100),
    info: {
      referencia: ref ? "Completa" : "Falta",
      conyuge: cony ? "Si" : "No aplica / falta",
      telefono_negocio: tel ? "Si" : "No"
    }
  };
}

function scorePurpose(input: ScoreInput): { score: number; clasificacion: string } {
  const p = lc(input.purpose);
  if (
    ["equipo", "maquinaria", "inventario", "mercanc", "expansi", "local"].some((k) => p.includes(k))
  ) {
    return { score: 100, clasificacion: "Productivo" };
  }
  if (p.includes("capital de trabajo")) {
    return { score: 75, clasificacion: "Capital de trabajo" };
  }
  if (["consumo", "personal", "deuda", "pago de"].some((k) => p.includes(k))) {
    return { score: 35, clasificacion: "Consumo" };
  }
  return p.trim()
    ? { score: 60, clasificacion: "Otro" }
    : { score: 0, clasificacion: "Sin clasificar" };
}

function recommend(band: InternalBand, flags: ScoreFlag[]): [Recommendation, Confidence] {
  const codes = new Set<FlagCode>(flags.map((f) => f.code));
  if (codes.has("OUT_OF_ZONE")) return ["REJECT_OUT_OF_ZONE", "HIGH"];
  if (codes.has("CRITICAL_BUSINESS")) return ["REJECT_CRITICAL_BUSINESS", "HIGH"];
  if (codes.has("INCOMPLETE_DATA")) return ["MANUAL_REVIEW", "LOW"];
  const map: Record<InternalBand, [Recommendation, Confidence]> = {
    BAJO: ["APPROVE", "HIGH"],
    MODERADO: ["APPROVE_WITH_CONDITIONS", "MEDIUM"],
    MEDIO_ALTO: ["MANUAL_REVIEW", "MEDIUM"],
    ALTO: ["LIKELY_REJECT", "MEDIUM"],
    MUY_ALTO: ["REJECT", "HIGH"]
  };
  return map[band];
}

function evaluatorNotes(
  input: ScoreInput,
  cap: CapacityInfo,
  businessRecognized: boolean,
  flags: ScoreFlag[]
): EvaluatorNote[] {
  const n: EvaluatorNote[] = [];
  const codes = new Set<FlagCode>(flags.map((f) => f.code));
  if (codes.has("OUT_OF_ZONE")) {
    n.push({
      topic: "Cobertura",
      question: `La provincia (${input.province || "s/d"}) esta fuera de la zona de cobertura.`,
      reason: "Solo se atiende Puerto Plata; confirmar antes de continuar."
    });
  }
  if (codes.has("INCOMPLETE_DATA")) {
    n.push({
      topic: "Datos incompletos",
      question: "Faltan datos clave para estimar la capacidad de pago.",
      reason: "Capturar ventas mensuales, monto solicitado y plazo."
    });
  }
  const dsr = cap.dsr;
  if (dsr != null && dsr > 0.45) {
    n.push({
      topic: "Capacidad de pago",
      question: `El DSR estimado (${Math.round(dsr * 100)}%) es muy alto: la cuota supera el margen sano del ingreso.`,
      reason: "Verificar ventas reales; considerar reducir el monto o extender el plazo."
    });
  } else if (dsr != null && dsr > 0.3) {
    n.push({
      topic: "Capacidad de pago",
      question: `El DSR estimado (${Math.round(dsr * 100)}%) es elevado.`,
      reason: "Confirmar ventas y estacionalidad del negocio."
    });
  }
  if (lc(input.formalization).includes("informal")) {
    n.push({
      topic: "Verificacion de ingresos",
      question:
        "El negocio es informal (sin RNC). Solicitar evidencia de las ventas declaradas: fotos del local con inventario, registro de ventas de 2-3 semanas, o visita de campo.",
      reason:
        "Sin RNC no hay estados financieros; las ventas mensuales son auto-declaradas y deben corroborarse."
    });
  }
  if (lc(input.locationType).includes("vivienda")) {
    n.push({
      topic: "Separacion negocio/hogar",
      question: "El negocio opera en la vivienda.",
      reason: "Confirmar separacion entre las finanzas del hogar y del negocio."
    });
  }
  if (lc(input.locationType).includes("alquilado")) {
    n.push({
      topic: "Costos fijos",
      question:
        "Local alquilado: preguntar monto de la renta mensual y si esta al dia. Confirmar que la renta + cuota Mikro no comprometan el flujo.",
      reason:
        "La renta es un gasto fijo no capturado en el formulario que reduce la capacidad real de pago."
    });
  }
  if (!has(input.businessType)) {
    n.push({
      topic: "Clasificacion del rubro",
      question: "El solicitante no indicó el tipo de negocio.",
      reason: "Capturar el rubro para poder clasificar el riesgo del negocio."
    });
  } else if (!businessRecognized) {
    n.push({
      topic: "Clasificacion del rubro",
      question: `Rubro '${(input.businessName || "").trim() || input.businessType}' no clasificado en la lista Mikro.`,
      reason: "Clasificar manualmente el nivel de riesgo del negocio."
    });
  }
  if (["menos de", "6 meses"].some((k) => lc(input.businessAge).includes(k))) {
    n.push({
      topic: "Trayectoria",
      question: "Trayectoria corta del negocio.",
      reason: "Validar continuidad y experiencia previa del solicitante en el rubro."
    });
  }
  if (!has(input.referenceName)) {
    n.push({
      topic: "Referencias",
      question: "No registra referencia personal.",
      reason: "Solicitar al menos una referencia verificable."
    });
  }
  if (["Casado(a)", "Unión libre"].includes(input.maritalStatus || "") && !has(input.spouseName)) {
    n.push({
      topic: "Codeudor",
      question: "Estado civil en pareja pero sin datos del conyuge.",
      reason: "Evaluar conyuge como codeudor."
    });
  }
  const { monto, ventas } = cap;
  if (monto && ventas && monto > ventas * 2) {
    n.push({
      topic: "Monto vs. ventas",
      question: `Monto solicitado (RD$${monto.toLocaleString("en-US")}) alto frente a ventas mensuales estimadas (RD$${Math.round(ventas).toLocaleString("en-US")}).`,
      reason: "Justificar el destino y la capacidad de repago."
    });
  }
  n.push({
    topic: "Identidad",
    question: "Validar cedula y datos de identidad en la entrevista.",
    reason: ""
  });
  return n;
}

/**
 * Run the deterministic Mikro Score model over a scorer input.
 */
export function scoreInput(input: ScoreInput): ApplicationScore {
  const w = CONFIG.pesos;
  const flags: ScoreFlag[] = [];

  const prov = (input.province || "").trim().toUpperCase();
  if (prov && prov !== CONFIG.zona_cobertura) {
    flags.push({ code: "OUT_OF_ZONE", message: `Provincia ${prov} fuera de zona de cobertura.` });
  }
  if (input.partial) {
    flags.push({
      code: "INCOMPLETE_DATA",
      message: "Solicitud en estado PARCIAL (no completada)."
    });
  }

  const cap = scoreCapacity(input, flags);
  const rn = scoreBusinessRisk(input, flags);
  const tr = scoreTrackRecord(input);
  const ar = scoreRootedness(input);
  const rd = scoreSupport(input);
  const pr = scorePurpose(input);

  const imsRaw =
    (cap.score * w.capacidad_pago +
      rn.score * w.riesgo_negocio +
      tr.score * w.trayectoria_formalizacion +
      ar.score * w.arraigo_estabilidad +
      rd.score * w.red_soporte +
      pr.score * w.proposito) /
    100;
  const ims = Math.round(imsRaw * 10) / 10;

  const internalBand = bandFor(ims);
  const [recommendation, confidence] = recommend(internalBand, flags);
  const codes = new Set<FlagCode>(flags.map((f) => f.code));
  const riskBand: RiskBand = codes.has("OUT_OF_ZONE")
    ? "OUT_OF_COVERAGE"
    : BAND_TO_ENGLISH[internalBand];

  const categories: ScoreCategory[] = [
    { category: "PAYMENT_CAPACITY", weight: w.capacidad_pago, score: Math.round(cap.score) },
    { category: "BUSINESS_TYPE_RISK", weight: w.riesgo_negocio, score: Math.round(rn.score) },
    {
      category: "TRACK_RECORD_FORMALIZATION",
      weight: w.trayectoria_formalizacion,
      score: Math.round(tr.score)
    },
    {
      category: "ROOTEDNESS_STABILITY",
      weight: w.arraigo_estabilidad,
      score: Math.round(ar.score)
    },
    { category: "SUPPORT_NETWORK", weight: w.red_soporte, score: Math.round(rd.score) },
    { category: "LOAN_PURPOSE", weight: w.proposito, score: Math.round(pr.score) }
  ];

  return {
    name: input.name,
    age: input.age,
    id_document: input.idNumber,
    phone: input.phone,
    business: {
      type_code: input.businessType,
      name: input.businessName,
      risk_level: rn.info.nivel ?? "MEDIO"
    },
    province: prov,
    isc: ims,
    risk_band: riskBand,
    recommendation,
    confidence,
    flags,
    categories,
    indicators: {
      amount_requested: { value: cap.info.monto, unit: "DOP" },
      term_weeks: { value: cap.info.semanas, unit: "weeks" },
      monthly_installment: { value: cap.info.cuota, unit: "DOP" },
      monthly_sales: {
        value: cap.info.ventas != null ? Math.round(cap.info.ventas) : null,
        unit: "DOP"
      },
      net_income: { value: cap.info.ingreso_neto, unit: "DOP" },
      debt_service_ratio: { value: cap.info.dsr, unit: "ratio" }
    },
    evaluator_notes: evaluatorNotes(input, cap.info, rn.info.reconocido, flags)
  };
}

function ageFromDate(dob: Date | null): number | null {
  if (!dob || Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

function rawStr(raw: Record<string, unknown>, key: string): string | null {
  const v = raw[key];
  return typeof v === "string" && v.trim() ? v : null;
}

/**
 * Build a scorer input from a normalized application (parsed stable fields +
 * rawData display values), then score it.
 */
export function scoreApplication(app: NormalizedApplication): ApplicationScore {
  const raw = app.rawData ?? {};
  const input: ScoreInput = {
    name: [app.firstName, app.lastName].filter(Boolean).join(" ").trim(),
    age: ageFromDate(app.dateOfBirth),
    idNumber: app.idNumber ?? "",
    phone: app.phone ?? "",
    businessType: app.businessType ?? "",
    businessName: app.businessName ?? "",
    province: app.province ?? "",
    monthlySales: rawStr(raw, "monthlySales"),
    requestedAmount: app.requestedAmount,
    requestedTermWeeks: app.requestedTermWeeks,
    businessAge: rawStr(raw, "businessAge"),
    formalization: rawStr(raw, "formalization"),
    locationType: rawStr(raw, "locationType"),
    employeeCount: rawStr(raw, "employeeCount"),
    housingType: rawStr(raw, "housingType"),
    residenceTime: rawStr(raw, "residenceTime"),
    homeAddress: app.homeAddress,
    addressReference: rawStr(raw, "addressReference"),
    referenceName: rawStr(raw, "referenceName"),
    referencePhone: rawStr(raw, "referencePhone"),
    spouseName: rawStr(raw, "spouseName"),
    spousePhone: rawStr(raw, "spousePhone"),
    businessPhone: rawStr(raw, "businessPhone"),
    purpose: app.purpose,
    maritalStatus: app.maritalStatus,
    partial: app.partial
  };
  return scoreInput(input);
}
