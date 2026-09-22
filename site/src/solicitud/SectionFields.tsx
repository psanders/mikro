/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The solicitud's inputs, and the fields of each section laid out exactly as
 * the original accordion had them. Both form layouts render a section through
 * `SectionFields`, so the questions and their grouping cannot drift apart.
 */
import type { ChangeEvent } from "react";
import {
  ESTADO_CIVIL_OPTIONS,
  FORMALIZACION_OPTIONS,
  NUM_EMPLEADOS_OPTIONS,
  PLAZO_OPTIONS,
  PROPOSITO_OPTIONS,
  PROVINCIA_OPTIONS,
  TIEMPO_OPERANDO_OPTIONS,
  TIEMPO_RESIDIENDO_OPTIONS,
  TIPO_LOCAL_OPTIONS,
  TIPO_NEGOCIO_OPTIONS,
  TIPO_VIVIENDA_OPTIONS,
  VENTAS_MENSUALES_OPTIONS,
  formatCedula,
  formatCurrency,
  formatPhone,
  type SelectOption
} from "./formConfig";

const inputBase =
  "w-full rounded-xl border-[1.5px] bg-white px-4 py-3.5 text-[15px] font-medium text-brand-ink placeholder:text-[#7888A8] focus:border-brand-blue-sky focus:outline-none";

const selectBase =
  'w-full appearance-none rounded-xl border-[1.5px] bg-white px-4 py-3.5 text-[15px] font-medium text-brand-ink focus:border-brand-blue-sky focus:outline-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%237888A8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_16px_center] bg-no-repeat pr-10';

const placeholderSelect = "text-[#7888A8]";

function borderFor(invalid?: boolean) {
  return invalid ? "border-[#D64545]" : "border-[#E6EEFB]";
}

type OnChange = (name: string, value: string) => void;

interface BaseFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: OnChange;
  required?: boolean;
  /** Flagged by the stepper when the applicant tried to advance with it empty. */
  invalid?: boolean;
}

function FieldShell({
  label,
  invalid,
  children
}: {
  label: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-brand-ink">{label}</label>
      {children}
      {invalid && (
        <span className="text-[13px] font-medium text-[#D64545]">Completa este campo.</span>
      )}
    </div>
  );
}

function TextField({
  label,
  name,
  placeholder,
  value,
  onChange,
  required,
  invalid
}: BaseFieldProps & { placeholder: string }) {
  return (
    <FieldShell label={label} invalid={invalid}>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        aria-invalid={invalid || undefined}
        className={`${inputBase} ${borderFor(invalid)}`}
      />
    </FieldShell>
  );
}

function CedulaField({ label, name, value, onChange, required, invalid }: BaseFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(name, formatCedula(e.target.value));
  };
  return (
    <FieldShell label={label} invalid={invalid}>
      <input
        type="text"
        inputMode="numeric"
        name={name}
        placeholder="000-0000000-0"
        value={value}
        onChange={handleChange}
        required={required}
        maxLength={13}
        aria-invalid={invalid || undefined}
        className={`${inputBase} ${borderFor(invalid)}`}
      />
    </FieldShell>
  );
}

function DateField({ label, name, value, onChange, required, invalid }: BaseFieldProps) {
  return (
    <FieldShell label={label} invalid={invalid}>
      <input
        type="date"
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        max={new Date().toISOString().split("T")[0]}
        aria-invalid={invalid || undefined}
        className={`${inputBase} ${borderFor(invalid)}`}
      />
    </FieldShell>
  );
}

