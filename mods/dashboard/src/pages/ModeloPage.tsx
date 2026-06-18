/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CalendarClock,
  FileDown,
  Flag,
  Info,
  ListOrdered,
  Percent,
  PiggyBank,
  Receipt,
  RefreshCw,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Undo2,
  Wallet
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { formatDop } from "../lib/applications";
import {
  runProjection,
  type FrecuenciaPago,
  type ProjectionConfig,
  type ProjectionResult
} from "../lib/projection";
import { inferDefaults } from "../lib/modelDefaults";
import { saveFile } from "../lib/saveFile";

const FRECUENCIAS: Array<{ value: FrecuenciaPago; label: string }> = [
  { value: "DIARIO", label: "Diario" },
  { value: "SEMANAL", label: "Semanal" },
  { value: "QUINCENAL", label: "Quincenal" },
  { value: "MENSUAL", label: "Mensual" }
];

/** Form keeps strings; parsing happens on recalculate. Percent fields are 0–100. */
interface FormState {
  inversionInicial: string;
  gastosFijosMensuales: string;
  inversionMensual: string;
  horizonteMeses: string;
  prestamoPromedio: string;
  tasaInteres: string;
  frecuenciaPago: FrecuenciaPago;
  plazoBase: string;
  prestamosPorSemana: string;
  tasaMorosidad: string;
  tasaDefault: string;
}

function toForm(config: ProjectionConfig): FormState {
  return {
    inversionInicial: String(config.inversionInicial),
    gastosFijosMensuales: String(config.gastosFijosMensuales),
    inversionMensual: String(config.inversionMensual),
    horizonteMeses: String(config.horizonteMeses),
    prestamoPromedio: String(config.prestamoPromedio),
    tasaInteres: String(Math.round(config.tasaInteres * 100)),
    frecuenciaPago: config.frecuenciaPago,
    plazoBase: String(config.plazoBase),
    prestamosPorSemana: String(config.prestamosPorSemana),
    tasaMorosidad: String(Math.round(config.tasaMorosidad * 100)),
    tasaDefault: String(Math.round(config.tasaDefault * 100))
  };
}

function parseForm(form: FormState): ProjectionConfig | null {
  const num = (s: string) => {
    const v = Number(s.replace(/[,\s]/g, ""));
    return Number.isFinite(v) ? v : NaN;
  };
  const config: ProjectionConfig = {
    inversionInicial: num(form.inversionInicial),
    gastosFijosMensuales: num(form.gastosFijosMensuales),
    inversionMensual: num(form.inversionMensual),
    horizonteMeses: num(form.horizonteMeses),
    prestamoPromedio: num(form.prestamoPromedio),
    tasaInteres: num(form.tasaInteres) / 100,
    frecuenciaPago: form.frecuenciaPago,
    plazoBase: num(form.plazoBase),
    prestamosPorSemana: num(form.prestamosPorSemana),
    tasaMorosidad: num(form.tasaMorosidad) / 100,
    tasaDefault: num(form.tasaDefault) / 100
  };
  const invalid =
    Object.values(config).some((v) => typeof v === "number" && !Number.isFinite(v)) ||
    config.prestamoPromedio <= 0 ||
    config.plazoBase < 1 ||
    config.prestamosPorSemana < 1 ||
    config.horizonteMeses < 1;
  return invalid ? null : config;
}

const EXPENSE_LOOKBACK_MONTHS = 3;

// Last-used parameters persist per browser/device (not per user account —
// localStorage is fine for a single-operator back office; move to a server
// preference if multi-user profiles ever need their own scenarios).
const STORAGE_KEY = "mikro.modelo.params.v1";

function loadSavedForm(): FormState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    const candidate: FormState = {
      inversionInicial: String(saved.inversionInicial ?? ""),
      gastosFijosMensuales: String(saved.gastosFijosMensuales ?? ""),
      inversionMensual: String(saved.inversionMensual ?? ""),
      horizonteMeses: String(saved.horizonteMeses ?? ""),
      prestamoPromedio: String(saved.prestamoPromedio ?? ""),
      tasaInteres: String(saved.tasaInteres ?? ""),
      frecuenciaPago: FRECUENCIAS.some((f) => f.value === saved.frecuenciaPago)
        ? (saved.frecuenciaPago as FrecuenciaPago)
        : "SEMANAL",
      plazoBase: String(saved.plazoBase ?? ""),
      prestamosPorSemana: String(saved.prestamosPorSemana ?? ""),
      tasaMorosidad: String(saved.tasaMorosidad ?? ""),
      tasaDefault: String(saved.tasaDefault ?? "")
    };
    // Only restore if it still parses into a runnable config.
    return parseForm(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function saveForm(form: FormState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  } catch {
    // Storage unavailable (private mode/quota) — persistence is best-effort.
  }
}

