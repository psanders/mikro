/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Loan calculator side panel (Pencil EzobQ sec-10: YtBtg, invalid state
 * V9f4nY). Admins and reviewers simulate terms from the feed; nothing is
 * saved. The options come from the shared `calculateLoanOptions`, the same
 * function behind the server's `calculateLoan`, so they match the copilot and
 * `ctl loans:calculate`.
 */
import { useMemo, useState } from "react";
import { CircleAlert, Calculator } from "lucide-react";
import type { PaymentFrequency } from "@mikro/common/schemas";
import { calculateFromForm, type LoanCalculatorForm } from "@mikro/common/utils/loanCalculatorForm";
import { DEFAULT_PAYMENT_ROUNDING_INCREMENT } from "@mikro/common/utils/loanCalculatorConstants";
import { cn } from "../../lib/cn";
import { SidePanel } from "../components/SidePanel";
import { formatAmount } from "../components/format";
import { INPUT_CLASS, PanelField, PanelSelect, SectionLabel } from "../applications/ui";

const FREQUENCIES: { value: PaymentFrequency; label: string; unit: string }[] = [
  { value: "DAILY", label: "Diario", unit: "días" },
  { value: "WEEKLY", label: "Semanal", unit: "sem." },
  { value: "BIWEEKLY", label: "Quincenal", unit: "quinc." },
  { value: "MONTHLY", label: "Mensual", unit: "meses" }
];

const PERIOD_NAMES: Record<PaymentFrequency, string> = {
  DAILY: "días",
  WEEKLY: "semanas",
  BIWEEKLY: "quincenas",
  MONTHLY: "meses"
};

export const DEFAULT_CALCULATOR_FORM: LoanCalculatorForm = {
  principal: "",
  ratePercent: "30",
  paymentFrequency: "WEEKLY",
  baseDuration: ""
};

function formatRate(rate: number): string {
  return `${Number((rate * 100).toFixed(2))}%`;
}

export interface LoanCalculatorPanelProps {
  onClose: () => void;
  /** Starting values (stories); defaults to 30% weekly with monto/plazo empty. */
  initial?: LoanCalculatorForm;
}

