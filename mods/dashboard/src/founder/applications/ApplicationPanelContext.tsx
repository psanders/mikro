/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Opens the application side panel from anywhere in the founder app (feed
 * cards, closed group, search) on a given view. One panel at a time; nested
 * views go "← Solicitud de …" back to the detail view. The loan calculator
 * shares the slot, so opening one replaces the other.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LoanCalculatorPanel } from "../calculator/LoanCalculatorPanel";
import { ApplicationPanel } from "./ApplicationPanel";

export type ApplicationView = "detail" | "edit" | "evidence" | "contract" | "disburse" | "assign";

type PanelState =
  | { kind: "application"; applicationId: string; view: ApplicationView }
  | { kind: "calculator" };

interface ApplicationPanelApi {
  open: (applicationId: string, view?: ApplicationView) => void;
  openCalculator: () => void;
  close: () => void;
}

const Ctx = createContext<ApplicationPanelApi | null>(null);

export function ApplicationPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PanelState | null>(null);
  const open = useCallback(
    (applicationId: string, view: ApplicationView = "detail") =>
      setState({ kind: "application", applicationId, view }),
    []
  );
  const openCalculator = useCallback(() => setState({ kind: "calculator" }), []);
  const close = useCallback(() => setState(null), []);
  const api = useMemo(() => ({ open, openCalculator, close }), [open, openCalculator, close]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {state?.kind === "calculator" && <LoanCalculatorPanel onClose={close} />}
      {state?.kind === "application" && (
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
