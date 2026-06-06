/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState, useEffect, useMemo } from "react";
import {
  getCollectorDashboard,
  getCollectorInfo,
  getCustomer,
  getCustomerLoans,
  getLoanVisit,
  searchCustomers,
  getLoanByLoanId,
  listPaymentsByLoanId,
  listPaymentsByCustomer,
  listPayments,
  previewLateFee,
  type CollectorDashboard,
  type DashboardVisit,
  type CustomerRow,
  type LoanDetail,
  type PaymentDetail,
  type PreviewLateFeeResult
} from "./queries";
import { useSyncContext } from "./SyncProvider";

interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
}

// Changes whenever the local data could have changed: after a pull (lastPullAt
// value updates) or when the pending-mutation queue changes. Used as the effect
// key for every local query hook so already-mounted screens (Home, Cuadre, ...)
// re-read the DB and stay consistent. NOTE: must use the full lastPullAt value —
// an earlier version used its `.length`, which never changes for an ISO string,
// so screens silently showed stale snapshots after a sync.
function useSyncVersion(): string {
  const { lastPullAt, pendingCount } = useSyncContext();
  return useMemo(() => `${lastPullAt ?? ""}:${pendingCount}`, [lastPullAt, pendingCount]);
}

export function useLocalDashboard(): QueryResult<CollectorDashboard> {
  const version = useSyncVersion();
  const [data, setData] = useState<CollectorDashboard | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const result = getCollectorDashboard();
    setData(result ?? undefined);
    setReady(true);
  }, [version]);

  return {
    data,
    isLoading: !ready,
    isError: false,
    isSuccess: ready && data !== undefined
  };
}

export function useLocalCollector(): QueryResult<{ id: string; name: string }> {
  const version = useSyncVersion();
  const [data, setData] = useState<{ id: string; name: string } | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(getCollectorInfo() ?? undefined);
    setReady(true);
  }, [version]);

  return {
    data,
    isLoading: !ready,
    isError: false,
    isSuccess: ready && data !== undefined
  };
}

export function useLocalCustomerLoans(
  customerId: string | undefined
): QueryResult<DashboardVisit[]> {
  const version = useSyncVersion();
  const [data, setData] = useState<DashboardVisit[] | undefined>(undefined);

  useEffect(() => {
    if (!customerId) {
      setData([]);
      return;
    }
    setData(getCustomerLoans(customerId));
  }, [customerId, version]);

  return {
    data,
    isLoading: data === undefined && !!customerId,
    isError: false,
    isSuccess: data !== undefined
  };
}

export function useLocalLoanVisit(loanId: number | undefined): QueryResult<DashboardVisit> {
  const version = useSyncVersion();
  const [data, setData] = useState<DashboardVisit | undefined>(undefined);

  useEffect(() => {
    if (loanId === undefined || isNaN(loanId)) return;
    setData(getLoanVisit(loanId) ?? undefined);
  }, [loanId, version]);

  return {
    data,
    isLoading: !data && loanId !== undefined,
    isError: false,
    isSuccess: data !== undefined
  };
}

export function useLocalCustomerSearch(query: string, limit = 20): QueryResult<CustomerRow[]> {
  const version = useSyncVersion();
  const [data, setData] = useState<CustomerRow[] | undefined>(undefined);

  useEffect(() => {
    if (!query.trim()) {
      setData([]);
      return;
    }
    setData(searchCustomers(query, limit));
  }, [query, limit, version]);

  return {
    data,
    isLoading: false,
    isError: false,
    isSuccess: data !== undefined
  };
}

export function useLocalCustomer(id: string | undefined): QueryResult<CustomerRow> {
  const version = useSyncVersion();
  const [data, setData] = useState<CustomerRow | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    setData(getCustomer(id) ?? undefined);
  }, [id, version]);

  return {
    data,
    isLoading: !data && !!id,
    isError: false,
    isSuccess: data !== undefined
  };
}

export function useLocalLoan(loanId: number | undefined): QueryResult<LoanDetail> {
  const version = useSyncVersion();
  const [data, setData] = useState<LoanDetail | undefined>(undefined);

  useEffect(() => {
    if (loanId === undefined || isNaN(loanId)) return;
    setData(getLoanByLoanId(loanId) ?? undefined);
  }, [loanId, version]);

  return {
    data,
    isLoading: !data && loanId !== undefined,
    isError: false,
    isSuccess: data !== undefined
  };
}

export function useLocalPaymentsByLoan(
  loanId: number | undefined,
  showReversed = false
): QueryResult<PaymentDetail[]> {
  const version = useSyncVersion();
  const [data, setData] = useState<PaymentDetail[] | undefined>(undefined);

  useEffect(() => {
    if (loanId === undefined || isNaN(loanId)) return;
    setData(listPaymentsByLoanId(loanId, showReversed));
  }, [loanId, showReversed, version]);

  return {
    data,
    isLoading: !data && loanId !== undefined,
    isError: false,
    isSuccess: data !== undefined
  };
}

export function useLocalPaymentsByCustomer(
  customerId: string | undefined,
  startDate: Date,
  endDate: Date
): QueryResult<PaymentDetail[]> {
  const version = useSyncVersion();
  const [data, setData] = useState<PaymentDetail[] | undefined>(undefined);

  useEffect(() => {
    if (!customerId) return;
    setData(listPaymentsByCustomer(customerId, startDate, endDate));
  }, [customerId, startDate.getTime(), endDate.getTime(), version]);

  return {
    data,
    isLoading: !data && !!customerId,
    isError: false,
    isSuccess: data !== undefined
  };
}

export function useLocalPayments(startDate: Date, endDate: Date): QueryResult<PaymentDetail[]> {
  const version = useSyncVersion();
  const [data, setData] = useState<PaymentDetail[] | undefined>(undefined);

  useEffect(() => {
    setData(listPayments(startDate, endDate));
  }, [startDate.getTime(), endDate.getTime(), version]);

  return {
    data,
    isLoading: !data,
    isError: false,
    isSuccess: data !== undefined
  };
}

export function useLocalLateFeePreview(
  loanId: number | undefined
): QueryResult<PreviewLateFeeResult> {
  const version = useSyncVersion();
  const [data, setData] = useState<PreviewLateFeeResult | undefined>(undefined);

  useEffect(() => {
    if (loanId === undefined || isNaN(loanId)) return;
    setData(previewLateFee(loanId) ?? undefined);
  }, [loanId, version]);

  return {
    data,
    isLoading: !data && loanId !== undefined,
    isError: false,
    isSuccess: data !== undefined
  };
}
