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
import { PROVINCES } from "@mikro/application-form";

export type SelectOption = string | { value: string; label: string };

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
  // Preselected defaults (RD$10,000 over 10 weeks, and Puerto Plata, the one
  // province we lend in today); the applicant can still change them. Note they
  // ride every autosave, so drafts count these 3 required fields as filled in
  // the form-completeness report even before the applicant reaches them.
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
  province: "PUERTO_PLATA",
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
