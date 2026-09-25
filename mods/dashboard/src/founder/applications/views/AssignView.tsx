/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Admin assignment (Pencil ZU51C): pick who evaluates a queued application, or
 * move one already in review to someone else. Shows each reviewer's current
 * load so the choice is informed.
 */
import { useMemo, useState } from "react";
import { Info, UserCheck } from "lucide-react";
import { trpc } from "../../../lib/trpc";
import { useToast } from "../../../components/ui/ToastProvider";
import { friendlyError } from "../../../lib/applications";
import { cn } from "../../../lib/cn";
import { SidePanel } from "../../components/SidePanel";
import { useApplicationInvalidation } from "../helpers";
import { Btn } from "../ui";
import type { ViewProps } from "./types";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function AssignView({ app, viewer, onView, panel }: ViewProps) {
  const toast = useToast();
  const invalidate = useApplicationInvalidation();
  const users = trpc.listUsers.useQuery({ limit: 100 });
  const inReview = trpc.listApplications.useQuery({ status: "IN_REVIEW", limit: 100 });
  const reviewers = useMemo(
    () =>
      (users.data ?? []).filter((u) =>
        u.roles?.some((r) => r.role === "REVIEWER" || r.role === "ADMIN")
      ),
    [users.data]
  );
  const load = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of inReview.data ?? [])
      if (a.assignedReviewerId) m.set(a.assignedReviewerId, (m.get(a.assignedReviewerId) ?? 0) + 1);
    return m;
  }, [inReview.data]);
  const [picked, setPicked] = useState<string>("");
  const pickedName = reviewers.find((r) => r.id === picked)?.name;

  const assign = trpc.assignApplication.useMutation({
    onSuccess: async () => {
      toast.success(`Solicitud asignada a ${pickedName}.`);
      await invalidate(app.id);
      onView("detail");
    },
    onError: (e) => toast.error(friendlyError(e, "No se pudo asignar la solicitud."))
  });

  const footer = (
    <>
      <span className="flex-1" />
      <Btn onClick={() => onView("detail")}>Cancelar</Btn>
      <Btn
        tone="primary"
        icon={UserCheck}
        disabled={
          !viewer.isAdmin || !picked || picked === app.assignedReviewerId || assign.isPending
        }
        onClick={() => assign.mutate({ id: app.id, assigneeId: picked })}
        data-testid="assign-confirm"
      >
        {pickedName ? `Asignar a ${pickedName}` : "Asignar"}
      </Btn>
    </>
  );

  return (
    <SidePanel open {...panel} footer={footer}>
      <div className="flex flex-col gap-[14px]" data-testid="assign-view">
        <span className="text-[12px] font-semibold text-[#697A93]">¿Quién la evalúa?</span>
        {reviewers.map((r) => {
          const selected = picked === r.id;
          const current = r.id === app.assignedReviewerId;
          const isAdmin = r.roles?.some((x) => x.role === "ADMIN");
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setPicked(r.id)}
              data-testid={`assign-option-${r.id}`}
              className={cn(
                "flex items-center gap-3 rounded-[10px] px-[14px] py-3 text-left",
                selected
                  ? "border-[1.5px] border-[#7C3AED] bg-[#FAF7FF]"
                  : "border border-[#E5EAF1] bg-white"
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 shrink-0 rounded-full",
                  selected ? "border-[5px] border-[#7C3AED]" : "border-[1.5px] border-[#E5EAF1]"
                )}
              />
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#E9F2FF] text-[12px] font-semibold text-[#1F4AA8]">
                {initials(r.name)}
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-[13px] font-semibold text-[#14254A]">
                  {r.name}
                  {r.id === viewer.id ? " (tú)" : ""}
                </span>
                <span className="text-[11.5px] font-medium text-[#697A93]">
                  {isAdmin ? "Admin" : "Evaluador"} · {load.get(r.id) ?? 0} en evaluación
                  {current ? " · asignada ahora" : ""}
                </span>
              </span>
            </button>
          );
        })}
        <div className="flex gap-2 rounded-[8px] bg-[#EEF3F9] p-3 text-[12px] font-medium leading-[1.4] text-[#697A93]">
          <Info size={14} className="mt-[1px] shrink-0" />
          La solicitud pasa a En evaluación en el feed de la persona elegida. Si ya estaba en
          evaluación, cambia de manos y la evidencia subida se conserva.
        </div>
      </div>
    </SidePanel>
  );
}