export function LoanCalculatorPanel({ onClose, initial }: LoanCalculatorPanelProps) {
  const [form, setForm] = useState<LoanCalculatorForm>(initial ?? DEFAULT_CALCULATOR_FORM);
  const [touched, setTouched] = useState(Boolean(initial));
  const outcome = useMemo(() => calculateFromForm(form), [form]);
  const unit = FREQUENCIES.find((f) => f.value === form.paymentFrequency)!.unit;

  const set = (key: keyof LoanCalculatorForm) => (value: string) => {
    setTouched(true);
    setForm((prev) => ({ ...prev, [key]: value }) as LoanCalculatorForm);
  };
  // Before the first keystroke the empty monto is a prompt, not an error.
  const error = touched && !outcome.ok ? outcome : null;
  const inputCls = (field: keyof LoanCalculatorForm) =>
    cn(
      INPUT_CLASS,
      "focus:border-[#1F4AA8]",
      error?.field === field && "!border-[#DC2626] !bg-[#FDECEC]"
    );

  const fieldError = (field: keyof LoanCalculatorForm) =>
    error?.field === field && (
      <span
        role="alert"
        data-testid="calc-error"
        className="flex items-center gap-[5px] text-[12px] font-medium text-[#DC2626]"
      >
        <CircleAlert size={13} />
        {error.message}
      </span>
    );

  return (
    <SidePanel
      open
      onClose={onClose}
      title="Calculadora de préstamo"
      subtitle="Simulación · no crea ningún préstamo"
      icon={Calculator}
      iconClassName="bg-[#E9F2FF] text-[#1F4AA8]"
      testId="calculator-panel"
    >
      <div className="flex flex-col gap-[22px]">
        <div className="grid grid-cols-2 items-start gap-3">
          <PanelField label="Monto (RD$)">
            <input
              className={inputCls("principal")}
              inputMode="decimal"
              placeholder="10,000"
              value={form.principal}
              onChange={(e) => set("principal")(e.target.value)}
              data-testid="calc-principal"
              autoFocus
            />
            {fieldError("principal")}
          </PanelField>
          <PanelField label="Tasa total (%)">
            <input
              className={inputCls("ratePercent")}
              inputMode="decimal"
              value={form.ratePercent}
              onChange={(e) => set("ratePercent")(e.target.value)}
              data-testid="calc-rate"
            />
            {fieldError("ratePercent")}
          </PanelField>
          <PanelField label="Frecuencia">
            <PanelSelect
              className={inputCls("paymentFrequency")}
              value={form.paymentFrequency}
              onChange={(e) => set("paymentFrequency")(e.target.value)}
              data-testid="calc-frequency"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </PanelSelect>
          </PanelField>
          <PanelField label={`Plazo base (${PERIOD_NAMES[form.paymentFrequency]})`}>
            <input
              className={inputCls("baseDuration")}
              inputMode="numeric"
              placeholder="10"
              value={form.baseDuration}
              onChange={(e) => set("baseDuration")(e.target.value)}
              data-testid="calc-duration"
            />
            {fieldError("baseDuration")}
          </PanelField>
        </div>

        <div className="flex flex-col gap-[10px]">
          <SectionLabel>Opciones</SectionLabel>
          {outcome.ok ? (
            <table
              className="w-full border-separate border-spacing-0 overflow-hidden rounded-[10px] border border-[#E5EAF1] text-[13px] font-medium"
              data-testid="calc-options"
            >
              <thead>
                <tr className="bg-[#F4F7FB] text-[11px] font-semibold text-[#697A93]">
                  <th className="px-4 py-[9px] text-left">Plazo</th>
                  <th className="px-2 py-[9px] text-left">Tasa</th>
                  <th className="px-2 py-[9px] text-right">Interés</th>
                  <th className="px-2 py-[9px] text-right">Total a pagar</th>
                  <th className="px-4 py-[9px] text-right">Cuota</th>
                </tr>
              </thead>
              <tbody>
                {outcome.result.options.map((o) => (
                  <tr
                    key={o.duration}
                    data-testid={o.isBase ? "calc-option-base" : "calc-option"}
                    className={cn(
                      "[&>td]:border-t [&>td]:border-[#E5EAF1]",
                      o.isBase ? "bg-[#E9F2FF] text-[#1F4AA8]" : "text-[#14254A]"
                    )}
                  >
                    <td className="px-4 py-[11px]">
                      <span className="inline-flex items-center gap-[6px]">
                        {o.duration} {unit}
                        {o.isBase && (
                          <span className="rounded-full bg-[#1F4AA8] px-[6px] py-px text-[10px] font-semibold text-white">
                            base
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-[11px]">{formatRate(o.interestRate)}</td>
                    <td className="px-2 py-[11px] text-right">{formatAmount(o.totalInterest)}</td>
                    <td className="px-2 py-[11px] text-right">{formatAmount(o.totalRepay)}</td>
                    <td className={cn("px-4 py-[11px] text-right", o.isBase && "font-bold")}>
                      {formatAmount(o.paymentPerPeriod)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-[10px] border border-[#E5EAF1] bg-[#F4F7FB] text-[13px] font-medium text-[#697A93]"
              data-testid="calc-empty"
            >
              <Calculator size={20} className="text-[#A9B6C8]" />
              Completa los datos para ver las opciones.
            </div>
          )}
        </div>

        {outcome.ok && (
          <p className="text-[12px] font-medium leading-[1.45] text-[#697A93]">
            La tasa sube o baja {formatRate(outcome.result.adjustmentPerPeriod)} por cada período de
            diferencia con el plazo base, entre {formatRate(outcome.result.minRate)} y{" "}
            {formatRate(outcome.result.maxRate)}. La cuota se redondea hacia arriba a{" "}
            {formatAmount(DEFAULT_PAYMENT_ROUNDING_INCREMENT)}.
          </p>
        )}
      </div>
    </SidePanel>
  );
}
