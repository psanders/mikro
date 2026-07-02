/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput, StyleSheet, RefreshControl } from "react-native";
import { colors } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { KvRow } from "../../components/ui/KvRow";
import { useLocalDashboard, useLocalPayments } from "../../lib/offline/hooks";
import { useSyncContext } from "../../lib/offline/SyncProvider";

function formatRD(amount: number): string {
  return `RD$${amount.toLocaleString("es-DO")}`;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function formatToday(): string {
  const now = new Date();
  return `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

export default function CuadreScreen() {
  const [countedInput, setCountedInput] = useState("");
  const { isPulling, pull } = useSyncContext();

  const dashboard = useLocalDashboard();

  const now = useMemo(() => new Date(), []);
  const startOfDay = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    [now]
  );
  const endOfDay = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
    [now]
  );
  const todayPayments = useLocalPayments(startOfDay, endOfDay);

  const collectorName = dashboard.data?.collector.name?.split(" ")[0] ?? "...";

  const { cashTotal, transferTotal, totalReceipts } = useMemo(() => {
    const payments = (todayPayments.data ?? []).filter((p) => p.status !== "REVERSED");

    // A "cuota + mora" collection is stored as two linked rows (a LATE_FEE row
    // plus an INSTALLMENT row that references it via linkedPaymentId). Money
    // totals sum every row, but a single collection must count as ONE receipt,
    // so we collapse late-fee rows that belong to an installment row.
    const linkedIds = new Set(
      payments.map((p) => p.linkedPaymentId).filter((id): id is string => !!id)
    );
    const isMergedLateFee = (p: (typeof payments)[number]) =>
      p.kind === "LATE_FEE" && linkedIds.has(p.id);

    let cash = 0;
    let transfer = 0;
    let receipts = 0;

    for (const p of payments) {
      const amt = Number(p.amount);
      if (p.method === "CASH") cash += amt;
      else transfer += amt;

      // Count each collection event once (skip the merged mora row).
      if (isMergedLateFee(p)) continue;
      receipts++;
    }

    return { cashTotal: cash, transferTotal: transfer, totalReceipts: receipts };
  }, [todayPayments.data]);
  const visitsDone = dashboard.data?.visitsDone ?? 0;
  const visitsPending = dashboard.data?.visitsPending ?? 0;

  const counted = countedInput ? Number(countedInput.replace(/,/g, "")) : null;
  const diff = counted != null ? counted - cashTotal : null;

  return (
    <View style={styles.screen}>
      <Header title="Cuadre del día" subtitle={`${formatToday()} · ${collectorName}`} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isPulling} onRefresh={pull} />}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>EFECTIVO ESPERADO</Text>
          <View style={styles.summaryAmountRow}>
            <Text style={styles.summaryCurrency}>RD$</Text>
            <Text style={styles.summaryAmount}>{cashTotal.toLocaleString("es-DO")}</Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryGridItem}>
              <Text style={styles.gridLabel}>Clientes</Text>
              <Text style={styles.gridValue}>{visitsDone}</Text>
            </View>
            <View style={styles.summaryGridItem}>
              <Text style={styles.gridLabel}>Pendientes</Text>
              <Text style={styles.gridValue}>{visitsPending}</Text>
            </View>
          </View>
        </View>

        <View style={styles.countCard}>
          <Text style={styles.countLabel}>EFECTIVO CONTADO</Text>
          <View style={styles.countInputRow}>
            <Text style={styles.countCurrency}>RD$</Text>
            <TextInput
              style={styles.countInput}
              value={countedInput}
              onChangeText={setCountedInput}
              placeholder="0"
              placeholderTextColor={colors.text.secondary}
              keyboardType="numeric"
            />
            {diff != null && (
              <View style={[styles.matchPill, diff !== 0 && styles.mismatchPill]}>
                <Text style={[styles.matchText, diff !== 0 && styles.mismatchText]}>
                  {diff === 0 ? "✓ Coincide" : `${diff > 0 ? "+" : ""}${formatRD(diff)}`}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.countHint}>
            Conta el efectivo y escribe el total. El sistema te avisa si hay diferencia.
          </Text>
        </View>

        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>DESGLOSE</Text>
          <KvRow label="Recibos" value={String(totalReceipts)} />
          <KvRow label="Transferencias" value={formatRD(transferTotal)} />
          <Text style={styles.breakdownNote}>
            Las transferencias no entran en el efectivo a entregar.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  content: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  summaryCard: {
    backgroundColor: colors.brand.blue.deep,
    borderRadius: 18,
    padding: 18,
    gap: 12
  },
  summaryLabel: { fontFamily: "Geist_700Bold", fontSize: 10, letterSpacing: 1.4, color: "#A9C4F2" },
  summaryAmountRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  summaryCurrency: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 18,
    color: colors.brand.yellow.accent
  },
  summaryAmount: {
    fontFamily: "Geist_700Bold",
    fontSize: 36,
    color: colors.brand.white,
    letterSpacing: -1
  },
  summaryGrid: { flexDirection: "row", gap: 8 },
  summaryGridItem: { flex: 1, gap: 2 },
  gridLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.6,
    color: "#A9C4F2"
  },
  gridValue: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.white },
  countCard: {
    backgroundColor: colors.brand.white,
    borderRadius: 18,
    padding: 18,
    gap: 10
  },
  countLabel: {
    fontFamily: "Geist_700Bold",
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.secondary
  },
  countInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg.screen,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#D3DFF4"
  },
  countCurrency: { fontFamily: "Geist_600SemiBold", fontSize: 18, color: colors.text.secondary },
  countInput: {
    flex: 1,
    fontFamily: "Geist_700Bold",
    fontSize: 28,
    color: colors.brand.ink,
    letterSpacing: -0.5,
    padding: 0
  },
  matchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    borderRadius: 9999,
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  mismatchPill: { backgroundColor: "#FEE2E2" },
  matchText: { fontFamily: "Geist_700Bold", fontSize: 11, color: "#15803D" },
  mismatchText: { color: "#DC2626" },
  countHint: {
    fontFamily: "Geist_500Medium",
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 16
  },
  breakdownCard: {
    backgroundColor: colors.brand.white,
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  breakdownTitle: {
    fontFamily: "Geist_700Bold",
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.secondary,
    marginBottom: 4
  },
  breakdownNote: {
    fontFamily: "Geist_500Medium",
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 15,
    marginTop: 2
  }
});