function SelectField({
  label,
  name,
  placeholder,
  options,
  value,
  onChange,
  required,
  invalid
}: BaseFieldProps & { placeholder: string; options: SelectOption[] }) {
  return (
    <FieldShell label={label} invalid={invalid}>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        aria-invalid={invalid || undefined}
        className={`${selectBase} ${borderFor(invalid)} ${!value ? placeholderSelect : ""}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => {
          const optValue = typeof opt === "string" ? opt : opt.value;
          const optLabel = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          );
        })}
      </select>
    </FieldShell>
  );
}

function PhoneField({ label, name, value, onChange, required, invalid }: BaseFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(name, formatPhone(e.target.value));
  };
  return (
    <FieldShell label={label} invalid={invalid}>
      <input
        type="tel"
        inputMode="numeric"
        name={name}
        placeholder="(809) 000-0000"
        value={value}
        onChange={handleChange}
        required={required}
        maxLength={14}
        aria-invalid={invalid || undefined}
        className={`${inputBase} ${borderFor(invalid)}`}
      />
    </FieldShell>
  );
}

function CurrencyField({
  label,
  name,
  placeholder,
  value,
  onChange,
  required,
  invalid
}: BaseFieldProps & { placeholder: string }) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(name, formatCurrency(e.target.value));
  };
  return (
    <FieldShell label={label} invalid={invalid}>
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
          aria-invalid={invalid || undefined}
          className={`${inputBase} ${borderFor(invalid)} pl-14`}
        />
      </div>
    </FieldShell>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>;
}

interface SectionFieldsProps {
  sectionId: string;
  form: Record<string, string>;
  onChange: OnChange;
  /** Field keys to flag as missing (stepper only; the accordion never sets it). */
  invalidFields?: ReadonlySet<string>;
}

/** The inputs of one section, grouped exactly as the original form had them. */
export function SectionFields({ sectionId, form, onChange, invalidFields }: SectionFieldsProps) {
  // Shared props for one field key: value, change handler, invalid flag.
  const f = (name: string) => ({
    name,
    value: form[name] ?? "",
    onChange,
    invalid: invalidFields?.has(name)
  });

  switch (sectionId) {
    case "personal":
      return (
        <>
          <Row>
            <TextField
              label="Nombre(s)"
              placeholder="Ej. Juan Carlos"
              {...f("firstName")}
              required
            />
            <TextField label="Apellido(s)" placeholder="Ej. Pérez" {...f("lastName")} required />
          </Row>
          <Row>
            <PhoneField label="Teléfono personal" {...f("phone")} required />
            <CedulaField label="Cédula" {...f("idNumber")} required />
          </Row>
          <Row>
            <DateField label="Fecha de nacimiento" {...f("dateOfBirth")} required />
            <SelectField
              label="Estado civil"
              placeholder="Seleccionar"
              options={ESTADO_CIVIL_OPTIONS}
              {...f("maritalStatus")}
              required
            />
          </Row>
        </>
      );
    case "negocio":
      return (
        <>
          <Row>
            <SelectField
              label="Tipo de negocio"
              placeholder="Seleccionar"
              options={TIPO_NEGOCIO_OPTIONS}
              {...f("businessType")}
              required
            />
            <TextField
              label="Nombre del negocio"
              placeholder="Ej. Colmado La Esperanza"
              {...f("businessName")}
              required
            />
          </Row>
          <Row>
            <SelectField
              label="Tiempo operando"
              placeholder="Seleccionar"
              options={TIEMPO_OPERANDO_OPTIONS}
              {...f("businessAge")}
              required
            />
            <SelectField
              label="Ventas mensuales aprox."
              placeholder="Seleccionar"
              options={VENTAS_MENSUALES_OPTIONS}
              {...f("monthlySales")}
              required
            />
          </Row>
          <Row>
            <SelectField
              label="Local del negocio"
              placeholder="Seleccionar"
              options={TIPO_LOCAL_OPTIONS}
              {...f("locationType")}
              required
            />
            <SelectField
              label="Formalización"
              placeholder="Seleccionar"
              options={FORMALIZACION_OPTIONS}
              {...f("formalization")}
              required
            />
          </Row>
          <Row>
            <SelectField
              label="Número de empleados"
              placeholder="Seleccionar"
              options={NUM_EMPLEADOS_OPTIONS}
              {...f("employeeCount")}
              required
            />
            <PhoneField label="Teléfono del negocio" {...f("businessPhone")} required />
          </Row>
        </>
      );
    case "credito":
      return (
        <>
          <Row>
            <CurrencyField
              label="Monto solicitado"
              placeholder="0"
              {...f("requestedAmount")}
              required
            />
            <SelectField
              label="Propósito del préstamo"
              placeholder="Seleccionar"
              options={PROPOSITO_OPTIONS}
              {...f("purpose")}
              required
            />
          </Row>
          <Row>
            <SelectField
              label="Plazo"
              placeholder="Seleccionar"
              options={PLAZO_OPTIONS}
              {...f("requestedTermWeeks")}
              required
            />
          </Row>
        </>
      );
    case "familiar":
      return (
        <>
          <Row>
            <TextField
              label="Nombre del cónyuge (opcional)"
              placeholder="Ej. María González"
              {...f("spouseName")}
            />
            <PhoneField label="Teléfono del cónyuge" {...f("spousePhone")} />
          </Row>
          <Row>
            <TextField
              label="Nombre de referencia personal"
              placeholder="Ej. Pedro Ramírez"
              {...f("referenceName")}
              required
            />
            <PhoneField label="Teléfono de referencia personal" {...f("referencePhone")} required />
          </Row>
        </>
      );
    case "vivienda":
      return (
        <>
          <Row>
            <SelectField
              label="Tipo de vivienda"
              placeholder="Seleccionar"
              options={TIPO_VIVIENDA_OPTIONS}
              {...f("housingType")}
              required
            />
            <SelectField
              label="Tiempo residiendo"
              placeholder="Seleccionar"
              options={TIEMPO_RESIDIENDO_OPTIONS}
              {...f("residenceTime")}
              required
            />
          </Row>
          <Row>
            <TextField
              label="Dirección (calle, número y sector)"
              placeholder="Ej. Calle 1 #25, Los Prados"
              {...f("homeAddress")}
              required
            />
            <SelectField
              label="Provincia"
              placeholder="Seleccionar"
              options={PROVINCIA_OPTIONS}
              {...f("province")}
              required
            />
          </Row>
          <Row>
            <TextField
              label="Referencia de dirección"
              placeholder="Ej. Frente al parque"
              {...f("addressReference")}
            />
          </Row>
        </>
      );
    default:
      return null;
  }
}
