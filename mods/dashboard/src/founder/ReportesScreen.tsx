/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reports catalog (`/founder/reportes`) — Pencil "Founder / Reportes" (node
 * Gz8x7). Six reports, each produced from the shared `defineReport`
 * definition in `@mikro/common` (issue #110 / unify-reporting-strategy):
 * estado de cuenta, clientes, préstamos en riesgo, renovación, desempeño,
 * contable. Every row downloads a branded PDF via the existing `saveFile`
 * helper (JSON is available through the same tRPC procedure with
 * `format: "json"` but the catalog's single "Descargar" button — same
 * one-click convention as the loan-statement founder-feed card — defaults to
 * PDF; the format chips are informational, matching the Pencil design).
 *
 * The audit log (month-scoped CSV, `exportAuditLog`) is NOT part of the
 * updated Pencil catalog — its fate is being decided separately by the
 * owner — so it is kept exactly as it was, under its own label below the
 * six-report list, untouched by this migration.
 *
 * "Estado de cuenta" (loan-statement) is per-loan, not period-scoped, so it
 * doesn't fit this catalog's one-click period download: rendered disabled
 * with a short note instead of a broken/misleading download (see design.md
 * risk note + task 9.3 guidance). Generate it from a loan's detail view or
 * the founder-feed automation instead.
 */
import { useMemo, useState } from "react";
import {
  CalendarCheck,
  ChevronDown,
  Download,
  Receipt,
  Repeat,
  ScrollText,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { trpc } from "../lib/trpc";
import { useToast } from "../components/ui/ToastProvider";
import { saveFile } from "../lib/saveFile";

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

interface MonthOption {
  year: number;
  month: number; // 1-12
  label: string;
}

// Operations began January 2026 — no report data exists before this (issue #168).
const OPS_START_YEAR = 2026;
const OPS_START_MONTH = 1;

/**
 * Rolling window of months ending at the current one — never a future month,
 * never earlier than operations start (Jan 2026).
 */
function buildMonthOptions(now: Date, count = 12): MonthOption[] {
  const options: MonthOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const beforeOpsStart =
      d.getFullYear() < OPS_START_YEAR ||
      (d.getFullYear() === OPS_START_YEAR && d.getMonth() + 1 < OPS_START_MONTH);
    if (beforeOpsStart) break;
    options.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`
    });
  }
  // Guard against a clock reading before ops start (misconfigured device,
  // stale build) — never return an empty list, callers assume options[0] exists.
  if (options.length === 0) {
    options.push({
      year: OPS_START_YEAR,
      month: OPS_START_MONTH,
      label: `${MONTHS_ES[OPS_START_MONTH - 1]} ${OPS_START_YEAR}`
    });
  }
  return options;
}

function monthValue(o: { year: number; month: number }): string {
  return `${o.year}-${String(o.month).padStart(2, "0")}`;
}

/** First/last ISO date (UTC) of the selected month — passed to period-scoped reports. */
function monthBounds(o: { year: number; month: number }): { startDate: string; endDate: string } {
  const start = new Date(Date.UTC(o.year, o.month - 1, 1));
  const end = new Date(Date.UTC(o.year, o.month, 0));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

/** Decode a base64 string (as returned by the report mutations) into raw bytes for saveFile. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type ReportId =
  | "estado-cuenta"
  | "clientes"
  | "prestamos-en-riesgo"
  | "renovacion"
  | "desempeno"
  | "contable"
  | "audit-log";

interface ReportEntry {
  id: ReportId;
  icon: LucideIcon;
  chipBg: string;
  iconColor: string;
  title: string;
  description: string;
  formats: string[];
  /** false rows show a disabled "Descargar" with a note instead of a download. */
  available: boolean;
  disabledNote?: string;
}

// Data-driven catalog (Pencil node Gz8x7, "Founder / Reportes"). Adding a
// future report is adding an entry here (+ a case in handleDownload) — the
// screen is static.
const CATALOG: ReportEntry[] = [
  {
    id: "estado-cuenta",
    icon: Receipt,
    chipBg: "bg-[#E9F2FF]",
    iconColor: "text-[#1F4AA8]",
    title: "Estado de cuenta",
    description: "Por préstamo · cronograma, mora y verificación del ledger",
    formats: ["PDF", "JSON"],
    available: false,
    disabledNote: "Por préstamo — genéralo desde la ficha del préstamo o el copiloto."
  },
  {
    id: "clientes",
    icon: Users,
    chipBg: "bg-[#E9F2FF]",
    iconColor: "text-[#1F4AA8]",
    title: "Clientes",
    description: "Cartera de clientes por estado de salud",
    formats: ["PDF", "JSON"],
    available: true
  },
  {
    id: "prestamos-en-riesgo",
    icon: TriangleAlert,
    chipBg: "bg-[#FDF1E3]",
    iconColor: "text-[#D97706]",
    title: "Préstamos en riesgo",
    description: "Atrasados y en incumplimiento · mora y notas",
    formats: ["PDF", "JSON"],
    available: true
  },
  {
    id: "renovacion",
    icon: Repeat,
    chipBg: "bg-[#E8F7EE]",
    iconColor: "text-[#16A34A]",
    title: "Renovación",
    description: "Clientes elegibles para un nuevo ciclo",
    formats: ["PDF", "JSON"],
    available: true
  },
  {
    id: "desempeno",
    icon: TrendingUp,
    chipBg: "bg-[#E9F2FF]",
    iconColor: "text-[#1F4AA8]",
    title: "Desempeño",
    description: "Salud de la cartera y proyección financiera",
    formats: ["PDF", "JSON"],
    available: true
  },
  {
    id: "contable",
    icon: Wallet,
    chipBg: "bg-[#E8F7EE]",
    iconColor: "text-[#16A34A]",
    title: "Contable",
    description: "Ingresos, gastos y balances del período",
    formats: ["PDF", "JSON"],
    available: true
  }
];

// Kept exactly as it was — not part of the updated Pencil catalog; its fate
// (CSV vs. JSON/PDF, or removal) is a separate decision for the owner.
const AUDIT_LOG_ENTRY: ReportEntry = {
  id: "audit-log",
  icon: ScrollText,
  chipBg: "bg-[#FDF1E3]",
  iconColor: "text-[#D97706]",
  title: "Registro de auditoría",
  description: "Exportación completa de los eventos del mes · directo del event log",
  formats: ["Excel"],
  available: true
};

function GroupLabel({ children }: { children: string }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[#697A93]">
      {children}
    </div>
  );
}

export function ReportesScreen() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const monthOptions = useMemo(() => buildMonthOptions(new Date()), []);
  const [period, setPeriod] = useState(() => monthValue(monthOptions[0]!));
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const selected = monthOptions.find((o) => monthValue(o) === period) ?? monthOptions[0]!;

  const generateCustomersReport = trpc.generateCustomersReport.useMutation();
  const generateDefaultedReport = trpc.generateDefaultedReport.useMutation();
  const generateRenewalCandidatesReport = trpc.generateRenewalCandidatesReport.useMutation();
  const generatePerformanceReport = trpc.generatePerformanceReport.useMutation();
  const generateAccountingReport = trpc.accounting.generateAccountingReport.useMutation();

  async function handleDownload(entry: ReportEntry) {
    if (!entry.available) return;
    setDownloadingId(entry.id);
    try {
      const { startDate, endDate } = monthBounds(selected);

      switch (entry.id) {
        case "audit-log": {
          const result = await utils.exportAuditLog.fetch({
            year: selected.year,
            month: selected.month
          });
          const bytes = new TextEncoder().encode(result.csv);
          await saveFile(bytes, result.filename, "text/csv");
          break;
        }
        case "clientes": {
          const result = await generateCustomersReport.mutateAsync({ format: "pdf" });
          if (!result.pdfBase64) throw new Error("El servidor no devolvió el PDF esperado.");
          await saveFile(base64ToBytes(result.pdfBase64), result.filename, result.mimeType);
          break;
        }
        case "prestamos-en-riesgo": {
          const result = await generateDefaultedReport.mutateAsync({ format: "pdf" });
          if (!result.pdfBase64) throw new Error("El servidor no devolvió el PDF esperado.");
          await saveFile(base64ToBytes(result.pdfBase64), result.filename, result.mimeType);
          break;
        }
        case "renovacion": {
          const result = await generateRenewalCandidatesReport.mutateAsync({ format: "pdf" });
          if (!result.pdfBase64) throw new Error("El servidor no devolvió el PDF esperado.");
          await saveFile(base64ToBytes(result.pdfBase64), result.filename, result.mimeType);
          break;
        }
        case "desempeno": {
          const result = await generatePerformanceReport.mutateAsync({
            startDate,
            endDate,
            format: "pdf"
          });
          if (!result.pdfBase64) throw new Error("El servidor no devolvió el PDF esperado.");
          await saveFile(base64ToBytes(result.pdfBase64), result.filename, result.mimeType);
          break;
        }
        case "contable": {
          const result = await generateAccountingReport.mutateAsync({
            startDate,
            endDate,
            format: "pdf"
          });
          if (!result.pdfBase64) throw new Error("El servidor no devolvió el PDF esperado.");
          await saveFile(base64ToBytes(result.pdfBase64), result.filename, result.mimeType);
          break;
        }
        default:
          return;
      }
      toast.success("Reporte descargado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el reporte.");
    } finally {
      setDownloadingId(null);
    }
  }

  function renderList(entries: ReportEntry[]) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[#E5EAF1] bg-white">
        {entries.map((entry, i) => {
          const Icon = entry.icon;
          const downloading = downloadingId === entry.id;
          return (
            <div
              key={entry.id}
              className={cn(
                "flex items-center gap-[14px] px-[18px] py-[13px]",
                i > 0 && "border-t border-[#E5EAF1]"
              )}
            >
              <div
                className={cn(
                  "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]",
                  entry.chipBg,
                  entry.iconColor
                )}
              >
                <Icon size={18} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className="truncate text-[14px] font-semibold text-[#14254A]">
                  {entry.title}
                </span>
                <span className="truncate text-[12px] font-medium text-[#697A93]">
                  {entry.description}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {entry.formats.map((f) => (
                  <span
                    key={f}
                    className="rounded-[7px] bg-[#EEF3F9] px-[10px] py-[5px] text-[11px] font-semibold text-[#697A93]"
                  >
                    {f}
                  </span>
                ))}
                <button
                  type="button"
                  disabled={!entry.available || downloading}
                  title={entry.available ? undefined : entry.disabledNote}
                  onClick={() => void handleDownload(entry)}
                  className={cn(
                    "inline-flex items-center gap-[7px] rounded-[9px] bg-[#1F4AA8] px-[14px] py-[9px] text-[13px] font-medium text-white transition hover:bg-[#183c88]",
                    (!entry.available || downloading) &&
                      "cursor-not-allowed opacity-60 hover:bg-[#1F4AA8]"
                  )}
                >
                  <Download size={14} />
                  {downloading ? "Generando…" : "Descargar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-[#E5EAF1] px-6 py-[15px]">
        <div className="flex flex-col gap-[2px]">
          <h1 className="text-[19px] font-semibold tracking-[-0.3px] text-[#14254A]">Reportes</h1>
          <p className="text-[12px] font-medium text-[#697A93]">
            Se generan solos. Descarga y listo.
          </p>
        </div>
        <div className="relative flex items-center gap-2 rounded-[9px] border border-[#E5EAF1] bg-white px-[14px] py-[8px]">
          <CalendarCheck size={14} className="shrink-0 text-[#697A93]" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="cursor-pointer appearance-none bg-transparent pr-4 text-[13px] font-semibold text-[#14254A] focus:outline-none"
          >
            {monthOptions.map((o) => (
              <option key={monthValue(o)} value={monthValue(o)}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-[12px] text-[#697A93]"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#F4F7FB] px-6 py-5">
        <div className="flex flex-col gap-4">
          <GroupLabel>REPORTES</GroupLabel>
          {renderList(CATALOG)}

          <GroupLabel>AUDITORÍA</GroupLabel>
          {renderList([AUDIT_LOG_ENTRY])}

          <div className="flex items-center gap-[10px] rounded-[12px] bg-[#E9F2FF] px-4 py-[13px]">
            <Sparkles size={16} className="shrink-0 text-[#1F4AA8]" />
            <span className="flex-1 text-[13px] font-semibold text-[#1F4AA8]">
              ¿Necesitas otro corte? Pídeselo al copiloto — «dame la cobranza de Miguel en junio, en
              PDF» — y el archivo aparece en esta lista.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
