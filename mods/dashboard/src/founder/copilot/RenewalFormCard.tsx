/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The interactive loan renewal card (openspec add-loan-renewal): pick the
 * ACTIVE loan, see what the customer still owes (balance + mora → editable
 * payoff), set the new loan's terms, and renew. The new loan carries the full
 * principal; only `principal − payoff` is disbursed. A "generar contrato"
 * checkbox (checked by default) stores and downloads the new contract in the
 * same submit. Presentational: the container owns the quote query and the
 * `renewLoan` mutation.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
  UserRound
} from "lucide-react";
import { cn } from "../../lib/cn";
import { formatDop } from "../../lib/applications";
import type {
  ContractFrequency,
  CreateFormStatus,
  DisbursementAccountOption,
  RenewalFormValues,
  RenewalOutcome,
  RenewalQuoteView
} from "./types";

const FREQUENCIES: Array<{ value: ContractFrequency; label: string }> = [
  { value: "DAILY", label: "Diaria" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" }
];

const FREQUENCY_LABEL: Record<ContractFrequency, string> = {
  DAILY: "diarias",
  WEEKLY: "semanales",
  BIWEEKLY: "quincenales",
  MONTHLY: "mensuales"
};

const parseNumeric = (value: string): number => Number(value.replace(/[\s,]/g, ""));

const LABEL = "text-[12px] font-semibold text-[#14254A]";
const INPUT =
  "w-full rounded-[8px] border border-[#E5EAF1] bg-[#F4F7FB] px-[14px] py-[10px] text-[14px] font-medium text-[#14254A] outline-none placeholder:text-[#697A93] focus:border-[#1F4AA8]";

export type RenewalQuoteStatus = "idle" | "loading" | "ready" | "error";

export interface RenewalFormCardProps {
  /** Loan number the copilot was given, if any — loads its quote on mount. */
  loanId?: number;
  quote?: RenewalQuoteView | null;
  quoteStatus?: RenewalQuoteStatus;
  quoteError?: string;
  /** Called with a loan number to fetch its quote. */
  onLoadQuote: (loanId: number) => void;
  accounts: DisbursementAccountOption[];
  onRenew: (values: RenewalFormValues) => void;
  status?: CreateFormStatus;
  error?: string;
  outcome?: RenewalOutcome;
  className?: string;
}

export function RenewalFormCard({
  loanId,
  quote,
  quoteStatus = "idle",
  quoteError,
  onLoadQuote,
  accounts,
  onRenew,
  status = "idle",
  error,
  outcome,
  className
}: RenewalFormCardProps) {
  const [loanQuery, setLoanQuery] = useState(loanId ? String(loanId) : "");
  const [payoff, setPayoff] = useState("");
  const [principal, setPrincipal] = useState("");
  const [termLength, setTermLength] = useState("");
  const [frequency, setFrequency] = useState<ContractFrequency>("WEEKLY");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [startingDate, setStartingDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [generateContract, setGenerateContract] = useState(true);

  const renewing = status === "creating";
  const done = status === "done";

  useEffect(() => {
    if (loanId) onLoadQuote(loanId);
  }, [loanId, onLoadQuote]);

  // Pre-fill from the quote: payoff = suggested, new terms = current terms
  // (renewals usually repeat them). Every value stays editable.
  useEffect(() => {
    if (!quote) return;
    setPayoff(String(quote.suggestedPayoff));
    setPrincipal(String(quote.currentTerms.principal));
    setTermLength(String(quote.currentTerms.termLength));
    setFrequency(quote.currentTerms.paymentFrequency);
    setPaymentAmount(String(quote.currentTerms.paymentAmount));
  }, [quote]);

  useEffect(() => {
    if (accountId || accounts.length === 0) return;
    setAccountId((accounts.find((a) => a.isDefault) ?? accounts[0]).id);
  }, [accounts, accountId]);

  const payoffN = parseNumeric(payoff);
  const principalN = parseNumeric(principal);
  const net = principalN - payoffN;
  const netValid = Number.isFinite(net) && net > 0;

  const valid = useMemo(
    () =>
      !!quote &&
      payoffN >= 0 &&
      principalN > 0 &&
      netValid &&
      Number.isInteger(parseNumeric(termLength)) &&
      parseNumeric(termLength) > 0 &&
      parseNumeric(paymentAmount) > 0,
    [quote, payoffN, principalN, netValid, termLength, paymentAmount]
  );

  const lookUp = () => {
    const n = parseNumeric(loanQuery.replace(/^#/, ""));
    if (Number.isInteger(n) && n > 0) onLoadQuote(n);
  };

  const submit = () => {
    if (!valid || !quote || renewing || done) return;
    onRenew({
      loanId: quote.loanId,
      payoffAmount: payoffN,
      principal: principalN,
      termLength: parseNumeric(termLength),
      paymentAmount: parseNumeric(paymentAmount),
      paymentFrequency: frequency,
      startingDate: startingDate.trim() || undefined,
      disbursementAccountId: accountId || undefined,
      generateContract
    });
  };

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[12px] border border-[#E5EAF1] bg-white",
        className
      )}
    >
      <div className="flex items-center gap-[10px] border-b border-[#E5EAF1] bg-[#EEF3F9] px-[14px] py-[11px]">
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] bg-[#1F4AA8]">
          <RefreshCw size={14} strokeWidth={2} className="text-white" />
        </span>
        <div className="flex min-w-0 flex-col gap-[1px]">
          <span className="text-[14px] font-semibold text-[#14254A]">Renovar préstamo</span>
          <span className="text-[11px] font-medium text-[#697A93]">
            Cierra el actual · abre uno nuevo que cubre el saldo
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-[12px] px-[14px] py-[12px]">
        {/* Loan lookup */}
        {!quote && (
          <div className="flex flex-col gap-[7px]">
            <span className={LABEL}>Préstamo a renovar</span>
            <div className="flex gap-[8px]">
              <div className="flex flex-1 items-center gap-[10px] rounded-[8px] border border-[#E5EAF1] bg-[#F4F7FB] px-[14px] py-[10px]">
                <Search size={16} strokeWidth={2} className="shrink-0 text-[#697A93]" />
                <input
                  inputMode="numeric"
                  value={loanQuery}
                  onChange={(e) => setLoanQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookUp()}
                  placeholder="Número de préstamo, p. ej. 10034"
                  className="w-full bg-transparent text-[14px] font-medium text-[#14254A] outline-none placeholder:text-[#697A93]"
                />
              </div>
              <button
                type="button"
                onClick={lookUp}
                disabled={quoteStatus === "loading"}
                className="rounded-[8px] border border-[#E5EAF1] px-[14px] text-[13px] font-medium text-[#1F4AA8]"
              >
                {quoteStatus === "loading" ? (
                  <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                ) : (
                  "Buscar"
                )}
              </button>
            </div>
            {quoteStatus === "error" && quoteError && (
              <p className="text-[12px] font-medium text-[#B42121]">{quoteError}</p>
            )}
          </div>
        )}

        {quote && (
          <>
            {/* Current loan + what's owed */}
            <div className="flex flex-col gap-[8px] rounded-[8px] border border-[#E5EAF1] bg-[#F4F7FB] px-[14px] py-[10px]">
              <div className="flex items-center gap-[10px]">
                <UserRound size={16} strokeWidth={2} className="shrink-0 text-[#697A93]" />
                <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
                  <span className="truncate text-[14px] font-medium text-[#14254A]">
                    {quote.customer.name}
                  </span>
                  <span className="text-[11px] font-medium text-[#697A93]">
                    Préstamo #{quote.loanId} · {formatDop(quote.currentTerms.principal)} ·{" "}
                    {quote.cuotasCovered}/{quote.currentTerms.termLength} cuotas{" "}
                    {FREQUENCY_LABEL[quote.currentTerms.paymentFrequency]} pagadas
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-[12px] font-medium text-[#697A93]">
                <span>Saldo pendiente</span>
                <span className="text-[#14254A]">{formatDop(quote.remainingBalance)}</span>
              </div>
              <div className="flex justify-between text-[12px] font-medium text-[#697A93]">
                <span>Mora</span>
                <span className="text-[#14254A]">{formatDop(quote.moraAccrued)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-[7px]">
              <span className={LABEL}>Saldo a cubrir con el nuevo préstamo (RD$)</span>
              <input
                inputMode="decimal"
                value={payoff}
                onChange={(e) => setPayoff(e.target.value)}
                className={INPUT}
              />
            </div>

            {/* New terms */}
            <div className="flex gap-[10px]">
              <div className="flex flex-1 flex-col gap-[7px]">
                <span className={LABEL}>Nuevo principal (RD$)</span>
                <input
                  inputMode="decimal"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  className={INPUT}
                />
              </div>
              <div className="flex flex-1 flex-col gap-[7px]">
                <span className={LABEL}>Cuotas</span>
                <input
                  inputMode="numeric"
                  value={termLength}
                  onChange={(e) => setTermLength(e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>

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
                  className={INPUT}
                />
              </div>
            </div>

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

            {/* Net to disburse */}
            <div
              className={cn(
                "flex items-center justify-between rounded-[8px] px-[14px] py-[10px]",
                netValid ? "bg-[#E8F7EE]" : "bg-[#FCEBEB]"
              )}
            >
              <span
                className={cn(
                  "text-[12px] font-semibold",
                  netValid ? "text-[#16A34A]" : "text-[#DC2626]"
                )}
              >
                {netValid ? "A desembolsar" : "El saldo debe ser menor que el principal"}
              </span>
              {netValid && (
                <span className="text-[16px] font-semibold text-[#14254A]">{formatDop(net)}</span>
              )}
            </div>

            {accounts.length > 1 && (
              <div className="flex flex-col gap-[7px]">
                <span className={LABEL}>Desembolsar desde</span>
                <div className="relative">
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className={cn(INPUT, "appearance-none pr-[34px]")}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id} disabled={!a.available}>
                        {a.name}
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
            )}

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
                {generateContract && <Check size={12} strokeWidth={2} className="text-white" />}
              </span>
              <span className="text-[13px] font-medium text-[#14254A]">
                Generar contrato con estos términos
              </span>
            </button>

            {done && outcome && (
              <div className="flex items-center gap-[6px] text-[12px] font-medium text-[#16A34A]">
                <span>#{outcome.oldLoanId}</span>
                <ArrowRight size={12} strokeWidth={2} />
                <span>
                  #{outcome.newLoanId} · {formatDop(outcome.netDisbursed)} desde{" "}
                  {outcome.accountName}
                </span>
              </div>
            )}

            {status === "error" && error && (
              <p className="text-[12px] font-medium text-[#B42121]">{error}</p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!valid || renewing || done}
              className={cn(
                "flex w-full items-center justify-center gap-[7px] rounded-[9px] px-[18px] py-[11px] text-[14px] font-medium text-white transition",
                done
                  ? "bg-[#16A34A]"
                  : valid && !renewing
                    ? "bg-[#1F4AA8] hover:bg-[#103A8A]"
                    : "cursor-not-allowed bg-[#9DB0D4]"
              )}
            >
              {renewing ? (
                <Loader2 size={16} strokeWidth={2} className="animate-spin" />
              ) : done ? (
                <CheckCircle2 size={16} strokeWidth={2} />
              ) : (
                <RefreshCw size={16} strokeWidth={2} />
              )}
              {renewing ? "Renovando…" : done ? "Préstamo renovado" : "Renovar préstamo"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
