/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reports catalog (`/founder/reportes`) — Pencil "Reportes". Data-driven list
 * (RECURRENTES + PEDIDOS AL COPILOTO groups) with a month period picker.
 * Reports are exports of existing data — no authoring/BI. v1 wires the audit
 * log (month-scoped CSV from the event log via `exportAuditLog`); the other
 * catalog rows render per the design with an inert download (Próximamente).
 */
import { useMemo, useState } from "react";
import {
  CalendarCheck,
  ChevronDown,
  Download,
  ScrollText,
  Sparkles,
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

type ReportGroup = "recurrentes" | "copiloto";

interface ReportEntry {
  id: string;
  group: ReportGroup;
  icon: LucideIcon;
  chipBg: string;
  iconColor: string;
  title: string;
  description: string;
  formats: string[];
  /** Only `available` rows have a wired download (v1: the audit log). */
  available: boolean;
}

// Data-driven catalog (Pencil). Adding a future report is adding an entry here
// (+ a case in handleDownload once its export exists) — the screen is static.
const CATALOG: ReportEntry[] = [
  {
    id: "cierre-mensual",
    group: "recurrentes",
    icon: CalendarCheck,
    chipBg: "bg-[#E9F2FF]",
    iconColor: "text-[#1F4AA8]",
    title: "Cierre mensual",
    description: "Cartera, cobranza, mora y P&L simple · se genera el 1 de cada mes",
    formats: ["PDF", "Excel"],
    available: false
  },
  {
    id: "cartera-activa",
    group: "recurrentes",
    icon: Wallet,
    chipBg: "bg-[#E8F7EE]",
    iconColor: "text-[#16A34A]",
    title: "Cartera activa",
    description: "Corte de hoy · préstamos, balances y estados por ruta",
    formats: ["PDF", "Excel"],
    available: false
  },
  {
    id: "cobranza-cobrador",
    group: "recurrentes",
    icon: Users,
    chipBg: "bg-[#E9F2FF]",
    iconColor: "text-[#1F4AA8]",
    title: "Cobranza por cobrador",
    description: "Quincenal · efectividad, visitas y montos por ruta",
    formats: ["PDF", "Excel"],
    available: false
  },
  {
    id: "audit-log",
    group: "recurrentes",
    icon: ScrollText,
    chipBg: "bg-[#FDF1E3]",
    iconColor: "text-[#D97706]",
    title: "Registro de auditoría",
    description: "Exportación completa de los eventos del mes · directo del event log",
    formats: ["Excel"],
    available: true
  },
  {
    id: "mora-ruta",
    group: "copiloto",
    icon: Sparkles,
    chipBg: "bg-[#E9F2FF]",
    iconColor: "text-[#1F4AA8]",
    title: "Mora por ruta",
    description: "Pedido en el chat · «desglosa la mora por ruta y cobrador»",
    formats: ["PDF", "Excel"],
    available: false
  },
  {
    id: "clientes-renovables",
    group: "copiloto",
    icon: Sparkles,
    chipBg: "bg-[#E9F2FF]",
    iconColor: "text-[#1F4AA8]",
    title: "Clientes renovables",
    description: "Pedido en el chat · «quiénes terminan su préstamo este mes»",
    formats: ["PDF", "Excel"],
    available: false
  }
];

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

  async function handleDownload(entry: ReportEntry) {
    if (!entry.available) return;
    setDownloadingId(entry.id);
    try {
      if (entry.id === "audit-log") {
        const result = await utils.exportAuditLog.fetch({
          year: selected.year,
          month: selected.month
        });
        const bytes = new TextEncoder().encode(result.csv);
        await saveFile(bytes, result.filename, "text/csv");
        toast.success("Reporte descargado.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el reporte.");
    } finally {
      setDownloadingId(null);
    }
  }

  const recurrentes = CATALOG.filter((e) => e.group === "recurrentes");
  const copiloto = CATALOG.filter((e) => e.group === "copiloto");

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
                  title={entry.available ? undefined : "Próximamente"}
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
          <GroupLabel>RECURRENTES</GroupLabel>
          {renderList(recurrentes)}

          <GroupLabel>PEDIDOS AL COPILOTO</GroupLabel>
          {renderList(copiloto)}

          <div className="flex items-center gap-[10px] rounded-[12px] bg-[#E9F2FF] px-4 py-[13px]">
            <Sparkles size={16} className="shrink-0 text-[#1F4AA8]" />
            <span className="flex-1 text-[13px] font-semibold text-[#1F4AA8]">
              ¿Necesitas otro corte? Pídeselo al copiloto — «dame la cobranza de Miguel en junio, en
              Excel» — y el archivo aparece en esta lista.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
