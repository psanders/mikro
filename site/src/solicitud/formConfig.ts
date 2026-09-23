/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Static definition of the solicitud form, shared by the stepper (/solicitud)
 * and the legacy accordion (/solicitud-v0): sections, option lists, the
 * initial state, and the formatters the text inputs apply as the applicant types.
 * Which fields are REQUIRED lives in @mikro/application-form
 * (APPLICATION_SECTIONS) so the apiserver's completeness report reads the same.
 */
import { User, Store, HandCoins, Users, Home } from "lucide-react";
import type { FC } from "react";
import { PROVINCES, type SelectOption } from "@mikro/application-form";

export type { SelectOption } from "@mikro/application-form";

export function formatCedula(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Option lists live in the shared application-form module so the founder app's
// edit panel offers exactly the same choices as this form.
export {
  ESTADO_CIVIL_OPTIONS,
  TIPO_NEGOCIO_OPTIONS,
  TIEMPO_OPERANDO_OPTIONS,
  VENTAS_MENSUALES_OPTIONS,
  TIPO_LOCAL_OPTIONS,
  FORMALIZACION_OPTIONS,
  NUM_EMPLEADOS_OPTIONS,
  MONTO_OPTIONS,
  PLAZO_OPTIONS,
  TIPO_VIVIENDA_OPTIONS,
  TIEMPO_RESIDIENDO_OPTIONS,
  PROPOSITO_OPTIONS
} from "@mikro/application-form";

// Provinces — enum value + display label, from the shared list that also backs
// the apiserver's `applications.coveredProvinces` config enum.
export const PROVINCIA_OPTIONS: SelectOption[] = PROVINCES.map((p) => ({
  value: p.value,
  label: p.label
}));

// English field keys — these match the apiserver's stable columns 1:1 (the
// promoted ones) plus the rawData-only fields. User-visible labels/options stay
// in Spanish; only these state keys are English.
export const INITIAL_FORM: Record<string, string> = {
  firstName: "",
  lastName: "",
  phone: "",
  idNumber: "",
  dateOfBirth: "",
  maritalStatus: "",
  businessType: "",
  businessName: "",
  businessAge: "",
  monthlySales: "",
  locationType: "",
  formalization: "",
  employeeCount: "",
  businessPhone: "",
  // Preselected defaults (RD$10,000 over 10 weeks); the applicant can still
  // change them. Note they ride every autosave, so drafts count these 2
  // required fields as filled in the form-completeness report even before the
  // applicant reaches them.
  requestedAmount: "10,000",
  purpose: "",
  requestedTermWeeks: "10 semanas",
  spouseName: "",
  spousePhone: "",
  referenceName: "",
  referencePhone: "",
  housingType: "",
  residenceTime: "",
  homeAddress: "",
  // Deliberately NOT preselected: defaulting to our only covered province would
  // let out-of-area applicants slip through by leaving it untouched.
  province: "",
  addressReference: ""
};

export interface SectionDef {
  id: string;
  num: string;
  title: string;
  subtitle: string;
  icon: FC<{ className?: string; strokeWidth?: number }>;
}

// Order matches APPLICATION_SECTIONS in @mikro/application-form.
export const SECTION_DEFS: SectionDef[] = [
  {
    id: "personal",
    num: "01",
    title: "Datos personales",
    subtitle: "Información básica para identificarte.",
    icon: User
  },
  {
    id: "negocio",
    num: "02",
    title: "Información del negocio",
    subtitle: "Cuéntanos sobre tu negocio.",
    icon: Store
  },
  {
    id: "credito",
    num: "03",
    title: "Crédito solicitado",
    subtitle: "Cuánto necesitas y para qué.",
    icon: HandCoins
  },
  {
    id: "familiar",
    num: "04",
    title: "Información familiar",
    subtitle: "Personas cercanas que podemos contactar.",
    icon: Users
  },
  {
    id: "vivienda",
    num: "05",
    title: "Vivienda",
    subtitle: "Dónde vives y desde cuándo.",
    icon: Home
  }
];
