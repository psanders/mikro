/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The application side panel (Pencil EzobQ §08: UbCzS detail, k4S97G edit,
 * i7Umh evidence, DvlAW disbursement, ZU51C assign). Loads the application and
 * its evidence once and hands them to the active view; the rules for what the
 * viewer may do come from `checkAction` (evaluateTransition).
 */
import {
  ClipboardList,
  FileSignature,
  Images,
  Landmark,
  Pencil,
  Scale,
  UserPlus
} from "lucide-react";
import { trpc } from "../../lib/trpc";
import { applicantName, friendlyError } from "../../lib/applications";
import { SidePanel } from "../components/SidePanel";
import type { ApplicationView } from "./ApplicationPanelContext";
import { useViewer } from "./useViewer";
import { ScoreChip, StatusPill } from "./ui";
import { DetailView } from "./views/DetailView";
import { EditView } from "./views/EditView";
import { EvidenceView } from "./views/EvidenceView";
import { ContractView } from "./views/ContractView";
import { DisburseView } from "./views/DisburseView";
import { AssignView } from "./views/AssignView";

const VIEW_META: Record<ApplicationView, { title: string; icon: typeof Scale }> = {
  detail: { title: "", icon: ClipboardList },
  edit: { title: "Editar datos", icon: Pencil },
  evidence: { title: "Evidencia", icon: Images },
  contract: { title: "Contrato", icon: FileSignature },
  disburse: { title: "Registrar desembolso", icon: Landmark },
  assign: { title: "Asignar solicitud", icon: UserPlus }
};

export interface ApplicationPanelProps {
  applicationId: string;
  view: ApplicationView;
  onView: (view: ApplicationView) => void;
  onClose: () => void;
}

export function ApplicationPanel({ applicationId, view, onView, onClose }: ApplicationPanelProps) {
  const viewer = useViewer();
  const appQ = trpc.getApplication.useQuery({ id: applicationId });
  const evidenceQ = trpc.getApplicationEvidence.useQuery({ id: applicationId });
  const app = appQ.data;
  const name = app ? applicantName(app) : "Solicitud";
  const meta = VIEW_META[view];
  const nested = view !== "detail";

  const common = {
    title: nested ? meta.title : name,
    subtitle: app
      ? [app.businessName, nested ? name : null].filter(Boolean).join(" · ") || undefined
      : undefined,
    icon: meta.icon,
    onClose,
    onBack: nested ? () => onView("detail") : undefined,
    backLabel: `Solicitud de ${name}`,
    headerExtra: app ? (
      <div className="flex items-center gap-2">
        <ScoreChip score={app.score} />
        <StatusPill status={app.status} />
      </div>
    ) : undefined,
    testId: "application-panel"
  };

  if (!app || !viewer || !evidenceQ.data) {
    return (
      <SidePanel open {...common}>
        <p className="text-sm font-medium text-[#697A93]">
          {appQ.isError
            ? friendlyError(appQ.error, "No se pudo cargar la solicitud.")
            : "Cargando…"}
        </p>
      </SidePanel>
    );
  }

  const props = { app, evidence: evidenceQ.data, viewer, onView, onClose };
  switch (view) {
    case "edit":
      return <EditView {...props} panel={common} />;
    case "evidence":
      return <EvidenceView {...props} panel={common} />;
    case "contract":
      return <ContractView {...props} panel={common} />;
    case "disburse":
      return <DisburseView {...props} panel={common} />;
    case "assign":
      return <AssignView {...props} panel={common} />;
    default:
      return <DetailView {...props} panel={common} />;
  }
}