// Pencil "Operations / 11 Modelo de Negocio — v2" (OeQNJ): params panel +
// stat cards, cumulative-profit bars, monthly table, sensitivity cards.
// Algorithm ported from skills/mikro-modelo-negocio.skill (see lib/projection.ts).
export function ModeloPage() {
  // Inference inputs. The skill asked for all 11 parameters manually; here we
  // prefill what the operation's own data can answer (see lib/modelDefaults.ts).
  const loans = trpc.listLoans.useQuery({ showAll: true, limit: 100 });
  const accounts = trpc.accounting.listAccounts.useQuery({});
  const expenseRange = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setMonth(start.getMonth() - EXPENSE_LOOKBACK_MONTHS);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, []);
  const expenses = trpc.accounting.listTransactions.useQuery({
    startDate: expenseRange.startDate,
    endDate: expenseRange.endDate,
    type: "EXPENSE",
    limit: 500
  });

  const queriesSettled = !loans.isPending && !accounts.isPending && !expenses.isPending;

  const inferred = useMemo(() => {
    if (!queriesSettled) return null;
    const expenseTotal = (expenses.data ?? [])
      .filter((t) => t.status !== "REVERSED")
      .reduce((sum, t) => sum + t.amount, 0);
    return inferDefaults({
      loans: loans.data,
      accounts: accounts.data,
      expenses: { total: expenseTotal, months: EXPENSE_LOOKBACK_MONTHS }
    });
  }, [queriesSettled, loans.data, accounts.data, expenses.data]);

  // Starts from the last locally saved parameters when available; otherwise
  // null until prefilled from inferred data (or skill defaults on error).
  const [form, setForm] = useState<FormState | null>(loadSavedForm);
  const [config, setConfig] = useState<ProjectionConfig | null>(() => {
    const saved = loadSavedForm();
    return saved ? parseForm(saved) : null;
  });
  const [restored, setRestored] = useState(() => form !== null);

  if (form === null && inferred !== null) {
    setForm(toForm(inferred.config));
    setConfig(inferred.config);
  }

  const result = useMemo(() => (config ? runProjection(config) : null), [config]);

  // Export the on-screen projection as a branded PDF. Saves via the shared
  // helper (native dialog in Tauri, browser download on web). Uses the active
  // `config` so the PDF matches exactly what the page is showing.
  const exportPdf = trpc.generateModeloReport.useMutation({
    onSuccess: async (r) => {
      const bytes = Uint8Array.from(atob(r.dataBase64), (c) => c.charCodeAt(0));
      await saveFile(bytes, r.filename, "application/pdf");
    }
  });

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f));

  const parsed = form ? parseForm(form) : null;

  const inferredCount = inferred
    ? Object.values(inferred.sources).filter((s) => s === "datos").length
    : 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Modelo de negocio"
        subtitle="Proyección financiera y punto de equilibrio · valores precargados desde la operación"
        action={
          <>
            {exportPdf.isError && (
              <span className="text-[13px] text-ds-red" role="alert">
                No se pudo exportar
              </span>
            )}
            <Button
              variant="secondary"
              icon={FileDown}
              disabled={config === null || exportPdf.isPending}
              onClick={() => config && exportPdf.mutate(config)}
            >
              {exportPdf.isPending ? "Generando…" : "Exportar PDF"}
            </Button>
          </>
        }
      />

      {form === null ? (
        <div className="p-7 text-sm text-ds-muted">Cargando datos de la operación…</div>
      ) : (
        <div className="flex flex-1 items-start gap-5 overflow-auto p-7">
          {/* Parameters panel */}
          <div className="flex w-[400px] shrink-0 flex-col gap-[14px] rounded-[14px] border border-ds-border bg-ds-surface p-5">
            <GroupLabel>Inversión y costos</GroupLabel>
            <div className="flex gap-3">
              <Field
                label="Inversión inicial (RD$)"
                icon={Wallet}
                inputMode="numeric"
                value={form.inversionInicial}
                onChange={set("inversionInicial")}
              />
              <Field
                label="Gastos fijos / mes (RD$)"
                icon={Receipt}
                inputMode="numeric"
                value={form.gastosFijosMensuales}
                onChange={set("gastosFijosMensuales")}
              />
            </div>
            <div className="flex gap-3">
              <Field
                label="Inversión mensual (RD$)"
                icon={PiggyBank}
                inputMode="numeric"
                value={form.inversionMensual}
                onChange={set("inversionMensual")}
              />
              <Field
                label="Horizonte (meses)"
                icon={Calendar}
                inputMode="numeric"
                value={form.horizonteMeses}
                onChange={set("horizonteMeses")}
              />
            </div>

            <GroupLabel>Préstamo típico</GroupLabel>
            <div className="flex gap-3">
              <Field
                label="Monto promedio (RD$)"
                icon={Banknote}
                inputMode="numeric"
                value={form.prestamoPromedio}
                onChange={set("prestamoPromedio")}
              />
              <Field
                label="Tasa de interés (%)"
                icon={Percent}
                inputMode="numeric"
                value={form.tasaInteres}
                onChange={set("tasaInteres")}
              />
            </div>
            <div className="flex gap-3">
              <FrequencySelect
                value={form.frecuenciaPago}
                onChange={(v) => setForm((f) => (f ? { ...f, frecuenciaPago: v } : f))}
              />
              <Field
                label="Plazo (cuotas)"
                icon={ListOrdered}
                inputMode="numeric"
                value={form.plazoBase}
                onChange={set("plazoBase")}
              />
            </div>

            <GroupLabel>Volumen y riesgo</GroupLabel>
            <div className="flex gap-3">
              <Field
                label="Préstamos nuevos / semana"
                icon={TrendingUp}
                inputMode="numeric"
                value={form.prestamosPorSemana}
                onChange={set("prestamosPorSemana")}
              />
              <Field
                label="Morosidad esperada (%)"
                icon={Timer}
                inputMode="numeric"
                value={form.tasaMorosidad}
                onChange={set("tasaMorosidad")}
              />
            </div>
            <div className="flex gap-3">
              <Field
                label="Default esperado (%)"
                icon={AlertTriangle}
                inputMode="numeric"
                value={form.tasaDefault}
                onChange={set("tasaDefault")}
              />
              <div className="w-full" />
            </div>

            <div className="flex items-start gap-2 px-0.5 py-1">
              <Info size={14} className="mt-0.5 shrink-0 text-ds-muted" />
              <p className="text-xs font-medium leading-relaxed text-ds-muted">
                {restored
                  ? "Se restauraron los últimos parámetros usados en este equipo. Edítalos o vuelve a los datos de la operación."
                  : inferredCount > 0
                    ? `${inferredCount} valores se precargaron desde préstamos y contabilidad reales` +
                      (inferred && inferred.loanSample > 0
                        ? ` (muestra de ${inferred.loanSample} préstamos).`
                        : ".") +
                      " Edítalos para simular otros escenarios."
                    : "Sin datos suficientes para precargar; se usan los valores típicos del modelo. Edítalos para simular escenarios."}
              </p>
            </div>

            <Button
              icon={RefreshCw}
              block
              disabled={parsed === null}
              onClick={() => {
                if (parsed && form) {
                  setConfig(parsed);
                  saveForm(form);
                }
              }}
            >
              Recalcular proyección
            </Button>
            <Button
              variant="secondary"
              icon={Undo2}
              block
              disabled={inferred === null}
              onClick={() => {
                if (inferred) {
                  setForm(toForm(inferred.config));
                  setConfig(inferred.config);
                  setRestored(false);
                  try {
                    localStorage.removeItem(STORAGE_KEY);
                  } catch {
                    // best-effort
                  }
                }
              }}
            >
              Usar datos de la operación
            </Button>
            {parsed === null && (
              <span className="text-[13px] text-ds-red" role="alert">
                Revisa los valores: todos deben ser números válidos.
              </span>
            )}
          </div>

          {/* Results */}
          {result && <Results result={result} />}
        </div>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-ds-muted">
      {children}
    </span>
  );
}

