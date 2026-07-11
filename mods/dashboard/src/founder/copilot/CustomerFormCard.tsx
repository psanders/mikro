/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The interactive customer form card — Pencil `cp/customer-form-card`: a blue
 * user-plus header over a body that collects name, phone, cédula, home
 * address, and the assigned collector, then creates the customer via
 * `onCreate`. Every field is editable, unlike the pending-action confirm card.
 * Presentational: the container owns the collector list and the mutation.
 */
import { useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronDown, Loader2, Plus, UserPlus } from "lucide-react";
import { cn } from "../../lib/cn";
import type { CollectorOption, CreateFormStatus, CustomerFormValues, DayOfWeek } from "./types";

const DAY_OPTIONS: Array<{ value: DayOfWeek; label: string }> = [
  { value: "MONDAY", label: "Lunes" },
  { value: "TUESDAY", label: "Martes" },
  { value: "WEDNESDAY", label: "Miércoles" },
  { value: "THURSDAY", label: "Jueves" },
  { value: "FRIDAY", label: "Viernes" },
  { value: "SATURDAY", label: "Sábado" },
  { value: "SUNDAY", label: "Domingo" }
];

const parseNumeric = (value: string): number => Number(value.replace(/[\s,]/g, ""));

const LABEL = "text-[12px] font-semibold text-[#14254A]";
const INPUT =
  "w-full rounded-[8px] border border-[#E5EAF1] bg-[#F4F7FB] px-[14px] py-[10px] text-[14px] font-medium text-[#14254A] outline-none placeholder:text-[#697A93] focus:border-[#1F4AA8]";

export interface CustomerFormCardProps {
  /** Collectors for the assigned-collector select (from the container's listUsers). */
  collectors: CollectorOption[];
  /** Called with validated values when the founder hits create. */
  onCreate: (values: CustomerFormValues) => void;
  status?: CreateFormStatus;
  /** Error copy shown inline when status is "error". */
  error?: string;
  className?: string;
}

export function CustomerFormCard({
  collectors,
  onCreate,
  status = "idle",
  error,
  className
}: CustomerFormCardProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [collectorId, setCollectorId] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [nickname, setNickname] = useState("");
  const [collectionPoint, setCollectionPoint] = useState("");
  const [jobPosition, setJobPosition] = useState("");
  const [income, setIncome] = useState("");
  const [isBusinessOwner, setIsBusinessOwner] = useState(false);
  const [notes, setNotes] = useState("");
  const [preferredPaymentDay, setPreferredPaymentDay] = useState<DayOfWeek | "">("");

  const creating = status === "creating";
  const done = status === "done";

  const valid = useMemo(
    () =>
      name.trim().length > 0 &&
      phone.trim().length > 0 &&
      /^\d{3}-\d{7}-\d{1}$/.test(idNumber.trim()) &&
      homeAddress.trim().length > 0 &&
      collectorId.length > 0,
    [name, phone, idNumber, homeAddress, collectorId]
  );

  const submit = () => {
    if (!valid || creating) return;
    onCreate({
      name: name.trim(),
      phone: phone.trim(),
      idNumber: idNumber.trim(),
      homeAddress: homeAddress.trim(),
      assignedCollectorId: collectorId,
      nickname: nickname.trim() || undefined,
      collectionPoint: collectionPoint.trim() || undefined,
      jobPosition: jobPosition.trim() || undefined,
      income: income.trim() ? parseNumeric(income) : undefined,
      isBusinessOwner: isBusinessOwner || undefined,
      notes: notes.trim() || undefined,
      preferredPaymentDay: preferredPaymentDay || null
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
          <UserPlus size={14} strokeWidth={2} className="text-white" />
        </span>
        <div className="flex min-w-0 flex-col gap-[1px]">
          <span className="text-[14px] font-semibold text-[#14254A]">Nuevo cliente</span>
          <span className="text-[11px] font-medium text-[#697A93]">
            Cliente nuevo · datos básicos
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-[12px] px-[14px] py-[12px]">
        <div className="flex flex-col gap-[7px]">
          <span className={LABEL}>Nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre completo"
            className={INPUT}
          />
        </div>

        <div className="flex gap-[10px]">
          <div className="flex flex-1 flex-col gap-[7px]">
            <span className={LABEL}>Teléfono</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="000-000-0000"
              className={INPUT}
            />
          </div>
          <div className="flex flex-1 flex-col gap-[7px]">
            <span className={LABEL}>Cédula</span>
            <input
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="000-0000000-0"
              className={INPUT}
            />
          </div>
        </div>

        <div className="flex flex-col gap-[7px]">
          <span className={LABEL}>Dirección de residencia</span>
          <input
            value={homeAddress}
            onChange={(e) => setHomeAddress(e.target.value)}
            placeholder="Calle, sector, ciudad"
            className={INPUT}
          />
        </div>

        <div className="flex flex-col gap-[7px]">
          <span className={LABEL}>Cobrador asignado</span>
          <div className="relative">
            <select
              value={collectorId}
              onChange={(e) => setCollectorId(e.target.value)}
              className={cn(INPUT, "appearance-none pr-[34px]")}
            >
              <option value="">Selecciona un cobrador</option>
              {collectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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

        {showOptional ? (
          <div className="flex flex-col gap-[12px]">
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
                <span className={LABEL}>Ocupación</span>
                <input
                  value={jobPosition}
                  onChange={(e) => setJobPosition(e.target.value)}
                  placeholder="p. ej. comerciante"
                  className={INPUT}
                />
              </div>
            </div>
            <div className="flex gap-[10px]">
              <div className="flex flex-1 flex-col gap-[7px]">
                <span className={LABEL}>Ingreso (RD$)</span>
                <input
                  inputMode="decimal"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="0"
                  className={INPUT}
                />
              </div>
              <div className="flex flex-1 flex-col gap-[7px]">
                <span className={LABEL}>Día de pago preferido</span>
                <div className="relative">
                  <select
                    value={preferredPaymentDay}
                    onChange={(e) => setPreferredPaymentDay(e.target.value as DayOfWeek | "")}
                    className={cn(INPUT, "appearance-none pr-[34px]")}
                  >
                    <option value="">Ninguno</option>
                    {DAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
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
            </div>
            <div className="flex flex-col gap-[7px]">
              <span className={LABEL}>Punto de cobro (URL)</span>
              <input
                value={collectionPoint}
                onChange={(e) => setCollectionPoint(e.target.value)}
                placeholder="https://maps.google.com/?q=..."
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-[7px]">
              <span className={LABEL}>Notas</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
                className={INPUT}
              />
            </div>
            <button
              type="button"
              onClick={() => setIsBusinessOwner((v) => !v)}
              className="flex items-center gap-[8px] self-start"
            >
              <span
                className={cn(
                  "flex h-[18px] w-[18px] items-center justify-center rounded-[5px]",
                  isBusinessOwner ? "bg-[#1F4AA8]" : "border border-[#E5EAF1] bg-white"
                )}
              >
                {isBusinessOwner && <Check size={12} strokeWidth={2} className="text-white" />}
              </span>
              <span className="text-[13px] font-medium text-[#14254A]">
                Es propietario de un negocio
              </span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowOptional(true)}
            className="flex items-center gap-[6px] text-[12px] font-medium text-[#697A93]"
          >
            <Plus size={13} strokeWidth={2} />
            Apodo, ocupación e ingreso (opcional)
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
            <UserPlus size={16} strokeWidth={2} />
          )}
          {creating ? "Creando…" : done ? "Cliente creado" : "Crear cliente"}
        </button>
      </div>
    </div>
  );
}
