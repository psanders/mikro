/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Banknote, NotebookPen, EllipsisVertical } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { CuotaRow } from "../../components/ui/CuotaRow";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { KvRow } from "../../components/ui/KvRow";
import { getRoles, canManagePayments } from "../../lib/auth";
import { useLocalLoan, useLocalLoanSnapshot } from "../../lib/offline/hooks";
import { useSyncContext } from "../../lib/offline/SyncProvider";

function formatRD(amount: number): string {
  return `RD$${amount.toLocaleString("es-DO")}`;
}

function formatFreq(freq: string): string {
  switch (freq) {
    case "DAILY":
      return "Diario";
    case "WEEKLY":
      return "Semanal";
    case "BIWEEKLY":
      return "Quincenal";
    case "MONTHLY":
      return "Mensual";
    default:
      return freq;
  }
}

const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic"
];

function formatShortDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

function getDueDateForCycle(startDate: Date, cycleIndex: number, freq: string): Date {
  const start = new Date(startDate);
  const periods = cycleIndex + 1;
  switch (freq) {
    case "DAILY":
      return new Date(start.getTime() + periods * 86_400_000);
    case "WEEKLY":
      return new Date(start.getTime() + periods * 7 * 86_400_000);
    case "BIWEEKLY":
      return new Date(start.getTime() + periods * 14 * 86_400_000);
    case "MONTHLY": {
      const y = start.getUTCFullYear();
      const m = start.getUTCMonth() + periods;
      const day = start.getUTCDate();
      const maxDay = new Date(Date.UTC(y + Math.floor(m / 12), (m % 12) + 1, 0)).getUTCDate();
      return new Date(Date.UTC(y + Math.floor(m / 12), m % 12, Math.min(day, maxDay)));
    }
    default:
      return new Date(start.getTime() + periods * 86_400_000);
  }
}

