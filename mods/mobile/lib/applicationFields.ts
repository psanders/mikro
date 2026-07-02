/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Mobile port of the editable field config used by the desktop edit modal
 * (`mods/dashboard/src/lib/applicationFields.ts`). Each "tap-a-section-to-edit"
 * screen (Solicitante, Negocio, Crédito, Referencias, Vivienda) renders its
 * field array here. Option values/labels are copied verbatim from the desktop
 * file so patches sent to `updateApplication` keep matching the deterministic
 * scoring engine's inputs.
 */
export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "date" | "select";
  options?: FieldOption[];
  /** Masked/validated input (Dominican cédula or phone). */
  format?: "phone" | "cedula";
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

const ESTADO_CIVIL = opt(["Soltero(a)", "Casado(a)", "Unión libre", "Divorciado(a)", "Viudo(a)"]);
const PLAZO = opt(["10 semanas", "12 semanas", "15 semanas", "18 semanas"]);
const PROPOSITO = opt([
  "Capital de trabajo",
  "Compra de inventario / mercancía",
  "Compra de equipos / maquinaria",
  "Remodelación / ampliación del local",
  "Compra o reparación de vehículo de trabajo",
  "Pago a proveedores",
  "Expansión / nueva sucursal",
  "Consolidación de deudas del negocio",
  "Otro"
]);
const TIPO_VIVIENDA = opt(["Propia", "Alquilada", "Familiar", "Otra"]);
const TIEMPO_RESIDIENDO = opt([
  "Menos de 1 año",
  "1 a 3 años",
  "3 a 5 años",
  "5 a 10 años",
  "Más de 10 años"
]);

const PROVINCIA: FieldOption[] = (
  [
    ["AZUA", "Azua"],
    ["BAHORUCO", "Bahoruco"],
    ["BARAHONA", "Barahona"],
    ["DAJABON", "Dajabón"],
    ["DISTRITO_NACIONAL", "Distrito Nacional"],
    ["DUARTE", "Duarte"],
    ["ELIAS_PINA", "Elías Piña"],
    ["EL_SEIBO", "El Seibo"],
    ["ESPAILLAT", "Espaillat"],
    ["HATO_MAYOR", "Hato Mayor"],
    ["HERMANAS_MIRABAL", "Hermanas Mirabal"],
    ["INDEPENDENCIA", "Independencia"],
    ["LA_ALTAGRACIA", "La Altagracia"],
    ["LA_ROMANA", "La Romana"],
    ["LA_VEGA", "La Vega"],
    ["MARIA_TRINIDAD_SANCHEZ", "María Trinidad Sánchez"],
    ["MONSENOR_NOUEL", "Monseñor Nouel"],
    ["MONTE_CRISTI", "Monte Cristi"],
    ["MONTE_PLATA", "Monte Plata"],
    ["PEDERNALES", "Pedernales"],
    ["PERAVIA", "Peravia"],
    ["PUERTO_PLATA", "Puerto Plata"],
    ["SAMANA", "Samaná"],
    ["SAN_CRISTOBAL", "San Cristóbal"],
    ["SAN_JOSE_DE_OCOA", "San José de Ocoa"],
    ["SAN_JUAN", "San Juan"],
    ["SAN_PEDRO_DE_MACORIS", "San Pedro de Macorís"],
    ["SANCHEZ_RAMIREZ", "Sánchez Ramírez"],
    ["SANTIAGO", "Santiago"],
    ["SANTIAGO_RODRIGUEZ", "Santiago Rodríguez"],
    ["SANTO_DOMINGO", "Santo Domingo"],
    ["VALVERDE", "Valverde"]
  ] as const
).map(([value, label]) => ({ value, label }));

/** Fields for the "Editar · Solicitante" screen (Pencil `Il9kN`). */
export const SOLICITANTE_FIELDS: FieldDef[] = [
  { key: "firstName", label: "Nombre(s)", type: "text" },
  { key: "lastName", label: "Apellido(s)", type: "text" },
  { key: "phone", label: "Teléfono", type: "text", format: "phone" },
  { key: "idNumber", label: "Cédula", type: "text", format: "cedula" },
  { key: "dateOfBirth", label: "Fecha de nacimiento", type: "date" },
  { key: "maritalStatus", label: "Estado civil", type: "select", options: ESTADO_CIVIL }
];

/** Fields for the "Editar · Crédito" screen (Pencil `B1vT4`). */
export const CREDITO_FIELDS: FieldDef[] = [
  { key: "requestedAmount", label: "Monto solicitado", type: "text" },
  { key: "purpose", label: "Propósito", type: "select", options: PROPOSITO },
  { key: "requestedTermWeeks", label: "Plazo", type: "select", options: PLAZO }
];

/** Fields for the "Editar · Referencias" screen (Pencil `FC6R3`). */
export const REFERENCIAS_FIELDS: FieldDef[] = [
  { key: "spouseName", label: "Nombre del cónyuge", type: "text" },
  { key: "spousePhone", label: "Teléfono del cónyuge", type: "text", format: "phone" },
  { key: "referenceName", label: "Nombre de referencia", type: "text" },
  { key: "referencePhone", label: "Teléfono de referencia", type: "text", format: "phone" }
];

/** Fields for the "Editar · Vivienda" screen (Pencil `udAwm`). */
export const VIVIENDA_FIELDS: FieldDef[] = [
  { key: "housingType", label: "Tipo de vivienda", type: "select", options: TIPO_VIVIENDA },
  { key: "residenceTime", label: "Tiempo residiendo", type: "select", options: TIEMPO_RESIDIENDO },
  { key: "homeAddress", label: "Dirección", type: "text" },
  { key: "province", label: "Provincia", type: "select", options: PROVINCIA },
  { key: "addressReference", label: "Referencia de dirección", type: "text" }
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
