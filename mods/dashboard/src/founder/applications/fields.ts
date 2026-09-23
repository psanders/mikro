/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The application's fields as the founder app shows and edits them, grouped
 * like the website form. Keys are the form's English keys (what
 * `updateApplication` patches); option lists come from the shared
 * application-form module so the choices match the website exactly.
 */
import {
  ESTADO_CIVIL_OPTIONS,
  FORMALIZACION_OPTIONS,
  MONTO_OPTIONS,
  NUM_EMPLEADOS_OPTIONS,
  PLAZO_OPTIONS,
  PROPOSITO_OPTIONS,
  PROVINCES,
  TIEMPO_OPERANDO_OPTIONS,
  TIEMPO_RESIDIENDO_OPTIONS,
  TIPO_LOCAL_OPTIONS,
  TIPO_NEGOCIO_OPTIONS,
  TIPO_VIVIENDA_OPTIONS,
  VENTAS_MENSUALES_OPTIONS,
  type SelectOption
} from "@mikro/common/schemas";

export interface FieldDef {
  key: string;
  label: string;
  options?: readonly SelectOption[];
  placeholder?: string;
}

export interface SectionDef {
  id: string;
  title: string;
  fields: FieldDef[];
}

const PROVINCE_OPTIONS: SelectOption[] = PROVINCES.map((p) => ({ value: p.value, label: p.label }));

export const APPLICATION_FIELD_SECTIONS: SectionDef[] = [
  {
    id: "personal",
    title: "Solicitante",
    fields: [
      { key: "firstName", label: "Nombre" },
      { key: "lastName", label: "Apellido(s)" },
      { key: "idNumber", label: "Cédula", placeholder: "000-0000000-0" },
      { key: "dateOfBirth", label: "Fecha de nacimiento", placeholder: "DD/MM/AAAA" },
      { key: "maritalStatus", label: "Estado civil", options: ESTADO_CIVIL_OPTIONS },
      { key: "phone", label: "Teléfono" }
    ]
  },
  {
    id: "negocio",
    title: "Negocio",
    fields: [
      { key: "businessName", label: "Nombre del negocio" },
      { key: "businessType", label: "Tipo de negocio", options: TIPO_NEGOCIO_OPTIONS },
      { key: "province", label: "Provincia", options: PROVINCE_OPTIONS },
      { key: "businessAge", label: "Tiempo operando", options: TIEMPO_OPERANDO_OPTIONS },
      { key: "formalization", label: "Formalización", options: FORMALIZACION_OPTIONS },
      { key: "locationType", label: "Local", options: TIPO_LOCAL_OPTIONS },
      { key: "employeeCount", label: "Empleados", options: NUM_EMPLEADOS_OPTIONS },
      { key: "monthlySales", label: "Ventas mensuales", options: VENTAS_MENSUALES_OPTIONS },
      { key: "businessPhone", label: "Teléfono del negocio" }
    ]
  },
  {
    id: "credito",
    title: "Crédito",
    fields: [
      { key: "requestedAmount", label: "Monto pedido", options: MONTO_OPTIONS },
      { key: "requestedTermWeeks", label: "Plazo pedido", options: PLAZO_OPTIONS },
      { key: "purpose", label: "Propósito", options: PROPOSITO_OPTIONS }
    ]
  },
  {
    id: "familiar",
    title: "Familiar",
    fields: [
      { key: "spouseName", label: "Cónyuge" },
      { key: "spousePhone", label: "Teléfono del cónyuge" }
    ]
  },
  {
    id: "vivienda",
    title: "Vivienda",
    fields: [
      { key: "homeAddress", label: "Dirección" },
      { key: "addressReference", label: "Referencia" },
      { key: "housingType", label: "Tipo de vivienda", options: TIPO_VIVIENDA_OPTIONS },
      { key: "residenceTime", label: "Tiempo ahí", options: TIEMPO_RESIDIENDO_OPTIONS }
    ]
  },
  {
    id: "referencias",
    title: "Referencias",
    fields: [
      { key: "referenceName", label: "Nombre" },
      { key: "referencePhone", label: "Teléfono" }
    ]
  }
];

export function optionValue(o: SelectOption): string {
  return typeof o === "string" ? o : o.value;
}

export function optionLabel(o: SelectOption): string {
  return typeof o === "string" ? o : o.label;
}

/** The value as entered (display string), from rawData first, then the stable column. */
export function fieldValue(app: Record<string, unknown>, key: string): string {
  const raw = (app.rawData ?? {}) as Record<string, unknown>;
  const v = raw[key] ?? app[key];
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

/** Human value for read-only display (labels for enum values). */
export function fieldDisplay(app: Record<string, unknown>, field: FieldDef): string {
  const v = fieldValue(app, field.key);
  if (!v) return "";
  const match = field.options?.find((o) => optionValue(o) === v);
  return match ? optionLabel(match) : v;
}

/** Filled/total per section, for the accordion's counters. */
export function sectionProgress(app: Record<string, unknown>, section: SectionDef) {
  const filled = section.fields.filter((f) => fieldValue(app, f.key).trim() !== "").length;
  return { filled, total: section.fields.length };
}
