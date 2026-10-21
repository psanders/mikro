/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * "Renovar" everywhere (profile loan row, search result, copilot card) does the
 * same thing: open the renewal already in progress on that loan, or start one.
 * Starting only creates a DRAFT; nothing is closed, created or posted until it
 * is finalized in the renewal panel.
 */
import { useCallback } from "react";
import { trpc, type RouterOutputs } from "../../lib/trpc";

export type StartedRenewal = RouterOutputs["startLoanRenewal"];

export function useStartRenewal() {
  const utils = trpc.useUtils();
  const start = trpc.startLoanRenewal.useMutation();

  const startOrFind = useCallback(
    async (loanNumber: number): Promise<StartedRenewal> => {
      const existing = await utils.getOpenLoanRenewal.fetch({ loanId: loanNumber });
      const renewal = existing ?? (await start.mutateAsync({ loanId: loanNumber }));
      void utils.listFeedEvents.invalidate();
      void utils.listOpenRenewalEvents.invalidate();
      void utils.listLoanRenewalsByCustomer.invalidate();
      return renewal;
    },
    [utils, start]
  );

  return { startOrFind, pending: start.isPending };
}
