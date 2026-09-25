/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Edit data (Pencil k4S97G): the form's sections as an accordion, one open at
 * a time, each with its filled/total count. Data only — documents live in the
 * evidence view. Saving re-scores on the server and refreshes the AI summary.
 */
import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Info } from "lucide-react";
import { trpc } from "../../../lib/trpc";
import { useToast } from "../../../components/ui/ToastProvider";
import { friendlyError } from "../../../lib/applications";
import { cn } from "../../../lib/cn";
import { SidePanel } from "../../components/SidePanel";
import {
  APPLICATION_FIELD_SECTIONS,
  fieldValue,
  optionLabel,
  optionValue,
  sectionProgress
} from "../fields";
import { useApplicationInvalidation } from "../helpers";
import { Btn, INPUT_CLASS, PanelField } from "../ui";
import type { ViewProps } from "./types";

export function EditView({ app, viewer, onView, panel }: ViewProps) {
  const toast = useToast();
  const invalidate = useApplicationInvalidation();
  const record = app as unknown as Record<string, unknown>;
  const [open, setOpen] = useState<string>(() => {
    const incomplete = APPLICATION_FIELD_SECTIONS.find((s) => {
      const p = sectionProgress(record, s);
      return p.filled < p.total;
    });
    return incomplete?.id ?? APPLICATION_FIELD_SECTIONS[0]!.id;
  });
  const [patch, setPatch] = useState<Record<string, string>>({});
  const merged = useMemo(
    () => ({ ...record, rawData: { ...((record.rawData as object) ?? {}), ...patch } }),
    [record, patch]
  );
  const writable = app.status === "IN_REVIEW" && app.assignedReviewerId === viewer.id;
  const update = trpc.updateApplication.useMutation({
    onSuccess: async () => {
      toast.success("Datos guardados. El score y el resumen se recalculan.");
      await invalidate(app.id);
      onView("detail");
    },
    onError: (e) => toast.error(friendlyError(e, "No se pudieron guardar los datos."))
  });
  const dirty = Object.keys(patch).length > 0;

  const footer = (
    <>
      <span className="flex flex-1 items-center gap-[6px] text-[12px] font-medium text-[#697A93]">
        <Info size={13} />
        Solo datos del formulario · el score y el resumen IA se recalculan al guardar
      </span>
      <Btn onClick={() => onView("detail")}>Cancelar</Btn>
      <Btn
        tone="primary"
        icon={Check}
        disabled={!writable || !dirty || update.isPending}
        onClick={() => update.mutate({ id: app.id, patch })}
        data-testid="edit-save"
      >
        Guardar cambios
      </Btn>
    </>
  );

  return (
    <SidePanel open {...panel} footer={footer}>
      <div className="flex flex-col" data-testid="edit-view">
        {!writable && (
          <p className="mb-4 rounded-[8px] bg-[#EEF3F9] p-3 text-[12px] font-medium text-[#697A93]">
            Solo el evaluador asignado edita los datos, y solo mientras la solicitud está en
            evaluación.
          </p>
        )}
        {APPLICATION_FIELD_SECTIONS.map((section) => {
          const p = sectionProgress(merged, section);
          const complete = p.filled === p.total;
          const isOpen = open === section.id;
          return (
            <div key={section.id} className="border-b border-[#E5EAF1] py-[14px]">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? "" : section.id)}
                className="flex w-full items-center gap-[10px]"
                aria-expanded={isOpen}
              >
                <span className="text-[14px] font-semibold text-[#14254A]">{section.title}</span>
                <span className="flex-1" />
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-semibold",
                    complete ? "bg-[#E8F7EE] text-[#16A34A]" : "bg-[#FDF1E3] text-[#D97706]"
                  )}
                >
                  {complete && <Check size={11} />}
                  {p.filled}/{p.total}
                </span>
                {isOpen ? (
                  <ChevronUp size={15} className="text-[#697A93]" />
                ) : (
                  <ChevronDown size={15} className="text-[#697A93]" />
                )}
              </button>
              {isOpen && (
                <div className="mt-[14px] grid grid-cols-2 gap-3 pl-[2px]">
                  {section.fields.map((f) => {
                    const value = patch[f.key] ?? fieldValue(record, f.key);
                    const missing = !value.trim();
                    const cls = cn(INPUT_CLASS, missing && "border-[#D97706] bg-[#FDF1E3]");
                    const set = (v: string) => setPatch((prev) => ({ ...prev, [f.key]: v }));
                    return (
                      <PanelField key={f.key} label={f.label}>
                        {f.options ? (
                          <select
                            className={cls}
                            value={value}
                            disabled={!writable}
                            onChange={(e) => set(e.target.value)}
                            data-testid={`field-${f.key}`}
                          >
                            <option value="">Falta — elegir</option>
                            {f.options.map((o) => (
                              <option key={optionValue(o)} value={optionValue(o)}>
                                {optionLabel(o)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className={cls}
                            value={value}
                            placeholder={missing ? "Falta" : f.placeholder}
                            disabled={!writable}
                            onChange={(e) => set(e.target.value)}
                            data-testid={`field-${f.key}`}
                          />
                        )}
                      </PanelField>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SidePanel>
  );
}
