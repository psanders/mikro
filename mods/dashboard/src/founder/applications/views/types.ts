/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { RouterOutputs } from "../../../lib/trpc";
import type { SidePanelProps } from "../../components/SidePanel";
import type { ApplicationView } from "../ApplicationPanelContext";
import type { Viewer } from "../useViewer";

export type ApplicationRow = NonNullable<RouterOutputs["getApplication"]>;
export type EvidenceData = RouterOutputs["getApplicationEvidence"];

/** Every panel view receives the loaded data plus the shared panel chrome. */
export interface ViewProps {
  app: ApplicationRow;
  evidence: EvidenceData;
  viewer: Viewer;
  onView: (view: ApplicationView) => void;
  onClose: () => void;
  panel: Omit<SidePanelProps, "open" | "children" | "footer">;
}
