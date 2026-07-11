/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reports catalog (`/founder/reportes`) — Pencil "Founder / Reportes" (node
 * Gz8x7). Five reports, each produced from the shared `defineReport`
 * definition in `@mikro/common` (issue #110 / unify-reporting-strategy):
 * clientes, préstamos en riesgo, renovación, desempeño, contable.
 * "Descargar" is a split button: the main half always names the
 * format it will fetch (e.g. "Descargar PDF", `selectedFormat` state,
 * defaults to PDF) and downloads immediately via `saveFile`/
 * `downloadReportResult` (PDF: base64 bytes; JSON: the mutation's raw `data`,
 * stringified); rows with more than one format get a small chevron half that
 * opens a two-item menu to switch the format (a checkmark marks the active
 * one). Single-format rows (audit log) render a plain button with no
 * chevron — nothing to choose. An earlier version rendered the formats as two
 * standalone toggle chips next to the button, which read as two competing
 * controls rather than one action; the split button collapses it back to one.
 *
 * The audit log (month-scoped CSV, `exportAuditLog`) is NOT part of the
 * updated Pencil catalog — its fate is being decided separately by the
 * owner — so it is kept exactly as it was (format label now says CSV, not the
 * stale pre-migration "Excel"), under its own label below the six-report
 * list, untouched by this migration.
 *
 * "Estado de cuenta" (loan-statement) is deliberately NOT in this catalog:
 * it is per-loan, not period-scoped, and is generated on demand via the
 * founder copilot (`generateLoanStatement` direct tool) — never a one-click
 * period download and never a scheduled founder-feed automation
 * (mikro/move-loan-statement-to-copilot).
 */
import { useMemo, useState } from "react";
import {
  CalendarCheck,
  Check,
  ChevronDown,
  Download,
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
import {
  base64ToBytes,
  saveFile,
  savedMessage,
  SAVED_TOAST_MS,
  type SaveResult
} from "../lib/saveFile";

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

type ReportId =
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
}

// Data-driven catalog (Pencil node Gz8x7, "Founder / Reportes"). Adding a
// future report is adding an entry here (+ a case in handleDownload) — the
// screen is static.
const CATALOG: ReportEntry[] = [
  {
    id: "clientes",
    icon: Users,
    chipBg: "bg-[#E9F2FF]",
    iconColor: "text-[#1F4AA8]",
    title: "Clientes",
    description: "Cartera de clientes por estado de salud",
    formats: ["PDF", "JSON"]
  },
  {
    id: "prestamos-en-riesgo",
    icon: TriangleAlert,
    chipBg: "bg-[#FDF1E3]",
    iconColor: "text-[#D97706]",
    title: "Préstamos en riesgo",
    description: "Atrasados y en incumplimiento · mora y notas",
    formats: ["PDF", "JSON"]
  },
  {
    id: "renovacion",
    icon: Repeat,
    chipBg: "bg-[#E8F7EE]",
    iconColor: "text-[#16A34A]",
    title: "Renovación",
    description: "Clientes elegibles para un nuevo ciclo",
    formats: ["PDF", "JSON"]
  },
  {
    id: "desempeno",
    icon: TrendingUp,
    chipBg: "bg-[#E9F2FF]",
    iconColor: "text-[#1F4AA8]",
    title: "Desempeño",
    description: "Salud de la cartera y proyección financiera",
    formats: ["PDF", "JSON"]
  },
  {
    id: "contable",
    icon: Wallet,
    chipBg: "bg-[#E8F7EE]",
    iconColor: "text-[#16A34A]",
    title: "Contable",
    description: "Ingresos, gastos y balances del período",
    formats: ["PDF", "JSON"]
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
  formats: ["CSV"]
};

function GroupLabel({ children }: { children: string }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[#697A93]">
      {children}
    </div>
  );
}

/** Base64-PDF or raw-JSON report result, as returned by every `generate*Report` mutation. */
interface ReportMutationResult {
  data?: unknown;
  pdfBase64?: string;
  filename: string;
  mimeType: string;
}

/** Save a report result in whichever format was selected — PDF bytes are already base64; JSON is the raw `data` object. Returns where it landed. */
async function downloadReportResult(
  result: ReportMutationResult,
  format: "pdf" | "json"
): Promise<{ saved: SaveResult; filename: string }> {
  if (format === "json") {
    // Guard symmetrically with the PDF branch: without this, a missing `data`
    // would `JSON.stringify` to `undefined` and silently save a file whose
    // contents are the literal text "undefined".
    if (result.data === undefined) throw new Error("El servidor no devolvió los datos esperados.");
    const bytes = new TextEncoder().encode(JSON.stringify(result.data, null, 2));
    const saved = await saveFile(bytes, result.filename, result.mimeType);
    return { saved, filename: result.filename };
  }
  if (!result.pdfBase64) throw new Error("El servidor no devolvió el PDF esperado.");
  const saved = await saveFile(base64ToBytes(result.pdfBase64), result.filename, result.mimeType);
  return { saved, filename: result.filename };
}

export function ReportesScreen() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const monthOptions = useMemo(() => buildMonthOptions(new Date()), []);
  const [period, setPeriod] = useState(() => monthValue(monthOptions[0]!));
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Per-row PDF/JSON pick for reports that support both — defaults to PDF
  // (issue: format was previously hardcoded to PDF with no way to pick JSON
  // from the UI). The button's main label always names the selected format,
  // so there's nothing hidden about what a click downloads.
  const [selectedFormat, setSelectedFormat] = useState<Record<string, "PDF" | "JSON">>({});
  const formatFor = (id: string): "PDF" | "JSON" => selectedFormat[id] ?? "PDF";
  // Which row's format-switch menu is open, if any — closed by the backdrop
  // click-catcher or by picking a format.
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const selected = monthOptions.find((o) => monthValue(o) === period) ?? monthOptions[0]!;

  const generateCustomersReport = trpc.generateCustomersReport.useMutation();
  const generateDefaultedReport = trpc.generateDefaultedReport.useMutation();
  const generateRenewalCandidatesReport = trpc.generateRenewalCandidatesReport.useMutation();
  const generatePerformanceReport = trpc.generatePerformanceReport.useMutation();
  const generateAccountingReport = trpc.accounting.generateAccountingReport.useMutation();

  async function handleDownload(entry: ReportEntry) {
    setDownloadingId(entry.id);
    try {
      const { startDate, endDate } = monthBounds(selected);
      // The selected PDF/JSON format for the multi-format report rows (the
      // audit-log row ignores it — it's always CSV).
      const format = formatFor(entry.id).toLowerCase() as "pdf" | "json";
      let saved: SaveResult;
      let filename: string;

      switch (entry.id) {
        case "audit-log": {
          const result = await utils.exportAuditLog.fetch({
            year: selected.year,
            month: selected.month
          });
          const bytes = new TextEncoder().encode(result.csv);
          saved = await saveFile(bytes, result.filename, "text/csv");
          filename = result.filename;
          break;
        }
        case "clientes": {
          const result = await generateCustomersReport.mutateAsync({ format });
          ({ saved, filename } = await downloadReportResult(result, format));
          break;
        }
        case "prestamos-en-riesgo": {
          const result = await generateDefaultedReport.mutateAsync({ format });
          ({ saved, filename } = await downloadReportResult(result, format));
          break;
        }
        case "renovacion": {
          const result = await generateRenewalCandidatesReport.mutateAsync({ format });
          ({ saved, filename } = await downloadReportResult(result, format));
          break;
        }
        case "desempeno": {
          const result = await generatePerformanceReport.mutateAsync({
            startDate,
            endDate,
            format
          });
          ({ saved, filename } = await downloadReportResult(result, format));
          break;
        }
        case "contable": {
          const result = await generateAccountingReport.mutateAsync({ startDate, endDate, format });
          ({ saved, filename } = await downloadReportResult(result, format));
          break;
        }
        default:
          return;
      }
      toast.success(savedMessage("Reporte", saved, filename), { durationMs: SAVED_TOAST_MS });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el reporte.");
    } finally {
      setDownloadingId(null);
    }
  }

  function renderList(entries: ReportEntry[]) {
    return (
      <div className="rounded-[14px] border border-[#E5EAF1] bg-white">
        {/* No overflow-hidden here: rows have no distinct background to
            clip against the rounded corners, and the format-switch menu
            (absolutely positioned within a row) needs to escape this box. */}
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
              <div className="relative shrink-0">
                {(() => {
                  const multiFormat = entry.formats.length > 1;
                  const format = entry.formats.length > 1 ? formatFor(entry.id) : entry.formats[0];
                  const idle = !downloading;
                  const menuOpen = openMenuId === entry.id;
                  // One pill: the two halves share a background and rounded
                  // shell, split only by a hairline translucent divider so it
                  // reads as a single control rather than two glued buttons.
                  return (
                    <div
                      className={cn(
                        "inline-flex items-stretch overflow-hidden rounded-[9px] bg-[#1F4AA8] text-white",
                        !idle && "opacity-60"
                      )}
                    >
                      <button
                        type="button"
                        disabled={downloading}
                        onClick={() => void handleDownload(entry)}
                        className={cn(
                          "inline-flex items-center gap-[7px] px-[14px] py-[9px] text-[13px] font-medium transition",
                          idle ? "hover:bg-[#183c88]" : "cursor-not-allowed"
                        )}
                      >
                        <Download size={14} />
                        {downloading ? "Generando…" : `Descargar ${format}`}
                      </button>
                      {multiFormat && (
                        <button
                          type="button"
                          disabled={downloading}
                          onClick={() =>
                            setOpenMenuId((prev) => (prev === entry.id ? null : entry.id))
                          }
                          aria-label={`Cambiar formato de ${entry.title}`}
                          aria-expanded={menuOpen}
                          className={cn(
                            "inline-flex items-center justify-center border-l border-white/20 px-[8px] transition",
                            downloading ? "cursor-not-allowed" : "hover:bg-[#183c88]"
                          )}
                        >
                          <ChevronDown
                            size={14}
                            className={cn("transition-transform", menuOpen && "rotate-180")}
                          />
                        </button>
                      )}
                    </div>
                  );
                })()}
                {entry.formats.length > 1 && openMenuId === entry.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                    <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-[120px] overflow-hidden rounded-[10px] border border-[#E5EAF1] bg-white p-1 shadow-lg">
                      {entry.formats.map((f) => {
                        const active = formatFor(entry.id) === f;
                        return (
                          <button
                            key={f}
                            type="button"
                            onClick={() => {
                              setSelectedFormat((prev) => ({
                                ...prev,
                                [entry.id]: f as "PDF" | "JSON"
                              }));
                              setOpenMenuId(null);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-[6px] px-[10px] py-[7px] text-[13px] font-medium transition",
                              active
                                ? "bg-[#E9F2FF] text-[#1F4AA8]"
                                : "text-[#14254A] hover:bg-[#F4F7FB]"
                            )}
                          >
                            {f}
                            {active && <Check size={14} className="text-[#1F4AA8]" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
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
