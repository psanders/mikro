/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Printer } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { Header } from "../../components/ui/Header";
import { PaymentRow } from "../../components/ui/PaymentRow";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { useLocalDashboard, useLocalPaymentsByLoan } from "../../lib/offline/hooks";

function formatRD(amount: number): string {
  return `RD$${amount.toLocaleString("es-DO")}`;
}

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

export default function HistoricoPagosScreen() {
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const numericId = Number(loanId);

  const dashboard = useLocalDashboard();
  const paymentsQuery = useLocalPaymentsByLoan(numericId);

  const visit = useMemo(() => {
    return (dashboard.data?.visits ?? []).find((v) => v.loanId === numericId);
  }, [dashboard.data?.visits, numericId]);

  const payments = useMemo(() => {
    return (paymentsQuery.data ?? [])
      .filter((p) => p.status !== "REVERSED")
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  }, [paymentsQuery.data]);

  const installmentPayments = payments.filter((p) => p.kind === "INSTALLMENT");
  const lateFeePayments = payments.filter((p) => p.kind === "LATE_FEE");
  const totalCollected = installmentPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalMora = lateFeePayments.reduce((s, p) => s + Number(p.amount), 0);
  const lastPayment = payments[0];
  const lastPaymentDate = lastPayment ? new Date(lastPayment.paidAt) : null;

  const displayName = visit ? (visit.loanNickname ?? visit.customerName) : `#${loanId}`;
  const subtitle = visit ? `${displayName} · Préstamo #${loanId}` : `Préstamo #${loanId}`;

  return (
    <View style={styles.screen}>
      <Header title="Histórico de pagos" subtitle={subtitle} rightIcon={Printer} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL COBRADO</Text>
          <View style={styles.summaryAmountRow}>
            <Text style={styles.summaryCurrency}>RD$</Text>
            <Text style={styles.summaryAmount}>{totalCollected.toLocaleString("es-DO")}</Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryGridItem}>
              <Text style={styles.gridLabel}>Cuotas pagadas</Text>
              <Text style={styles.gridValue}>
                {visit
                  ? `${visit.installmentNumber - 1} de ${visit.termLength}`
                  : `${installmentPayments.length}`}
              </Text>
            </View>
            <View style={styles.summaryGridItem}>
              <Text style={styles.gridLabel}>Mora pagada</Text>
              <Text style={styles.gridValue}>{formatRD(totalMora)}</Text>
            </View>
            <View style={styles.summaryGridItem}>
              <Text style={styles.gridLabel}>Último pago</Text>
              <Text style={styles.gridValue}>
                {lastPaymentDate
                  ? `${lastPaymentDate.getDate()} ${MONTHS[lastPaymentDate.getMonth()]?.toLowerCase()}`
                  : "—"}
              </Text>
            </View>
          </View>
        </View>

        <SectionLabel>PAGOS REGISTRADOS</SectionLabel>

        {paymentsQuery.isLoading && <Text style={styles.emptyText}>Cargando...</Text>}
        {payments.length === 0 && paymentsQuery.isSuccess && (
          <Text style={styles.emptyText}>No hay pagos registrados.</Text>
        )}

        {payments.map((p) => {
          const d = new Date(p.paidAt);
          const method = p.method === "CASH" ? "Efectivo" : "Transferencia";
          const kind = p.kind === "LATE_FEE" ? "Cargo por mora" : "Pago cuota";

          return (
            <PaymentRow
              key={p.id}
              day={String(d.getDate())}
              month={MONTHS[d.getMonth()]}
              title={`${kind} · ${formatRD(Number(p.amount))}`}
              subtitle={`${method}`}
              amount={formatRD(Number(p.amount))}
              note={p.kind === "LATE_FEE" ? "mora" : undefined}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.screen },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  summaryCard: {
    backgroundColor: colors.brand.blue.deep,
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  summaryLabel: {
    fontFamily: "Geist_700Bold",
    fontSize: 10,
    letterSpacing: 1.4,
    color: "#A9C4F2"
  },
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
  summaryGrid: { flexDirection: "row", gap: 10 },
  summaryGridItem: { flex: 1, gap: 2 },
  gridLabel: {
    fontFamily: "Geist_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.6,
    color: "#A9C4F2"
  },
  gridValue: { fontFamily: "Geist_700Bold", fontSize: 14, color: colors.brand.white },
  emptyText: {
    fontFamily: "Geist_500Medium",
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    paddingVertical: 20
  }
});
