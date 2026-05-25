/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  User,
  Briefcase,
  HandCoins,
  Users,
  Home,
  ChevronUp,
  ChevronDown,
  Check,
  Clock,
  ArrowRight,
  Loader2
} from "lucide-react";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";

const GOOGLE_FORM_URL = import.meta.env.VITE_GOOGLE_FORM_URL as string | undefined;

const inputBase =
  "w-full rounded-xl border-[1.5px] border-[#E6EEFB] bg-white px-4 py-3.5 text-[15px] font-medium text-brand-ink placeholder:text-[#7888A8] focus:border-brand-blue-sky focus:outline-none";

const selectBase =
  'w-full appearance-none rounded-xl border-[1.5px] border-[#E6EEFB] bg-white px-4 py-3.5 text-[15px] font-medium text-brand-ink focus:border-brand-blue-sky focus:outline-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%237888A8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_16px_center] bg-no-repeat pr-10';

const placeholderSelect = "text-[#7888A8]";

function formatCedula(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("es-DO");
}

interface TextFieldProps {
  label: string;
  name: string;
  placeholder: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
}

function TextField({ label, name, placeholder, value, onChange, required }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-brand-ink">{label}</label>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        className={inputBase}
      />
    </div>
  );
}

interface CedulaFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
}

function CedulaField({ label, name, value, onChange, required }: CedulaFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(name, formatCedula(e.target.value));
  };
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-brand-ink">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        name={name}
        placeholder="000-0000000-0"
        value={value}
        onChange={handleChange}
        required={required}
        maxLength={13}
        className={inputBase}
      />
    </div>
  );
}

interface DateFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
}

function DateField({ label, name, value, onChange, required }: DateFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-brand-ink">{label}</label>
      <input
        type="date"
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        max={new Date().toISOString().split("T")[0]}
        className={inputBase}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  name: string;
  placeholder: string;
  options: string[];
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
}

function SelectField({
  label,
  name,
  placeholder,
  options,
  value,
  onChange,
  required
}: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-brand-ink">{label}</label>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        className={`${selectBase} ${!value ? placeholderSelect : ""}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

interface PhoneFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
}

function PhoneField({ label, name, value, onChange, required }: PhoneFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(name, formatPhone(e.target.value));
  };
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-brand-ink">{label}</label>
      <input
        type="tel"
        inputMode="numeric"
        name={name}
        placeholder="(809) 000-0000"
        value={value}
        onChange={handleChange}
        required={required}
        maxLength={14}
        className={inputBase}
      />
    </div>
  );
}

interface CurrencyFieldProps {
  label: string;
  name: string;
  placeholder: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
}

function CurrencyField({
  label,
  name,
  placeholder,
  value,
  onChange,
  required
}: CurrencyFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(name, formatCurrency(e.target.value));
  };
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-brand-ink">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-medium text-[#7888A8]">
          RD$
        </span>
        <input
          type="text"
          inputMode="numeric"
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          required={required}
          className={`${inputBase} pl-14`}
        />
      </div>
    </div>
  );
}

const ESTADO_CIVIL_OPTIONS = [
  "Soltero(a)",
  "Casado(a)",
  "Unión libre",
  "Divorciado(a)",
  "Viudo(a)"
];
const SITUACION_LABORAL_OPTIONS = [
  "Empleado privado",
  "Empleado público",
  "Dueño de negocio",
  "Independiente / Freelance",
  "Jubilado(a)",
  "Otro"
];
const TIEMPO_EMPLEO_OPTIONS = [
  "Menos de 3 meses",
  "3 a 6 meses",
  "6 meses a 1 año",
  "1 a 2 años",
  "2 a 5 años",
  "Más de 5 años"
];
const PLAZO_OPTIONS = ["10 semanas", "12 semanas", "15 semanas", "18 semanas"];
const TIPO_VIVIENDA_OPTIONS = ["Propia", "Alquilada", "Familiar", "Otra"];
const TIEMPO_RESIDIENDO_OPTIONS = [
  "Menos de 1 año",
  "1 a 3 años",
  "3 a 5 años",
  "5 a 10 años",
  "Más de 10 años"
];
const PROPOSITO_OPTIONS = [
  "Capital de trabajo",
  "Compra de mercancía",
  "Mejora de negocio",
  "Remodelación de vivienda",
  "Gastos personales",
  "Educación",
  "Salud",
  "Vehículo",
  "Otro"
];

