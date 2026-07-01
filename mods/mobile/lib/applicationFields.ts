/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Mobile port of the "Negocio" section of the editable field config used by
 * the desktop edit modal (`mods/dashboard/src/lib/applicationFields.ts`).
 * Only the Negocio section is ported: "tap-a-section-to-edit" (task 5.1) is
 * scoped to the Negocio section per the locked Pencil node `o1Cx54`. Option
 * values/labels are copied verbatim from the desktop file so patches sent to
 * `updateApplication` keep matching the deterministic scoring engine's inputs.
 */
export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "select";
  options?: FieldOption[];
  /** Masked/validated input (not used by the Negocio section beyond a plain phone field). */
  format?: "phone";
}

const opt = (xs: string[]): FieldOption[] => xs.map((x) => ({ value: x, label: x }));

const TIEMPO_OPERANDO = opt([
  "Menos de 6 meses",
  "6 meses a 1 año",
  "1 a 3 años",
  "3 a 5 años",
  "Más de 5 años"
]);
const VENTAS_MENSUALES = opt([
  "Menos de RD$25,000",
  "RD$25,000 – RD$50,000",
  "RD$50,000 – RD$100,000",
  "RD$100,000 – RD$250,000",
  "RD$250,000 – RD$500,000",
  "Más de RD$500,000"
]);
const TIPO_LOCAL = opt(["Propio", "Alquilado", "En mi vivienda"]);
const FORMALIZACION = opt(["Tiene RNC (formalizado)", "Informal (sin RNC)"]);
const NUM_EMPLEADOS = opt(["Solo yo", "1 a 3", "4 a 10", "Más de 10"]);

export const TIPO_NEGOCIO: FieldOption[] = [
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

/** Fields for the "Editar · Negocio" screen, in display order (Pencil `o1Cx54`). */
export const NEGOCIO_FIELDS: FieldDef[] = [
  { key: "businessType", label: "Tipo de negocio", type: "select", options: TIPO_NEGOCIO },
  { key: "businessName", label: "Nombre del negocio", type: "text" },
  { key: "businessAge", label: "Tiempo operando", type: "select", options: TIEMPO_OPERANDO },
  { key: "monthlySales", label: "Ventas mensuales", type: "select", options: VENTAS_MENSUALES },
  { key: "locationType", label: "Local", type: "select", options: TIPO_LOCAL },
  { key: "formalization", label: "Formalización", type: "select", options: FORMALIZACION },
  { key: "employeeCount", label: "Nº de empleados", type: "select", options: NUM_EMPLEADOS },
  { key: "businessPhone", label: "Teléfono del negocio", type: "text", format: "phone" }
];
