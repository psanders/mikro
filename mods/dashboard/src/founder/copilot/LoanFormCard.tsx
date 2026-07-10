/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The interactive loan form card — Pencil `cp/loan-form-card`: a blue
 * hand-coins header over a body that collects a customer (search-as-you-type),
 * the loan terms, and a "generar contrato con estos términos" checkbox
 * (checked by default), then creates the loan — and, if checked, generates a
 * matching contract with the same terms in the same submit — via `onCreate`.
 * Every field is editable, unlike the pending-action confirm card.
 * Presentational: the container owns the customer search and the mutations.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  HandCoins,
  Loader2,
  MapPin,
  Plus,
  Search,
  UserRound
} from "lucide-react";
import { cn } from "../../lib/cn";
import type {
  ContractFrequency,
  CreateFormStatus,
  CustomerPickerResult,
  LoanFormValues
} from "./types";

const FREQUENCIES: Array<{ value: ContractFrequency; label: string }> = [
  { value: "DAILY", label: "Diaria" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" }
];

const parseNumeric = (value: string): number => Number(value.replace(/[\s,]/g, ""));

const LABEL = "text-[12px] font-semibold text-[#14254A]";
const INPUT =
  "w-full rounded-[8px] border border-[#E5EAF1] bg-[#F4F7FB] px-[14px] py-[10px] text-[14px] font-medium text-[#14254A] outline-none placeholder:text-[#697A93] focus:border-[#1F4AA8]";

export interface LoanFormCardProps {
  /** Customer search results for the picker (from the container's listCustomers). */
  customers: CustomerPickerResult[];
  /** Called as the founder types in the picker. */
  onSearch: (query: string) => void;
  /** Called with validated values when the founder hits create. */
  onCreate: (values: LoanFormValues) => void;
  status?: CreateFormStatus;
  /** Error copy shown inline when status is "error". */
  error?: string;
  /** Optional pre-seed for the picker search box. */
  customerHint?: string;
  className?: string;
}

export function LoanFormCard({
  customers,
  onSearch,
  onCreate,
  status = "idle",
  error,
  customerHint,
  className
}: LoanFormCardProps) {
  const [query, setQuery] = useState(customerHint ?? "");
  const [selected, setSelected] = useState<CustomerPickerResult | null>(null);
  const [principal, setPrincipal] = useState("");
  const [termLength, setTermLength] = useState("");
  const [frequency, setFrequency] = useState<ContractFrequency>("WEEKLY");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [startingDate, setStartingDate] = useState("");
  const [generateContract, setGenerateContract] = useState(true);
  const [showOptional, setShowOptional] = useState(false);
  const [nickname, setNickname] = useState("");
  const [moraRate, setMoraRate] = useState("");

  const creating = status === "creating";
  const done = status === "done";

  // Pre-seed the picker search when the copilot passed a customer hint, so the
  // dropdown shows matches without the founder having to retype.
  useEffect(() => {
    if (customerHint && customerHint.trim().length >= 2) onSearch(customerHint.trim());
  }, [customerHint, onSearch]);

  const valid = useMemo(
    () =>
      !!selected &&
      parseNumeric(principal) > 0 &&
      Number.isInteger(parseNumeric(termLength)) &&
      parseNumeric(termLength) > 0 &&
      parseNumeric(paymentAmount) > 0,
    [selected, principal, termLength, paymentAmount]
  );

  const handleSearch = (value: string) => {
    setQuery(value);
    setSelected(null);
    onSearch(value);
  };

  const submit = () => {
    if (!valid || !selected || creating) return;
    onCreate({
      customerId: selected.id,
      principal: parseNumeric(principal),
      termLength: parseNumeric(termLength),
      paymentAmount: parseNumeric(paymentAmount),
      paymentFrequency: frequency,
      startingDate: startingDate.trim() || undefined,
      nickname: nickname.trim() || undefined,
      moraRate: moraRate.trim() ? parseNumeric(moraRate) : undefined,
      generateContract
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
          <HandCoins size={14} strokeWidth={2} className="text-white" />
        </span>
        <div className="flex min-w-0 flex-col gap-[1px]">
          <span className="text-[14px] font-semibold text-[#14254A]">Nuevo préstamo</span>
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

        {/* Principal + term length */}
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
              value={termLength}
              onChange={(e) => setTermLength(e.target.value)}
              placeholder="0"
              className={INPUT}
            />
          </div>
        </div>

        {/* Frequency + payment amount */}
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
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0"
              className={INPUT}
            />
          </div>
        </div>

        {/* Starting date */}
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
              value={startingDate}
              onChange={(e) => setStartingDate(e.target.value)}
              className={cn(INPUT, "pl-[40px]")}
            />
          </div>
        </div>

        {/* Contract checkbox (checked by default) */}
        <button
          type="button"
          onClick={() => setGenerateContract((v) => !v)}
          className="flex items-center gap-[8px] self-start"
        >
          <span
            className={cn(
              "flex h-[18px] w-[18px] items-center justify-center rounded-[5px]",
              generateContract ? "bg-[#1F4AA8]" : "border border-[#E5EAF1] bg-white"
            )}
          >
            {generateContract && <CheckCircle2 size={13} strokeWidth={2} className="text-white" />}
          </span>
          <span className="text-[13px] font-medium text-[#14254A]">
            Generar contrato con estos términos
          </span>
        </button>

        {/* Optional overrides */}
        {showOptional ? (
          <div className="flex gap-[10px]">
            <div className="flex flex-1 flex-col gap-[7px]">
              <span className={LABEL}>Apodo</span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="p. ej. La colmadera"
                className={INPUT}
              />
            </div>
            <div className="flex flex-1 flex-col gap-[7px]">
              <span className={LABEL}>Tasa de mora</span>
              <input
                inputMode="decimal"
                value={moraRate}
                onChange={(e) => setMoraRate(e.target.value)}
                placeholder="0.02"
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
            Apodo y tasa de mora (opcional)
          </button>
        )}

        {status === "error" && error && (
          <p className="text-[12px] font-medium text-[#B42121]">{error}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!valid || creating}
          className={cn(
            "flex w-full items-center justify-center gap-[7px] rounded-[9px] px-[18px] py-[11px] text-[14px] font-medium text-white transition",
            valid && !creating
              ? "bg-[#1F4AA8] hover:bg-[#103A8A]"
              : "cursor-not-allowed bg-[#9DB0D4]"
          )}
        >
          {creating ? (
            <Loader2 size={16} strokeWidth={2} className="animate-spin" />
          ) : done ? (
            <CheckCircle2 size={16} strokeWidth={2} />
          ) : (
            <HandCoins size={16} strokeWidth={2} />
          )}
          {creating ? "Creando…" : done ? "Préstamo creado" : "Crear préstamo"}
        </button>
      </div>
    </div>
  );
}
