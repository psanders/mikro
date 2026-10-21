/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The renewal side panel (Pencil EzobQ sec-12 C): four tabs that follow the
 * process — Términos, Contrato, Documentos, Finalizar — over one renewal. It
 * only ever calls the renewal procedures; the old loan, the new loan and the
 * ledger change only when Finalizar succeeds. Cancel is available until then.
 */
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { useToast } from "../../components/ui/ToastProvider";
import { friendlyError } from "../../lib/applications";
import { cn } from "../../lib/cn";
import { SidePanel } from "../components/SidePanel";
import { useViewer } from "../applications/useViewer";
import { CancelDialog } from "./CancelDialog";
import { ContractView } from "./ContractView";
import { DocumentsView } from "./DocumentsView";
import { FinalizeView } from "./FinalizeView";
import { RenewalStatusPill } from "./RenewalStatusPill";
import { TermsView } from "./TermsView";
import { defaultTab, isOpen, type RenewalTab } from "./helpers";
import { renewalTone } from "./status";

const TABS: Array<{ id: RenewalTab; label: string }> = [
  { id: "terminos", label: "Términos" },
  { id: "contrato", label: "Contrato" },
  { id: "documentos", label: "Documentos" },
  { id: "finalizar", label: "Finalizar" }
];

/** Quote and renewal refresh while open: what is owed moves with mora and payments. */
const QUOTE_POLL_MS = 30_000;

export interface RenewalPanelProps {
  renewalId: string;
  /** Tab to open on; defaults to where the next step is. */
  tab?: RenewalTab;
  /** Open with the cancel confirmation showing (the feed card's "Cancelar"). */
  cancel?: boolean;
  onClose: () => void;
}

export function RenewalPanel({ renewalId, tab, cancel, onClose }: RenewalPanelProps) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const viewer = useViewer();
  const renewalQuery = trpc.getLoanRenewal.useQuery({ id: renewalId });
  const quoteQuery = trpc.getLoanRenewalQuote.useQuery(
    { id: renewalId },
    { refetchInterval: QUOTE_POLL_MS, refetchOnWindowFocus: true }
  );
  const [picked, setPicked] = useState<RenewalTab | null>(tab ?? null);
  const [confirmingCancel, setConfirmingCancel] = useState(Boolean(cancel));
  const renewal = renewalQuery.data;
  const active = picked ?? (renewal ? defaultTab(renewal.status) : "terminos");

  const cancelMutation = trpc.cancelLoanRenewal.useMutation({
    onSuccess: async () => {
      toast.success("Renovación cancelada. El préstamo sigue activo.");
      setConfirmingCancel(false);
      await refresh();
    },
    onError: (e) => {
      setConfirmingCancel(false);
      toast.error(friendlyError(e, "No se pudo cancelar la renovación."));
    }
  });

  async function refresh() {
    await Promise.all([
      utils.getLoanRenewal.invalidate({ id: renewalId }),
      utils.getLoanRenewalQuote.invalidate({ id: renewalId }),
      utils.listCustomerDocuments.invalidate(),
      utils.listLoanRenewalsByCustomer.invalidate(),
      utils.listLoansByCustomer.invalidate(),
      utils.getOpenLoanRenewal.invalidate(),
      utils.listFeedEvents.invalidate(),
      utils.listOpenRenewalEvents.invalidate()
    ]);
  }

  const viewProps = renewal && {
    renewal,
    quote: quoteQuery.data,
    viewer,
    refresh,
    goTo: setPicked,
    requestCancel: () => setConfirmingCancel(true)
  };

  return (
    <SidePanel
      open
      onClose={onClose}
      testId="renewal-panel"
      icon={RefreshCw}
      iconClassName={renewalTone(renewal?.status ?? "DRAFT").chip}
      title={renewal ? `Renovar préstamo #${renewal.loan.loanId}` : "Renovar préstamo"}
      subtitle={renewal?.customer.name}
      headerExtra={renewal ? <RenewalStatusPill status={renewal.status} /> : undefined}
    >
      {renewalQuery.isError && (
        <p className="text-[13px] font-medium text-ds-red">
          {friendlyError(renewalQuery.error, "No se pudo cargar la renovación.")}
        </p>
      )}
      {viewProps && renewal && (
        <div className="flex flex-col gap-[20px]">
          <div className="flex items-center gap-[22px] border-b border-ds-border" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active === t.id}
                data-testid={`renewal-tab-${t.id}`}
                onClick={() => setPicked(t.id)}
                className={cn(
                  "-mb-px border-b-2 pb-[10px] text-[13px]",
                  active === t.id
                    ? "border-brand-blue-primary font-semibold text-brand-blue-primary"
                    : "border-transparent font-medium text-ds-muted hover:text-brand-ink"
                )}
              >
                {t.label}
              </button>
            ))}
            <span className="flex-1" />
            {isOpen(renewal.status) && (
              <span className="pb-[10px] text-[11px] font-medium text-ds-muted">
                Se puede cancelar hasta finalizar
              </span>
            )}
          </div>

          {active === "terminos" && <TermsView {...viewProps} />}
          {active === "contrato" && <ContractView {...viewProps} />}
          {active === "documentos" && <DocumentsView {...viewProps} />}
          {active === "finalizar" && <FinalizeView {...viewProps} />}
        </div>
      )}

      {confirmingCancel && renewal && (
        <CancelDialog
          loanNumber={renewal.loan.loanId}
          customerName={renewal.customer.name}
          busy={cancelMutation.isPending}
          onBack={() => setConfirmingCancel(false)}
          onConfirm={() => cancelMutation.mutate({ id: renewal.id })}
        />
      )}
    </SidePanel>
  );
}
