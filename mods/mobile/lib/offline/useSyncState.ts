/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState, useEffect, useCallback } from "react";
import {
  getLastSyncTime,
  getPendingMutationCount,
  getPendingMutationBreakdown,
  getCustomerCount,
  getLoanCount
} from "./queries";

export function useSyncState() {
  const [lastPullAt, setLastPullAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingBreakdown, setPendingBreakdown] = useState({ payments: 0, notes: 0 });
  const [customerCount, setCustomerCount] = useState(0);
  const [loanCount, setLoanCount] = useState(0);

  const refresh = useCallback(() => {
    setLastPullAt(getLastSyncTime());
    setPendingCount(getPendingMutationCount());
    setPendingBreakdown(getPendingMutationBreakdown());
    setCustomerCount(getCustomerCount());
    setLoanCount(getLoanCount());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { lastPullAt, pendingCount, pendingBreakdown, customerCount, loanCount, refresh };
}
