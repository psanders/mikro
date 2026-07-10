/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The interactive contract form card — Pencil `cp/contract-form-card`: a blue
 * file-text header over a body that collects a customer (search-as-you-type), the
 * debtor's gender, and the loan terms, then generates and downloads the PDF via
 * `onGenerate`. Unlike the pending-action confirm card, every field is editable.
 * Presentational: the container owns the customer search and the mutation.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Search,
  UserRound
} from "lucide-react";
import { cn } from "../../lib/cn";
import type {
  ContractCustomer,
  ContractFormStatus,
  ContractFormValues,
  ContractFrequency
} from "./types";

const FREQUENCIES: Array<{ value: ContractFrequency; label: string }> = [
  { value: "DAILY", label: "Diaria" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" }
];

/** Parse a money/count input tolerating thousands separators and spaces. */
const parseNumeric = (value: string): number => Number(value.replace(/[\s,]/g, ""));

const LABEL = "text-[12px] font-semibold text-[#14254A]";
const INPUT =
  "w-full rounded-[8px] border border-[#E5EAF1] bg-[#F4F7FB] px-[14px] py-[10px] text-[14px] font-medium text-[#14254A] outline-none placeholder:text-[#697A93] focus:border-[#1F4AA8]";

export interface ContractFormCardProps {
  /** Customer search results for the picker (from the container's listCustomers). */
  customers: ContractCustomer[];
  /** Called as the founder types in the picker. */
  onSearch: (query: string) => void;
  /** Called with validated values when the founder hits generate. */
  onGenerate: (values: ContractFormValues) => void;
  status?: ContractFormStatus;
  /** Error copy shown inline when status is "error". */
  error?: string;
  /** Optional pre-seed for the picker search box. */
  customerHint?: string;
  className?: string;
}

export function ContractFormCard({
  customers,
  onSearch,
  onGenerate,
  status = "idle",
  error,
  customerHint,
  className
}: ContractFormCardProps) {
  const [query, setQuery] = useState(customerHint ?? "");
  const [selected, setSelected] = useState<ContractCustomer | null>(null);
  const [gender, setGender] = useState<"M" | "F" | null>(null);
  const [principal, setPrincipal] = useState("");
  const [installments, setInstallments] = useState("");
  const [frequency, setFrequency] = useState<ContractFrequency>("WEEKLY");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [maritalStatus, setMaritalStatus] = useState("");
  const [occupation, setOccupation] = useState("");

  const generating = status === "generating";
  const done = status === "done";

  // Pre-seed the picker search when the copilot passed a customer hint, so the
  // dropdown shows matches without the founder having to retype.
  useEffect(() => {
    // Run once per hint; onSearch is stable from the container.
    if (customerHint && customerHint.trim().length >= 2) onSearch(customerHint.trim());
  }, [customerHint, onSearch]);

  const valid = useMemo(
    () =>
      !!selected &&
      !!gender &&
      parseNumeric(principal) > 0 &&
      Number.isInteger(parseNumeric(installments)) &&
      parseNumeric(installments) > 0 &&
      parseNumeric(installmentAmount) > 0 &&
      startDate.length > 0,
    [selected, gender, principal, installments, installmentAmount, startDate]
  );

  const handleSearch = (value: string) => {
    setQuery(value);
    setSelected(null);
    onSearch(value);
  };

  const submit = () => {
    if (!valid || !selected || !gender || generating) return;
    onGenerate({
      customerId: selected.id,
      gender,
      principal: parseNumeric(principal),
      installments: parseNumeric(installments),
      frequency,
      installmentAmount: parseNumeric(installmentAmount),
      startDate,
      maritalStatus: maritalStatus.trim() || undefined,
      occupation: occupation.trim() || undefined
    });
  };

  const showResults = query.trim().length >= 2 && !selected && customers.length > 0;

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[12px] border border-[#E5EAF1] bg-white",
        className
      )}
    >
      <div className="flex items-center gap-[10px] border-b border-[#E5EAF1] bg-[#EEF3F9] px-[14px] py-[11px]">
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] bg-[#1F4AA8]">
          <FileText size={14} strokeWidth={2} className="text-white" />
        </span>
        <div className="flex min-w-0 flex-col gap-[1px]">
          <span className="text-[14px] font-semibold text-[#14254A]">Nuevo contrato</span>
          <span className="text-[11px] font-medium text-[#697A93]">
            Cliente existente · términos nuevos
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-[12px] px-[14px] py-[12px]">
        {/* Customer picker */}
        <div className="flex flex-col gap-[7px]">
          <span className={LABEL}>Cliente</span>
          {selected ? (
            <div className="flex items-center gap-[10px] rounded-[8px] border border-[#E5EAF1] bg-[#F4F7FB] px-[14px] py-[10px]">
              <UserRound size={16} strokeWidth={2} className="shrink-0 text-[#697A93]" />
              <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
                <span className="truncate text-[14px] font-medium text-[#14254A]">
                  {selected.name}
                </span>
                <span className="text-[11px] font-medium text-[#697A93]">
                  Cédula {selected.idNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSearch("")}
                className="text-[12px] font-medium text-[#1F4AA8]"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="flex items-center gap-[10px] rounded-[8px] border border-[#E5EAF1] bg-[#F4F7FB] px-[14px] py-[10px]">
                <Search size={16} strokeWidth={2} className="shrink-0 text-[#697A93]" />
                <input
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Buscar por nombre o teléfono…"
                  className="w-full bg-transparent text-[14px] font-medium text-[#14254A] outline-none placeholder:text-[#697A93]"
                />
              </div>
              {showResults && (
                <div className="absolute z-10 mt-[4px] flex w-full flex-col overflow-hidden rounded-[8px] border border-[#E5EAF1] bg-white shadow-lg">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelected(c)}
                      className="flex flex-col gap-[1px] px-[14px] py-[9px] text-left hover:bg-[#F4F7FB]"
                    >
                      <span className="text-[13px] font-medium text-[#14254A]">{c.name}</span>
                      <span className="text-[11px] font-medium text-[#697A93]">
                        Cédula {c.idNumber} · {c.phone}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {selected?.homeAddress && (
            <div className="flex items-center gap-[6px]">
              <MapPin size={11} strokeWidth={2} className="shrink-0 text-[#697A93]" />
              <span className="text-[11px] font-medium text-[#697A93]">
                Reside en: {selected.homeAddress}
              </span>
            </div>
          )}
        </div>

        {/* Gender */}
        <div className="flex flex-col gap-[7px]">
          <span className={LABEL}>Género</span>
          <div className="flex gap-[8px]">
            {(
              [
                ["F", "Femenino"],
                ["M", "Masculino"]
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setGender(value)}
                className={cn(
                  "flex-1 rounded-[8px] py-[9px] text-[13px] font-medium",
                  gender === value
                    ? "bg-[#1F4AA8] text-white"
                    : "border border-[#E5EAF1] bg-white text-[#14254A]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Principal + installments */}
        <div className="flex gap-[10px]">
          <div className="flex flex-1 flex-col gap-[7px]">
            <span className={LABEL}>Principal (RD$)</span>
            <input
              inputMode="decimal"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder="0"
              className={INPUT}
            />
          </div>
          <div className="flex flex-1 flex-col gap-[7px]">
            <span className={LABEL}>Cuotas</span>
            <input
              inputMode="numeric"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              placeholder="0"
              className={INPUT}
            />
          </div>
        </div>

        {/* Frequency + installment amount */}
        <div className="flex gap-[10px]">
          <div className="flex flex-1 flex-col gap-[7px]">
            <span className={LABEL}>Frecuencia</span>
            <div className="relative">
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ContractFrequency)}
                className={cn(INPUT, "appearance-none pr-[34px]")}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                strokeWidth={2}
                className="pointer-events-none absolute right-[12px] top-1/2 -translate-y-1/2 text-[#697A93]"
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-[7px]">
            <span className={LABEL}>Monto cuota (RD$)</span>
            <input
              inputMode="decimal"
              value={installmentAmount}
              onChange={(e) => setInstallmentAmount(e.target.value)}
              placeholder="0"
              className={INPUT}
            />
          </div>
        </div>

        {/* Start date */}
        <div className="flex flex-col gap-[7px]">
          <span className={LABEL}>Fecha de inicio</span>
          <div className="relative">
            <Calendar
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-[#697A93]"
            />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={cn(INPUT, "pl-[40px]")}
            />
          </div>
        </div>

        {/* Optional overrides */}
        {showOptional ? (
          <div className="flex gap-[10px]">
            <div className="flex flex-1 flex-col gap-[7px]">
              <span className={LABEL}>Estado civil</span>
              <input
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                placeholder="p. ej. casada"
                className={INPUT}
              />
            </div>
            <div className="flex flex-1 flex-col gap-[7px]">
              <span className={LABEL}>Ocupación</span>
              <input
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="p. ej. comerciante"
                className={INPUT}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowOptional(true)}
            className="flex items-center gap-[6px] text-[12px] font-medium text-[#697A93]"
          >
            <Plus size={13} strokeWidth={2} />
            Estado civil y ocupación (opcional)
          </button>
        )}

        {status === "error" && error && (
          <p className="text-[12px] font-medium text-[#B42121]">{error}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!valid || generating}
          className={cn(
            "flex w-full items-center justify-center gap-[7px] rounded-[9px] px-[18px] py-[11px] text-[14px] font-medium text-white transition",
            valid && !generating
              ? "bg-[#1F4AA8] hover:bg-[#103A8A]"
              : "cursor-not-allowed bg-[#9DB0D4]"
          )}
        >
          {generating ? (
            <Loader2 size={16} strokeWidth={2} className="animate-spin" />
          ) : done ? (
            <CheckCircle2 size={16} strokeWidth={2} />
          ) : (
            <Download size={16} strokeWidth={2} />
          )}
          {generating ? "Generando…" : done ? "Contrato descargado" : "Generá el contrato"}
        </button>
      </div>
    </div>
  );
}