const INITIAL_FORM: Record<string, string> = {
  nombre: "",
  apellido: "",
  telefono: "",
  cedula: "",
  fechaNacimiento: "",
  estadoCivil: "",
  situacionLaboral: "",
  empresa: "",
  cargo: "",
  ingresoMensual: "",
  tiempoEmpleo: "",
  telefonoTrabajo: "",
  montoSolicitado: "",
  proposito: "",
  plazo: "",
  nombreConyuge: "",
  telefonoConyuge: "",
  nombreReferencia: "",
  telefonoReferencia: "",
  tipoVivienda: "",
  tiempoResidiendo: "",
  direccion: "",
  sectorCiudad: "",
  referenciaDireccion: ""
};

interface SectionDef {
  id: string;
  num: string;
  title: string;
  subtitle: string;
  icon: React.FC<{ className?: string; strokeWidth?: number }>;
}

const SECTION_DEFS: SectionDef[] = [
  {
    id: "personal",
    num: "01",
    title: "Datos personales",
    subtitle: "Información básica para identificarte.",
    icon: User
  },
  {
    id: "laboral",
    num: "02",
    title: "Información laboral",
    subtitle: "Cómo generas tus ingresos hoy.",
    icon: Briefcase
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

export function SolicitudPage() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [openSection, setOpenSection] = useState("personal");
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const set = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggle = (sectionId: string) => {
    if (openSection && GOOGLE_FORM_URL) {
      fetch(GOOGLE_FORM_URL, {
        method: "POST",
        body: JSON.stringify({ ...form, sessionId, partial: true, lastSection: openSection })
      }).catch(() => {});
    }
    setOpenSection(openSection === sectionId ? "" : sectionId);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      setError("Debes autorizar la consulta al buró de crédito para continuar.");
      return;
    }
    setError("");

    if (!GOOGLE_FORM_URL) {
      setError("El formulario no está configurado. Contacta al administrador.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(GOOGLE_FORM_URL, {
        method: "POST",
        body: JSON.stringify({ ...form, sessionId, partial: false })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json().catch(() => null);
      if (data?.result !== "ok") {
        throw new Error(data?.error ?? "Respuesta inesperada del servidor.");
      }

      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "No se pudo conectar al servidor. Verifica tu conexión a internet e intenta de nuevo."
          : `Error al enviar la solicitud: ${msg || "intenta de nuevo."}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-brand-white font-sans text-brand-ink selection:bg-brand-blue-sky/30">
        <Nav />
        <section className="flex flex-col items-center justify-center gap-6 px-6 py-24 md:py-40">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D6F3E5]">
            <Check className="h-8 w-8 text-[#0E7C5F]" strokeWidth={2.5} />
          </div>
          <h1 className="text-center text-3xl font-bold tracking-[-1px] text-brand-blue-deep md:text-[44px]">
            Solicitud enviada
          </h1>
          <p className="max-w-[540px] text-center text-[17px] font-medium leading-[1.45] text-[#3C4F7A]">
            Recibirás una respuesta en menos de 24 horas. Si tienes preguntas, escríbenos por
            WhatsApp.
          </p>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-white font-sans text-brand-ink selection:bg-brand-blue-sky/30">
      <Nav />

      {/* Header */}
      <section className="bg-[linear-gradient(160deg,#103A8A_0%,#3F86E0_100%)] px-6 py-10 md:px-[60px] md:py-16">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-4 md:gap-[18px]">
          <div className="flex items-center gap-2.5 rounded-full border border-[#3F86E055] bg-[#1A4FB2] px-3.5 py-2">
            <span className="text-xs font-medium text-[#D8E8FF] md:text-[13px]">
              Solicitud de crédito · Paso único
            </span>
          </div>
          <h1 className="text-center text-3xl font-bold leading-[1.1] tracking-[-1.2px] text-white md:text-[44px]">
            Cuéntanos sobre ti
          </h1>
          <p className="max-w-[720px] text-center text-[15px] font-medium leading-[1.45] text-[#D8E8FF] md:text-[17px]">
            Estos datos nos permiten evaluar tu solicitud de forma justa y rápida. Toma menos de 5
            minutos y tu información viaja cifrada y protegida.
          </p>
        </div>
      </section>

      {/* Form Body */}
      <section className="bg-brand-mist px-5 py-8 md:px-[60px] md:py-16 md:pb-20">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-[880px] flex-col gap-6">
          {SECTION_DEFS.map((section) => {
            const isOpen = openSection === section.id;
            const Icon = section.icon;

            return (
              <div
                key={section.id}
                className={`rounded-[20px] bg-white ${
                  isOpen
                    ? "border-2 border-brand-blue-sky p-6 md:p-8"
                    : "border-[1.5px] border-[#E6EEFB] px-6 py-[22px] md:px-8"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(section.id)}
                  className="flex w-full items-center gap-4"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-mist">
                    <Icon className="h-[22px] w-[22px] text-brand-blue-primary" strokeWidth={2} />
                  </div>
                  <div className="flex flex-1 flex-col items-start gap-0.5">
                    <span className="text-left text-base font-bold tracking-[-0.3px] text-brand-ink md:text-[19px]">
                      {section.num} &nbsp;·&nbsp; {section.title}
                    </span>
                    <span className="text-left text-[13px] font-medium text-[#5B6B8C] md:text-sm">
                      {section.subtitle}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp
                      className="h-5 w-5 shrink-0 text-brand-blue-primary"
                      strokeWidth={2}
                    />
                  ) : (
                    <ChevronDown
                      className="h-5 w-5 shrink-0 text-brand-blue-primary"
                      strokeWidth={2}
                    />
                  )}
                </button>

                {isOpen && (
                  <div className="mt-6 flex flex-col gap-[18px]">
                    {section.id === "personal" && (
                      <>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <TextField
                            label="Nombre(s)"
                            name="nombre"
                            placeholder="Ej. Juan Carlos"
                            value={form.nombre}
                            onChange={set}
                            required
                          />
                          <TextField
                            label="Apellido(s)"
                            name="apellido"
                            placeholder="Ej. Pérez"
                            value={form.apellido}
                            onChange={set}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <PhoneField
                            label="Teléfono personal"
                            name="telefono"
                            value={form.telefono}
                            onChange={set}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <CedulaField
                            label="Cédula"
                            name="cedula"
                            value={form.cedula}
                            onChange={set}
                            required
                          />
                          <DateField
                            label="Fecha de nacimiento"
                            name="fechaNacimiento"
                            value={form.fechaNacimiento}
                            onChange={set}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <SelectField
                            label="Estado civil"
                            name="estadoCivil"
                            placeholder="Seleccionar"
                            options={ESTADO_CIVIL_OPTIONS}
                            value={form.estadoCivil}
                            onChange={set}
                            required
                          />
                        </div>
                      </>
                    )}

                    {section.id === "laboral" && (
                      <>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <SelectField
                            label="Situación laboral"
                            name="situacionLaboral"
                            placeholder="Seleccionar"
                            options={SITUACION_LABORAL_OPTIONS}
                            value={form.situacionLaboral}
                            onChange={set}
                            required
                          />
                          <TextField
                            label="Nombre de la empresa / Negocio"
                            name="empresa"
                            placeholder="Ej. Claro Dominicana"
                            value={form.empresa}
                            onChange={set}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <TextField
                            label="Cargo / Ocupación"
                            name="cargo"
                            placeholder="Ej. Analista de sistemas"
                            value={form.cargo}
                            onChange={set}
                            required
                          />
                          <CurrencyField
                            label="Ingreso mensual promedio"
                            name="ingresoMensual"
                            placeholder="0"
                            value={form.ingresoMensual}
                            onChange={set}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <SelectField
                            label="Tiempo en el empleo/negocio"
                            name="tiempoEmpleo"
                            placeholder="Seleccionar"
                            options={TIEMPO_EMPLEO_OPTIONS}
                            value={form.tiempoEmpleo}
                            onChange={set}
                            required
                          />
                          <PhoneField
                            label="Teléfono del trabajo"
                            name="telefonoTrabajo"
                            value={form.telefonoTrabajo}
                            onChange={set}
                          />
                        </div>
                      </>
                    )}

                    {section.id === "credito" && (
                      <>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <CurrencyField
                            label="Monto solicitado"
                            name="montoSolicitado"
                            placeholder="0"
                            value={form.montoSolicitado}
                            onChange={set}
                            required
                          />
                          <SelectField
                            label="Propósito del préstamo"
                            name="proposito"
                            placeholder="Seleccionar"
                            options={PROPOSITO_OPTIONS}
                            value={form.proposito}
                            onChange={set}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <SelectField
                            label="Plazo"
                            name="plazo"
                            placeholder="Seleccionar"
                            options={PLAZO_OPTIONS}
                            value={form.plazo}
                            onChange={set}
                            required
                          />
                        </div>
                      </>
                    )}

                    {section.id === "familiar" && (
                      <>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <TextField
                            label="Nombre del cónyuge (opcional)"
                            name="nombreConyuge"
                            placeholder="Ej. María González"
                            value={form.nombreConyuge}
                            onChange={set}
                          />
                          <PhoneField
                            label="Teléfono del cónyuge"
                            name="telefonoConyuge"
                            value={form.telefonoConyuge}
                            onChange={set}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <TextField
                            label="Nombre de referencia personal"
                            name="nombreReferencia"
                            placeholder="Ej. Pedro Ramírez"
                            value={form.nombreReferencia}
                            onChange={set}
                            required
                          />
                          <PhoneField
                            label="Teléfono de referencia personal"
                            name="telefonoReferencia"
                            value={form.telefonoReferencia}
                            onChange={set}
                            required
                          />
                        </div>
                      </>
                    )}

                    {section.id === "vivienda" && (
                      <>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <SelectField
                            label="Tipo de vivienda"
                            name="tipoVivienda"
                            placeholder="Seleccionar"
                            options={TIPO_VIVIENDA_OPTIONS}
                            value={form.tipoVivienda}
                            onChange={set}
                            required
                          />
                          <SelectField
                            label="Tiempo residiendo"
                            name="tiempoResidiendo"
                            placeholder="Seleccionar"
                            options={TIEMPO_RESIDIENDO_OPTIONS}
                            value={form.tiempoResidiendo}
                            onChange={set}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <TextField
                            label="Dirección de residencia"
                            name="direccion"
                            placeholder="Ej. Calle 1, Res. Los Prados"
                            value={form.direccion}
                            onChange={set}
                            required
                          />
                          <TextField
                            label="Sector / Ciudad"
                            name="sectorCiudad"
                            placeholder="Ej. Distrito Nacional"
                            value={form.sectorCiudad}
                            onChange={set}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <TextField
                            label="Referencia de dirección"
                            name="referenciaDireccion"
                            placeholder="Ej. Frente al parque"
                            value={form.referenciaDireccion}
                            onChange={set}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Submit Section */}
          <div className="rounded-[20px] border-[1.5px] border-[#E6EEFB] bg-white p-6 md:p-8">
            <div className="flex flex-col gap-[22px]">
              <label
                className="flex cursor-pointer items-center gap-3"
                onClick={() => setAgreed(!agreed)}
              >
                <span
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md ${
                    agreed ? "bg-brand-blue-primary" : "border-[1.5px] border-[#E6EEFB] bg-white"
                  }`}
                >
                  {agreed && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </span>
                <span className="text-[13px] font-medium leading-[1.5] text-[#5B6B8C]">
                  Autorizo a Mikro Crédito a consultar y reportar mi información en el buró de
                  crédito para evaluar esta solicitud.
                </span>
              </label>

              {error && <p className="text-sm font-medium text-red-600">{error}</p>}

              <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-brand-blue-primary" strokeWidth={2} />
                  <span className="text-sm font-medium text-[#5B6B8C]">
                    Respuesta en menos de 24 horas.
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2.5 rounded-[14px] bg-brand-orange-primary px-7 py-[18px] text-[17px] font-semibold text-white transition-colors duration-200 hover:bg-[#ff9f4a] active:bg-[#e67d10] disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2} />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Enviar solicitud
                      <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </section>

      <Footer />
    </div>
  );
}