/** Select styled like Field (cp/field) — Field only renders <input>. */
function FrequencySelect({
  value,
  onChange
}: {
  value: FrecuenciaPago;
  onChange: (v: FrecuenciaPago) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-[7px]">
      <label className="text-[13px] font-medium text-brand-ink">Frecuencia de pago</label>
      <div className="flex items-center gap-[10px] rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] focus-within:border-brand-blue-sky">
        <CalendarClock size={16} className="shrink-0 text-ds-muted" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as FrecuenciaPago)}
          className="w-full bg-transparent text-sm font-medium text-brand-ink outline-none"
        >
          {FRECUENCIAS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const fmtK = (v: number) =>
  Math.abs(v) >= 1000 ? `RD$ ${Math.round(v / 1000)}K` : `RD$ ${Math.round(v)}`;

function Results({ result }: { result: ProjectionResult }) {
  const { summary, monthlySummaries, sensitivity, config } = result;
  const be = summary.breakEvenWeek;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      {/* Stat cards */}
      <div className="flex gap-[14px]">
        <StatCard
          label="Punto de equilibrio"
          icon={Flag}
          value={summary.breakEvenMonth !== null ? `Mes ${summary.breakEvenMonth}` : ""}
          delta={{
            text: be !== null ? `Semana ${be} del horizonte` : "No se alcanza en el horizonte",
            tone: be !== null ? "green" : "red",
            down: be === null
          }}
        />
        <StatCard
          label="Ganancia mensual madura"
          icon={Banknote}
          value={fmtK(summary.matureMonthlyProfit)}
          delta={{ text: "Promedio últimos 3 meses" }}
        />
        <StatCard
          label={`ROI a ${config.horizonteMeses} meses`}
          icon={Percent}
          value={`${summary.roiAtHorizonPct.toFixed(0)}%`}
          delta={{
            text: `Sobre ${fmtK(summary.totalInvested)} invertidos`,
            tone: summary.roiAtHorizonPct >= 0 ? "green" : "red",
            down: summary.roiAtHorizonPct < 0
          }}
        />
        <StatCard
          label="Mínimo para cubrir gastos"
          icon={Target}
          value={
            summary.minLoansPerWeekForBreakeven >= 999
              ? "No viable"
              : `${summary.minLoansPerWeekForBreakeven} /sem`
          }
          delta={{ text: "Préstamos nuevos por semana" }}
        />
      </div>

      {/* Cumulative profit bars */}
      <div className="flex flex-col gap-4 rounded-[14px] border border-ds-border bg-ds-surface p-5">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-medium text-brand-ink">Ganancia acumulada por mes</span>
          <div className="flex items-center gap-4">
            <Legend color="bg-ds-red" label="Pérdida acumulada" />
            <Legend color="bg-ds-green" label="Ganancia acumulada" />
          </div>
        </div>
        <CumulativeBars months={monthlySummaries} />
        <div className="flex items-center gap-2">
          <Flag size={14} className={be !== null ? "text-ds-green" : "text-ds-red"} />
          <span className="text-xs font-medium text-ds-muted">
            {be !== null
              ? `La ganancia acumulada cubre los gastos en la semana ${be} (mes ${summary.breakEvenMonth}) del horizonte proyectado.`
              : "La operación no alcanza el punto de equilibrio dentro del horizonte; ajusta volumen, tasa o gastos."}
          </span>
        </div>
      </div>

      {/* Monthly table */}
      <div className="overflow-hidden rounded-[14px] border border-ds-border bg-ds-surface">
        <div className="flex items-center justify-between px-[18px] py-[15px]">
          <span className="text-[15px] font-medium text-brand-ink">Proyección mensual</span>
          <span className="text-[13px] font-medium text-ds-muted">Montos en RD$</span>
        </div>
        <div className="flex items-center gap-[14px] border-y border-ds-border bg-ds-bg px-[18px] py-[10px] text-[11px] font-bold uppercase tracking-[0.6px] text-ds-muted">
          <span className="w-[50px]">Mes</span>
          <span className="w-[80px]">Préstamos</span>
          <span className="flex-1">Recaudo</span>
          <span className="w-[90px]">Mora</span>
          <span className="w-[100px]">Gastos fijos</span>
          <span className="w-[90px]">Pérdidas</span>
          <span className="w-[110px]">Neto</span>
          <span className="w-[110px]">Acumulado</span>
        </div>
        {monthlySummaries.map((m, i, arr) => (
          <div
            key={m.month}
            className={`flex items-center gap-[14px] px-[18px] py-3 text-[13px] font-medium text-brand-ink ${
              i === arr.length - 1 ? "" : "border-b border-ds-border"
            }`}
          >
            <span className="w-[50px]">{m.month}</span>
            <span className="w-[80px]">{m.newLoans}</span>
            <span className="flex-1">{formatDop(m.installmentCollections)}</span>
            <span className="w-[90px]">{formatDop(m.moraIncome)}</span>
            <span className="w-[100px]">{formatDop(m.fixedCosts)}</span>
            <span className="w-[90px]">{formatDop(m.defaultLosses)}</span>
            <Signed className="w-[110px]" value={m.netProfit} />
            <Signed className="w-[110px]" value={m.cumulativeProfit} />
          </div>
        ))}
      </div>

      {/* Sensitivity */}
      <div className="flex gap-[14px]">
        {sensitivity.map((s) => (
          <SensitivityCard key={s.label} scenario={s} />
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-[6px]">
      <span className={`h-[10px] w-[10px] rounded-[3px] ${color}`} />
      <span className="text-xs font-medium text-ds-muted">{label}</span>
    </span>
  );
}

function CumulativeBars({ months }: { months: ProjectionResult["monthlySummaries"] }) {
  const max = Math.max(...months.map((m) => Math.abs(m.cumulativeProfit)), 1);
  return (
    <div className="flex h-[170px] items-end gap-[10px]">
      {months.map((m) => {
        const h = Math.max(4, Math.round((Math.abs(m.cumulativeProfit) / max) * 140));
        const positive = m.cumulativeProfit >= 0;
        return (
          <div
            key={m.month}
            className="flex h-full flex-1 flex-col items-center justify-end gap-[6px]"
          >
            <div
              className={`w-full rounded-t-[6px] ${positive ? "bg-ds-green" : "bg-ds-red"}`}
              style={{ height: h }}
              title={`Mes ${m.month}: ${formatDop(m.cumulativeProfit)}`}
            />
            <span className="text-[11px] font-medium text-ds-muted">M{m.month}</span>
          </div>
        );
      })}
    </div>
  );
}

function Signed({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={`font-bold ${value >= 0 ? "text-ds-green" : "text-ds-red"} ${className ?? ""}`}
    >
      {formatDop(value)}
    </span>
  );
}

function SensitivityCard({ scenario }: { scenario: ProjectionResult["sensitivity"][number] }) {
  const worse = scenario.minLoansNeeded !== undefined || scenario.description.includes("menos");
  const Icon =
    scenario.minLoansNeeded !== undefined ? AlertTriangle : worse ? TrendingDown : TrendingUp;
  const tone =
    scenario.minLoansNeeded !== undefined
      ? "text-ds-amber"
      : worse
        ? "text-ds-red"
        : "text-ds-green";

  let body: string;
  if (scenario.minLoansNeeded !== undefined) {
    body =
      scenario.minLoansNeeded >= 999
        ? `${scenario.description}: la operación no sería viable con la estructura actual.`
        : `${scenario.description}: necesitarías ${scenario.minLoansNeeded} préstamos nuevos por semana para cubrir los gastos fijos.`;
  } else {
    const beTxt =
      scenario.breakEvenMonth != null
        ? `el punto de equilibrio se mueve al mes ${scenario.breakEvenMonth}`
        : "no se alcanza el punto de equilibrio en el horizonte";
    body = `${scenario.description}: ${beTxt} y la ganancia madura queda en ${fmtK(
      scenario.matureMonthlyProfit ?? 0
    )}/mes.`;
  }

  return (
    <div className="flex flex-1 flex-col gap-2 rounded-[14px] border border-ds-border bg-ds-surface px-[18px] py-4">
      <div className="flex items-center gap-2">
        <Icon size={15} className={tone} />
        <span className="text-[13px] font-bold text-brand-ink">{scenario.label}</span>
      </div>
      <p className="text-xs font-medium leading-relaxed text-ds-muted">{body}</p>
    </div>
  );
}

// DEVELOPER NOTES
// - The skill (mikro-modelo-negocio) collected all 11 parameters by asking the
//   user; here listLoans/listAccounts/listTransactions prefill 8 of them. The
//   AI narrative + PDF steps of the skill are intentionally out of scope (no
//   AI per product decision); a future "Exportar PDF" action could reuse
//   mods/common report tooling.
// - Morosidad (delinquency %) is NOT inferred — it needs per-loan cycle status
//   (computeAccruedMora over active loans). Consider a small apiserver
//   procedure (e.g. getPortfolioRiskStats) that returns observed delinquency
//   and default rates; then mark those fields as data-backed too.
// - listLoans caps at limit=100, so inference samples the first 100 loans.
//   Replace with a dedicated aggregate procedure when the portfolio outgrows it.