export default function PrestamoDetalleScreen() {
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const numericId = Number(loanId);
  const router = useRouter();
  const { isPulling, pull } = useSyncContext();

  // REVIEWER-only accounts must not see payment/collection data (mikro/#73).
  // Defaults to false (hidden) until roles resolve, so nothing sensitive
  // flashes on screen for a split second.
  const [canPay, setCanPay] = useState(false);
  useEffect(() => {
    getRoles().then((roles) => setCanPay(canManagePayments(roles)));
  }, []);

  const loanQuery = useLocalLoan(numericId);
  const snapshotQuery = useLocalLoanSnapshot(numericId);

  const loan = loanQuery.data;
  const snap = snapshotQuery.data;
  // Single source of truth: the shared snapshot builder computes progress,
  // balance, and mora the same way the server and the home dashboard do.
  const d = snap?.derived;

  const termLength = d?.termLength ?? loan?.termLength ?? 0;
  const paymentAmount = snap?.terms.cuota ?? (loan ? Number(loan.paymentAmount) : 0);
  const totalPaid = d?.totalInstallmentPaid ?? 0;
  const paidCount = d?.cuotasCovered ?? 0;
  const balance = d?.remainingBalance ?? 0;
  const progress = termLength > 0 ? paidCount / termLength : 0;
  const freq = loan?.paymentFrequency ?? snap?.terms.paymentFrequency ?? "DAILY";
  const loanStart = snap
    ? new Date(snap.terms.startingDate ?? snap.terms.createdAt)
    : loan
      ? new Date(loan.startingDate ?? loan.createdAt)
      : null;

  const displayName =
    snap?.customer.nickname ??
    snap?.customer.name ??
    loan?.customer?.nickname ??
    loan?.customer?.name ??
    `#${loanId}`;
  const subtitle = loan || snap ? `${displayName} · Préstamo #${loanId}` : `Préstamo #${loanId}`;

  const endDate =
    loanStart && termLength > 0 ? getDueDateForCycle(loanStart, termLength - 1, freq) : null;
  const daysRemaining = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86_400_000))
    : null;

  const nextDueDate = d?.nextDueDate
    ? new Date(d.nextDueDate)
    : loanStart
      ? getDueDateForCycle(loanStart, paidCount, freq)
      : null;

  const moraAmount = d?.moraAccrued ?? 0;
  // Never quote more cuota than what's left on the loan (final stretch may owe
  // less than a full cuota once partials are accumulated).
  const cuotaDue = Math.min(paymentAmount, balance);
  const todayTotal = cuotaDue + moraAmount;

  const cuotas = useMemo(() => {
    if (!loanStart || termLength === 0) return [];
    const now = new Date();
    const rows: {
      name: string;
      date: string;
      amount: string;
      status: "paid" | "pending" | "overdue";
    }[] = [];

    for (let i = 0; i < termLength; i++) {
      const due = getDueDateForCycle(loanStart, i, freq);
      const isPaid = i < paidCount;
      const isOverdue = !isPaid && due.getTime() < now.getTime();
      // Money already applied to this cuota (partials accumulate in order),
      // so a half-covered cuota shows only what's left on it.
      const applied = Math.min(Math.max(totalPaid - i * paymentAmount, 0), paymentAmount);
      const remaining = paymentAmount - applied;

      rows.push({
        name: `Cuota ${i + 1}`,
        date: formatShortDate(due),
        amount: formatRD(isPaid ? paymentAmount : remaining),
        status: isPaid ? "paid" : isOverdue ? "overdue" : "pending"
      });
    }
    return rows;
  }, [loanStart, termLength, paidCount, freq, paymentAmount, totalPaid]);

  const pills = [
    formatFreq(freq),
    daysRemaining != null ? `${daysRemaining} días` : null,
    endDate ? `Vence ${formatShortDate(endDate)}` : null
  ].filter(Boolean) as string[];

  return (
    <View style={styles.screen}>
      <Header title={`Préstamo #${loanId}`} subtitle={subtitle} rightIcon={EllipsisVertical} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        alwaysBounceVertical
        refreshControl={<RefreshControl refreshing={isPulling} onRefresh={pull} />}
      >
        <View style={styles.metaPills}>
          {pills.map((t) => (
            <View key={t} style={styles.metaPill}>
              <Text style={styles.metaPillText}>{t}</Text>
            </View>
          ))}
        </View>

        {canPay ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>BALANCE PENDIENTE</Text>
              <Text style={styles.summaryNumber}>{formatRD(Math.max(0, balance))}</Text>
              <ProgressBar progress={progress} color={colors.brand.white} />
              <View style={styles.summaryGrid}>
                <View>
                  <Text style={styles.gridLabel}>Pagado</Text>
                  <Text style={styles.gridValue}>{formatRD(totalPaid)}</Text>
                </View>
                <View>
                  <Text style={styles.gridLabel}>Cuotas pagadas</Text>
                  <Text style={styles.gridValue}>
                    {paidCount} de {termLength}
                  </Text>
                </View>
                <View>
                  <Text style={styles.gridLabel}>Próxima</Text>
                  <Text style={styles.gridValue}>
                    {nextDueDate ? formatShortDate(nextDueDate) : "—"}
                  </Text>
                </View>
              </View>
            </View>

            {(cuotaDue > 0 || moraAmount > 0) && (
              <View style={styles.totalCard}>
                <View style={styles.totalHeader}>
                  <View style={{ gap: 2 }}>
                    <Text style={styles.totalLabel}>TOTAL A PAGAR HOY</Text>
                    <Text style={styles.totalSub}>Lo que el cliente debe entregar ahora</Text>
                  </View>
                  <View style={styles.totalAmountRow}>
                    <Text style={styles.totalCurrency}>RD$</Text>
                    <Text style={styles.totalAmount}>{todayTotal.toLocaleString("es-DO")}</Text>
                  </View>
                </View>
                <View style={styles.totalDivider} />
                <KvRow label="Cuota pendiente" value={formatRD(cuotaDue)} />
                {moraAmount > 0 && <KvRow label="Cargo por mora" value={formatRD(moraAmount)} />}
              </View>
            )}

            <View style={styles.planHeader}>
              <SectionLabel>PLAN DE PAGOS</SectionLabel>
              <Pressable onPress={() => router.push(`/historico/${loanId}`)}>
                <Text style={styles.planLink}>Ver historial ›</Text>
              </Pressable>
            </View>

            <View style={styles.cuotaList}>
              {cuotas.map((c) => (
                <CuotaRow key={c.name} {...c} />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>SIN ACCESO A PAGOS</Text>
            <Text style={styles.totalSub}>
              Tu rol de Evaluador no incluye ver balances ni cobrar. Contacta a un cobrador o
              administrador para gestionar pagos de este préstamo.
            </Text>
          </View>
        )}
      </ScrollView>

      {canPay && (
        <View style={styles.ctaBar}>
          <Pressable style={styles.ctaSecondary} onPress={() => router.push(`/visita/${loanId}`)}>
            <NotebookPen size={16} color={colors.brand.blue.deep} strokeWidth={2} />
            <Text style={styles.ctaSecondaryText}>Anotar visita</Text>
          </Pressable>
          <Pressable style={styles.ctaPrimary} onPress={() => router.push(`/cobrar/${loanId}`)}>
            <Banknote size={16} color={colors.brand.white} strokeWidth={2} />
            <Text style={styles.ctaPrimaryText}>Cobrar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  metaPills: { flexDirection: "row", gap: 6 },
  metaPill: {
    backgroundColor: colors.brand.mist,
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  metaPillText: { fontFamily: "Geist_700Bold", fontSize: 11, color: colors.brand.blue.deep },
  summaryCard: {
    backgroundColor: colors.brand.blue.deep,
    borderRadius: 18,
    padding: 20,
    gap: 14
  },
  summaryLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#9DB9F0"
  },
  summaryNumber: {
    fontFamily: "Geist_700Bold",
    fontSize: 36,
    color: colors.brand.white,
    letterSpacing: -1
  },
  summaryGrid: { flexDirection: "row", justifyContent: "space-between" },
  gridLabel: { fontFamily: "Geist_500Medium", fontSize: 11, color: "#9DB9F0" },
  gridValue: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.white },
  totalCard: {
    backgroundColor: colors.brand.white,
    borderRadius: 18,
    padding: 16,
    gap: 12
  },
  totalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: {
    fontFamily: "Geist_700Bold",
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.secondary
  },
  totalSub: { fontFamily: "Geist_500Medium", fontSize: 11, color: colors.text.secondary },
  totalAmountRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  totalCurrency: { fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.brand.orange.deep },
  totalAmount: {
    fontFamily: "Geist_700Bold",
    fontSize: 26,
    color: colors.brand.orange.deep,
    letterSpacing: -0.5
  },
  totalDivider: { height: 1, backgroundColor: colors.border.light },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  planLink: { fontFamily: "Geist_700Bold", fontSize: 11, color: colors.brand.blue.deep },
  cuotaList: { gap: 6 },
  ctaBar: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.brand.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light
  },
  ctaSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brand.mist,
    borderRadius: 12,
    padding: 14
  },
  ctaSecondaryText: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.blue.deep },
  ctaPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brand.blue.deep,
    borderRadius: 12,
    padding: 14
  },
  ctaPrimaryText: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.white }
});
