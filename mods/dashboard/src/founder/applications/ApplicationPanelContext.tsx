/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Opens the application side panel from anywhere in the founder app (feed
 * cards, closed group, search) on a given view. One panel at a time; nested
 * views go "← Solicitud de …" back to the detail view.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ApplicationPanel } from "./ApplicationPanel";

export type ApplicationView = "detail" | "edit" | "evidence" | "contract" | "disburse" | "assign";

interface PanelState {
  applicationId: string;
  view: ApplicationView;
}

interface ApplicationPanelApi {
  open: (applicationId: string, view?: ApplicationView) => void;
  close: () => void;
}

const Ctx = createContext<ApplicationPanelApi | null>(null);

export function ApplicationPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PanelState | null>(null);
  const open = useCallback(
    (applicationId: string, view: ApplicationView = "detail") => setState({ applicationId, view }),
    []
  );
  const close = useCallback(() => setState(null), []);
  const api = useMemo(() => ({ open, close }), [open, close]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {state && (
        <ApplicationPanel
          applicationId={state.applicationId}
          view={state.view}
          onView={(view) => setState({ ...state, view })}
          onClose={close}
        />
      )}
    </Ctx.Provider>
  );
}

export function useApplicationPanel(): ApplicationPanelApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useApplicationPanel must be used inside ApplicationPanelProvider");
  return api;
}
